import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateRSVPInput, validateCustomResponses } from "@/lib/validation";
import { rsvpLimiter } from "@/lib/rateLimit";
import { sanitizeError } from "@/lib/apiResponse";
import type { CustomField, CustomFieldConfig } from "@/lib/types";

// Type for signup claims aggregation
type SignupClaims = Record<string, Record<string, number>>;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient();

  // Get the guest with their event
  const { data: guest, error } = await supabase
    .from("guests")
    .select("*, events(*)")
    .eq("rsvp_token", token)
    .single();

  if (error || !guest) {
    return NextResponse.json({ error: "Invalid RSVP link" }, { status: 404 });
  }

  const eventId = guest.event_id;

  // Try to get custom fields for this event, ordered by sort_order
  // This is optional - if the table doesn't exist yet, we continue without custom fields
  let customFields: CustomField[] = [];
  let customResponses: Array<{ field_id: string; guest_id: string; value: string | null }> = [];
  let signupClaims: SignupClaims = {};

  const { data: fieldsData, error: fieldsError } = await supabase
    .from("event_custom_fields")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });

  // Only process custom fields if the table exists (error code PGRST205 = table not found)
  const tableExists = !fieldsError || fieldsError.code !== "PGRST205";

  if (tableExists) {
    if (fieldsError) {
      return NextResponse.json({ error: sanitizeError(fieldsError) }, { status: 500 });
    }
    customFields = fieldsData || [];

    // Get this guest's custom field responses
    const { data: responsesData, error: responsesError } = await supabase
      .from("custom_field_responses")
      .select("*")
      .eq("guest_id", guest.id);

    if (responsesError && responsesError.code !== "PGRST205") {
      return NextResponse.json({ error: sanitizeError(responsesError) }, { status: 500 });
    }
    customResponses = responsesData || [];

    // Build signup claims for signup-type fields
    const signupFields = customFields.filter((f: CustomField) => f.type === "signup");

    if (signupFields.length > 0) {
      const signupFieldIds = signupFields.map((f: CustomField) => f.id);

      // Get all responses for signup fields across all guests for this event
      const { data: allSignupResponses, error: signupError } = await supabase
        .from("custom_field_responses")
        .select("field_id, value")
        .in("field_id", signupFieldIds);

      if (signupError && signupError.code !== "PGRST205") {
        return NextResponse.json({ error: sanitizeError(signupError) }, { status: 500 });
      }

      // Aggregate claim counts per option per field
      signupClaims = aggregateSignupClaims(allSignupResponses || []);
    }
  }

  return NextResponse.json({
    ...guest,
    custom_fields: customFields,
    custom_responses: customResponses,
    signup_claims: signupClaims,
  });
}

/**
 * Aggregates signup claim counts from responses.
 * Returns an object keyed by field_id, with each value being an object
 * mapping option names to their claim counts.
 */
function aggregateSignupClaims(
  responses: Array<{ field_id: string; value: string | null }>
): SignupClaims {
  const claims: SignupClaims = {};

  for (const response of responses) {
    if (!response.value) continue;

    if (!claims[response.field_id]) {
      claims[response.field_id] = {};
    }

    // Value can be a single option or comma-separated options
    const selectedOptions = response.value.split(",").map((v) => v.trim()).filter((v) => v);

    for (const option of selectedOptions) {
      claims[response.field_id][option] = (claims[response.field_id][option] || 0) + 1;
    }
  }

  return claims;
}

interface CustomResponseInput {
  field_id: string;
  value: string | null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Rate limit
  const limit = rsvpLimiter(request);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const body = await request.json();

  // Validate basic RSVP input
  const validation = validateRSVPInput(body);
  if (!validation.valid) {
    return NextResponse.json({ error: "Validation failed", errors: validation.errors }, { status: 400 });
  }

  const supabase = createAdminClient();

  // First, get the guest to verify token and get event_id
  const { data: guest, error: guestError } = await supabase
    .from("guests")
    .select("id, event_id")
    .eq("rsvp_token", token)
    .single();

  if (guestError || !guest) {
    return NextResponse.json({ error: "Invalid RSVP link" }, { status: 404 });
  }

  // Handle custom responses if provided
  const customResponses: CustomResponseInput[] = body.custom_responses || [];
  let customFieldsTableExists = true;

