import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CustomField, CustomFieldConfig } from "@/lib/types";

/**
 * GET /api/events/[slug]/custom-fields
 *
 * Returns aggregated poll results and signup claim status for a public event.
 * Text field responses are NOT returned (those are private to the host).
 *
 * Response shape:
 * {
 *   polls: Array<{
 *     field_id: string;
 *     label: string;
 *     description: string | null;
 *     options: string[];
 *     multi_select: boolean;
 *     votes: Record<string, number>;  // option -> vote count
 *     total_votes: number;
 *   }>;
 *   signups: Array<{
 *     field_id: string;
 *     label: string;
 *     description: string | null;
 *     options: string[];
 *     max_claims_per_item: number;
 *     claims: Record<string, number>;  // option -> claimed count
 *   }>;
 * }
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();

  // First, get the event by slug (must be public)
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const eventId = event.id;

  // Get custom fields for this event (only poll and signup types)
  const { data: fieldsData, error: fieldsError } = await supabase
    .from("event_custom_fields")
    .select("*")
    .eq("event_id", eventId)
    .in("type", ["poll", "signup"])
    .order("sort_order", { ascending: true });

  // Handle case where custom fields table doesn't exist yet
  if (fieldsError && fieldsError.code === "PGRST205") {
    return NextResponse.json({ polls: [], signups: [] });
  }

  if (fieldsError) {
    return NextResponse.json(
      { error: "Failed to fetch custom fields" },
      { status: 500 }
    );
  }

  const fields = (fieldsData || []) as CustomField[];

  // If no poll or signup fields, return empty arrays
  if (fields.length === 0) {
    return NextResponse.json({ polls: [], signups: [] });
  }

  const fieldIds = fields.map((f) => f.id);

  // Get all responses for these fields
  const { data: responsesData, error: responsesError } = await supabase
    .from("custom_field_responses")
    .select("field_id, value")
    .in("field_id", fieldIds);

  if (responsesError && responsesError.code !== "PGRST205") {
    return NextResponse.json(
      { error: "Failed to fetch responses" },
      { status: 500 }
    );
  }

  const responses = responsesData || [];

  // Aggregate responses by field
  const responsesByField: Record<string, string[]> = {};
  for (const response of responses) {
    if (!response.value) continue;
    if (!responsesByField[response.field_id]) {
      responsesByField[response.field_id] = [];
    }
    responsesByField[response.field_id].push(response.value);
  }

  // Build poll results
  const polls = fields
    .filter((f) => f.type === "poll")
    .map((field) => {
      const config = field.config as CustomFieldConfig;
      const options = field.options || [];
      const multiSelect = config.multi_select ?? false;
      const fieldResponses = responsesByField[field.id] || [];

      // Count votes for each option
      const votes: Record<string, number> = {};
      for (const option of options) {
        votes[option] = 0;
      }

      for (const value of fieldResponses) {
        if (multiSelect) {
          // Multi-select: comma-separated values
          const selected = value.split(",").map((v) => v.trim()).filter(Boolean);
          for (const opt of selected) {
            if (votes[opt] !== undefined) {
              votes[opt]++;
            }
          }
        } else {
          // Single select
          const trimmed = value.trim();
          if (votes[trimmed] !== undefined) {
            votes[trimmed]++;
          }
        }
      }

      const totalVotes = Object.values(votes).reduce((sum, count) => sum + count, 0);

      return {
        field_id: field.id,
        label: field.label,
        description: field.description,
        options,
        multi_select: multiSelect,
        votes,
        total_votes: totalVotes,
      };
    });

  // Build signup results
  const signups = fields
    .filter((f) => f.type === "signup")
    .map((field) => {
      const config = field.config as CustomFieldConfig;
      const options = field.options || [];
      const maxClaimsPerItem = config.max_claims_per_item ?? 1;
      const fieldResponses = responsesByField[field.id] || [];

      // Count claims for each option
      const claims: Record<string, number> = {};
      for (const option of options) {
        claims[option] = 0;
      }

      for (const value of fieldResponses) {
        // Signup values can be comma-separated for multiple claims
        const selected = value.split(",").map((v) => v.trim()).filter(Boolean);
        for (const opt of selected) {
          if (claims[opt] !== undefined) {
            claims[opt]++;
          }
        }
      }

      return {
        field_id: field.id,
        label: field.label,
        description: field.description,
        options,
        max_claims_per_item: maxClaimsPerItem,
        claims,
      };
    });

  return NextResponse.json({ polls, signups });
}
