import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import RsvpStats from "@/components/RsvpStats";
import GuestList from "@/components/GuestList";
import GuestForm from "@/components/GuestForm";
import ExportCSVButton from "@/components/ExportCSVButton";
import ActionButton from "@/components/ActionButton";
import CustomFieldResults from "@/components/CustomFieldResults";
import type { Event, Guest, CustomField, CustomFieldResponse } from "@/lib/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EventDashboardPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("host_id", user.id)
    .single();

  if (!event) {
    notFound();
  }

  const { data: guests } = await supabase
    .from("guests")
    .select("*")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  // Fetch custom fields for this event (ordered by sort_order)
  const { data: customFields } = await supabase
    .from("event_custom_fields")
    .select("*")
    .eq("event_id", id)
    .order("sort_order", { ascending: true });

  // Fetch all custom field responses for this event's fields
  const fieldIds = (customFields ?? []).map((f) => f.id);
  let customResponses: CustomFieldResponse[] = [];
  if (fieldIds.length > 0) {
    const { data: responses } = await supabase
      .from("custom_field_responses")
      .select("*")
      .in("field_id", fieldIds);
    customResponses = (responses ?? []) as CustomFieldResponse[];
  }

  const e = event as Event;
  const guestList = (guests ?? []) as Guest[];
  const fieldList = (customFields ?? []) as CustomField[];

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-block">
            ← Back to events
          </Link>
          <h1 className="text-3xl font-bold">{e.title}</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/e/${e.slug}`}
            target="_blank"
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            View Public Page
          </Link>
          <Link
            href={`/dashboard/${e.id}/edit`}
            className="bg-shindig-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-shindig-700 transition-colors"
          >
            Edit Event
          </Link>
        </div>
      </div>

      {/* RSVP Stats */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">RSVP Summary</h2>
        <RsvpStats guests={guestList} />
      </section>

      {/* Add Guests */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Add Guests</h2>
        <GuestForm eventId={e.id} />
      </section>

      {/* Guest List */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Guest List ({guestList.length})</h2>
          {guestList.length > 0 && (
            <ExportCSVButton guests={guestList} eventTitle={e.title} />
          )}
        </div>
        <div className="bg-white rounded-xl border p-4">
          <GuestList guests={guestList} eventId={e.id} />
        </div>
      </section>

      {/* Custom Field Results */}
      <CustomFieldResults
        fields={fieldList}
        responses={customResponses}
        guests={guestList}
      />

      {/* Actions */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <ActionButton
            label="Send Invitations"
            endpoint={`/api/events/manage/${e.id}/invite`}
            disabled={guestList.length === 0}
            confirmMessage="Send email invitations to all guests?"
          />
          <ActionButton
            label="Send Reminders"
            endpoint={`/api/events/manage/${e.id}/remind`}
            disabled={!guestList.some((g) => g.rsvp_status === "pending")}
            confirmMessage="Send reminders to guests who haven't responded?"
          />
          <ActionButton
            label="Delete Event"
            endpoint={`/api/events/manage/${e.id}`}
            method="DELETE"
            confirmMessage="Are you sure you want to delete this event? This cannot be undone."
            variant="danger"
            redirectTo="/dashboard"
          />
        </div>
      </section>
    </div>
  );
}
