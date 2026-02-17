import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatTime } from "@/lib/utils";
import RSVPForm from "@/components/RSVPForm";
import EventLocation from "@/components/EventLocation";
import type { Guest, Event, CustomField, CustomFieldResponse } from "@/lib/types";
import type { SignupClaims } from "@/components/CustomFieldInput";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function RSVPPage({ params }: Props) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("guests")
    .select("*, events(*)")
    .eq("rsvp_token", token)
    .single();

  if (error || !data) {
    notFound();
  }

  const guest = data as Guest;
  const event = data.events as Event;

  // Fetch custom fields, responses, and signup claims
  let customFields: CustomField[] = [];
  let customResponses: CustomFieldResponse[] = [];
  let signupClaims: SignupClaims = {};

  // Try to get custom fields for this event (table may not exist yet)
  const { data: fieldsData, error: fieldsError } = await supabase
    .from("event_custom_fields")
    .select("*")
    .eq("event_id", event.id)
    .order("sort_order", { ascending: true });

  // Only process if the table exists (error code PGRST205 = table not found)
  const tableExists = !fieldsError || fieldsError.code !== "PGRST205";

  if (tableExists && fieldsData) {
    customFields = fieldsData as CustomField[];

    // Get this guest's custom field responses
    const { data: responsesData } = await supabase
      .from("custom_field_responses")
      .select("*")
      .eq("guest_id", guest.id);

    if (responsesData) {
      customResponses = responsesData as CustomFieldResponse[];
    }

    // Build signup claims for signup-type fields
    const signupFields = customFields.filter((f) => f.type === "signup");
    if (signupFields.length > 0) {
      const signupFieldIds = signupFields.map((f) => f.id);

      const { data: allSignupResponses } = await supabase
        .from("custom_field_responses")
        .select("field_id, value")
        .in("field_id", signupFieldIds);

      if (allSignupResponses) {
        signupClaims = aggregateSignupClaims(allSignupResponses);
      }
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Event Header */}
      {event.cover_image_url && (
        <div className="rounded-2xl overflow-hidden mb-6 aspect-video">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.cover_image_url}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <h1 className="text-3xl font-bold mb-2">{event.title}</h1>
      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-2 text-gray-700">
          <span className="text-lg">📅</span>
          <span>
            {formatDate(event.start_time)} at {formatTime(event.start_time)}
            {event.end_time && ` — ${formatTime(event.end_time)}`}
          </span>
        </div>

        <EventLocation location={event.location} mapsLink={event.maps_url} />
      </div>

      <hr className="my-6" />

      <RSVPForm
        guest={guest}
        event={event}
        customFields={customFields}
        customResponses={customResponses}
        signupClaims={signupClaims}
      />
    </div>
  );
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
