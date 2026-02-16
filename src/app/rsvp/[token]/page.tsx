import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatTime } from "@/lib/utils";
import RSVPForm from "@/components/RSVPForm";
import type { Guest, Event } from "@/lib/types";

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
      <p className="text-gray-600 mb-1">
        📅 {formatDate(event.start_time)} at {formatTime(event.start_time)}
      </p>
      {event.location && (
        <p className="text-gray-600 mb-6">📍 {event.location}</p>
      )}

      <hr className="my-6" />

      <RSVPForm guest={guest} event={event} />
    </div>
  );
}
