import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateEventInput, validateCustomFields } from "@/lib/validation";
import { sanitizeError } from "@/lib/apiResponse";
import type { CustomFieldConfig } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get the event (only if owned by user)
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .eq("host_id", user.id)
      .single();

    if (eventError) {
      return NextResponse.json({ error: sanitizeError(eventError) }, { status: 400 });
    }

    // Get the custom fields for this event
    const { data: customFields, error: cfError } = await supabase
      .from("event_custom_fields")
      .select("*")
      .eq("event_id", id)
      .order("sort_order", { ascending: true });

    if (cfError) {
      return NextResponse.json({ error: sanitizeError(cfError) }, { status: 400 });
    }

    return NextResponse.json({ ...event, custom_fields: customFields || [] });
  } catch (err) {
    return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Validate input (same rules as create, but all fields come from the form)
  const validation = validateEventInput(body);
  if (!validation.valid) {
    return NextResponse.json({ error: "Validation failed", errors: validation.errors }, { status: 400 });
  }

  // Validate custom fields if provided
  const customFields = body.custom_fields;
  if (customFields !== undefined) {
    if (!Array.isArray(customFields)) {
      return NextResponse.json({ error: "Validation failed", errors: { custom_fields: "Must be an array" } }, { status: 400 });
    }
    const cfValidation = validateCustomFields(customFields);
    if (!cfValidation.valid) {
      return NextResponse.json({ error: "Validation failed", errors: { custom_fields: cfValidation.errors } }, { status: 400 });
    }
  }

  try {
    const { data, error } = await supabase
      .from("events")
      .update({
        title: body.title,
        description: body.description,
        location: body.location,
        maps_url: body.maps_url,
        cover_image_url: body.cover_image_url,
        start_time: body.start_time,
        end_time: body.end_time,
        timezone: body.timezone,
        is_public: body.is_public,
        allow_plus_ones: body.allow_plus_ones,
        gift_registry_url: body.gift_registry_url,
        gift_message: body.gift_message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("host_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: sanitizeError(error) }, { status: 400 });
    }

    // Handle custom fields update if provided
    if (Array.isArray(customFields)) {
      await updateCustomFields(supabase, id, customFields);
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
  }
}

interface CustomFieldInput {
  id?: string;
  type: string;
  label: string;
  description?: string | null;
  required?: boolean;
  sort_order?: number;
  options?: string[] | null;
  config?: CustomFieldConfig;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateCustomFields(supabase: any, eventId: string, fields: CustomFieldInput[]) {
  // Get existing fields for this event
  const { data: existingFields } = await supabase
    .from("event_custom_fields")
    .select("id")
    .eq("event_id", eventId);

  const existingIds = new Set<string>((existingFields || []).map((f: { id: string }) => f.id));
  const incomingIds = new Set<string>(fields.filter(f => f.id).map(f => f.id!));

  // Find fields to delete (existing but not in incoming)
  const toDelete = [...existingIds].filter(id => !incomingIds.has(id));

  // Find fields to update (have id and exist)
  const toUpdate = fields.filter(f => f.id && existingIds.has(f.id));

  // Find fields to insert (no id)
  const toInsert = fields.filter(f => !f.id);

  // Delete removed fields (cascade will handle responses)
  if (toDelete.length > 0) {
    await supabase
      .from("event_custom_fields")
      .delete()
      .in("id", toDelete);
  }

  // Update existing fields
  for (const field of toUpdate) {
    await supabase
      .from("event_custom_fields")
      .update({
        type: field.type,
        label: field.label,
        description: field.description || null,
        required: field.required ?? false,
        sort_order: field.sort_order ?? 0,
        options: field.options || null,
        config: (field.config || {}) as CustomFieldConfig,
      })
      .eq("id", field.id);
  }

  // Insert new fields
  if (toInsert.length > 0) {
    const fieldsToInsert = toInsert.map((field, index) => ({
      event_id: eventId,
      type: field.type,
      label: field.label,
      description: field.description || null,
      required: field.required ?? false,
      sort_order: field.sort_order ?? (toUpdate.length + index),
      options: field.options || null,
      config: (field.config || {}) as CustomFieldConfig,
    }));

    await supabase
      .from("event_custom_fields")
      .insert(fieldsToInsert);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", id)
      .eq("host_id", user.id);

    if (error) {
      return NextResponse.json({ error: sanitizeError(error) }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
  }
}
