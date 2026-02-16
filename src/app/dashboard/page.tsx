import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import EventCard from "@/components/EventCard";
import type { Event } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("host_id", user.id)
    .order("start_time", { ascending: false });

  // Get guest counts per event
  const eventIds = (events ?? []).map((e: Event) => e.id);
  let guestCounts: Record<string, { total: number; going: number }> = {};

  if (eventIds.length > 0) {
    const { data: guests } = await supabase
      .from("guests")
      .select("event_id, rsvp_status")
      .in("event_id", eventIds);

    if (guests) {
      for (const g of guests) {
        if (!guestCounts[g.event_id]) {
          guestCounts[g.event_id] = { total: 0, going: 0 };
        }
        guestCounts[g.event_id].total++;
        if (g.rsvp_status === "going") {
          guestCounts[g.event_id].going++;
        }
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Your Events</h1>
        <Link
          href="/create"
          className="bg-shindig-600 text-white px-5 py-2 rounded-lg font-semibold text-sm hover:bg-shindig-700 transition-colors"
        >
          + New Event
        </Link>
      </div>

      {!events || events.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-xl font-semibold mb-2">No events yet</h2>
          <p className="text-gray-600 mb-6">Create your first event to get started!</p>
          <Link
            href="/create"
            className="bg-shindig-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-shindig-700 transition-colors"
          >
            Create an Event
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {(events as Event[]).map((event) => (
            <EventCard
              key={event.id}
              event={event}
              guestCount={guestCounts[event.id]?.total ?? 0}
              goingCount={guestCounts[event.id]?.going ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