  if (customResponses.length > 0) {
    // Validate that custom_responses is an array
    if (!Array.isArray(customResponses)) {
      return NextResponse.json(
        { error: "Validation failed", errors: { custom_responses: "Must be an array" } },
        { status: 400 }
      );
    }

    // Get the custom field definitions for this event
    const { data: customFields, error: fieldsError } = await supabase
      .from("event_custom_fields")
      .select("id, type, label, required, options, config")
      .eq("event_id", guest.event_id);

    // Check if table exists (error code PGRST205 = table not found)
    if (fieldsError && fieldsError.code === "PGRST205") {
      customFieldsTableExists = false;
    } else if (fieldsError) {
      return NextResponse.json({ error: sanitizeError(fieldsError) }, { status: 500 });
    }

    // Only validate and process custom responses if the table exists
    if (customFieldsTableExists) {
      // Convert to the format expected by validateCustomResponses
      const fieldDefs = (customFields || []).map((f) => ({
        id: f.id,
        type: f.type,
        label: f.label,
        required: f.required,
        options: f.options as string[] | null,
      }));

      // Validate custom responses against field definitions
      const responseValidation = validateCustomResponses(customResponses, fieldDefs);
      if (!responseValidation.valid) {
        return NextResponse.json(
          { error: "Validation failed", errors: { custom_responses: responseValidation.errors } },
          { status: 400 }
        );
      }

      // Check signup field claim limits
      const signupFields = (customFields || []).filter((f) => f.type === "signup");
      if (signupFields.length > 0) {
        const claimError = await checkSignupClaimLimits(
          supabase,
          guest.id,
          signupFields,
          customResponses
        );
        if (claimError) {
          return NextResponse.json(
            { error: "Validation failed", errors: { custom_responses: [claimError] } },
            { status: 400 }
          );
        }
      }
    }
  }

  try {
    // Update the guest record
    const { data, error } = await supabase
      .from("guests")
      .update({
        rsvp_status: body.rsvp_status,
        plus_one_count: body.plus_one_count ?? 0,
        dietary: body.dietary || null,
        message: body.message || null,
        responded_at: new Date().toISOString(),
      })
      .eq("rsvp_token", token)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Failed to update RSVP" }, { status: 400 });
    }

    // Upsert custom field responses (only if table exists)
    if (customResponses.length > 0 && customFieldsTableExists) {
      const upsertError = await upsertCustomResponses(supabase, guest.id, customResponses);
      if (upsertError) {
        return NextResponse.json({ error: sanitizeError(upsertError) }, { status: 500 });
      }
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
  }
}

interface SignupFieldDef {
  id: string;
  type: string;
  options: string[] | null;
  config: CustomFieldConfig | null;
}

/**
 * Checks if any signup field selections would exceed max_claims_per_item.
 * Returns an error message if a limit would be exceeded, null otherwise.
 */
async function checkSignupClaimLimits(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  guestId: string,
  signupFields: SignupFieldDef[],
  responses: CustomResponseInput[]
): Promise<string | null> {
  const signupFieldIds = signupFields.map((f) => f.id);
  const signupResponses = responses.filter((r) => signupFieldIds.includes(r.field_id));

  if (signupResponses.length === 0) {
    return null;
  }

  // Get current claims for all signup fields (excluding this guest's current responses)
  const { data: existingResponses, error } = await supabase
    .from("custom_field_responses")
    .select("field_id, value, guest_id")
    .in("field_id", signupFieldIds);

  if (error) {
    return null; // Don't block on error, log would be better
  }

  // Build current claim counts excluding this guest
  const currentClaims: Record<string, Record<string, number>> = {};
  for (const resp of existingResponses || []) {
    if (resp.guest_id === guestId) continue; // Exclude current guest (they're updating)
    if (!resp.value) continue;

    if (!currentClaims[resp.field_id]) {
      currentClaims[resp.field_id] = {};
    }

    const options = resp.value.split(",").map((v: string) => v.trim()).filter((v: string) => v);
    for (const opt of options) {
      currentClaims[resp.field_id][opt] = (currentClaims[resp.field_id][opt] || 0) + 1;
    }
  }

  // Check each signup response against limits
  for (const response of signupResponses) {
    if (!response.value) continue;

    const field = signupFields.find((f) => f.id === response.field_id);
    if (!field) continue;

    const maxClaims = (field.config as CustomFieldConfig)?.max_claims_per_item;
    if (!maxClaims || maxClaims <= 0) continue; // No limit

    const selectedOptions = response.value.split(",").map((v) => v.trim()).filter((v) => v);
    const fieldClaims = currentClaims[response.field_id] || {};

    for (const option of selectedOptions) {
      const currentCount = fieldClaims[option] || 0;
      if (currentCount >= maxClaims) {
        return `"${option}" is already fully claimed (max ${maxClaims})`;
      }
    }
  }

  return null;
}

/**
 * Upserts custom field responses using ON CONFLICT.
 * Returns an error if the upsert fails, null otherwise.
 */
async function upsertCustomResponses(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  guestId: string,
  responses: CustomResponseInput[]
): Promise<Error | null> {
  const now = new Date().toISOString();

  const records = responses.map((r) => ({
    field_id: r.field_id,
    guest_id: guestId,
    value: r.value || null,
    updated_at: now,
  }));

  const { error } = await supabase
    .from("custom_field_responses")
    .upsert(records, {
      onConflict: "field_id,guest_id",
      ignoreDuplicates: false,
    });

  return error || null;
}
