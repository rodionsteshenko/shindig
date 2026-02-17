import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTime, isUUID } from "@/lib/utils";
import EventLocation from "@/components/EventLocation";
import PublicCustomFields from "@/components/PublicCustomFields";
import type { Event } from "@/lib/types";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  // If UUID, look up by ID first
  if (isUUID(slug)) {
    const { data: eventById } = await supabase
      .from("events")
      .select("title, description, cover_image_url")
      .eq("id", slug)
      .eq("is_public", true)
      .single();

    if (eventById) {
      return {
        title: `${eventById.title} — Shindig`,
        description: eventById.description || `You're invited to ${eventById.title}`,
        openGraph: {
          title: eventById.title,
          description: eventById.description || `You're invited to ${eventById.title}`,
          images: eventById.cover_image_url ? [eventById.cover_image_url] : undefined,
        },
      };
    }
  }

  const { data: event } = await supabase
    .from("events")
    .select("title, description, cover_image_url")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (!event) return {};

  return {
    title: `${event.title} — Shindig`,
    description: event.description || `You're invited to ${event.title}`,
    openGraph: {
      title: event.title,
      description: event.description || `You're invited to ${event.title}`,
      images: event.cover_image_url ? [event.cover_image_url] : undefined,
    },
  };
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  // If the parameter is a UUID, redirect to the canonical slug URL
  if (isUUID(slug)) {
    const { data: eventById } = await supabase
      .from("events")
      .select("slug")
      .eq("id", slug)
      .eq("is_public", true)
      .single();

    if (eventById) {
      redirect(`/e/${eventById.slug}`);
    }
    // If no event found by ID, fall through to normal slug lookup (which will 404)
  }

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (!event) {
    notFound();
  }

  const e = event as Event;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Cover Image */}
      {e.cover_image_url && (
        <div className="rounded-2xl overflow-hidden mb-8 aspect-video">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={e.cover_image_url}
            alt={e.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Event Details */}
      <h1 className="text-4xl font-bold mb-4">{e.title}</h1>

      <div className="space-y-3 mb-8">
        <div className="flex items-center gap-2 text-gray-700">
          <span className="text-lg">📅</span>
          <span>
            {formatDate(e.start_time)} at {formatTime(e.start_time)}
            {e.end_time && ` — ${formatTime(e.end_time)}`}
          </span>
        </div>

        <EventLocation location={e.location} mapsLink={e.maps_url} />
      </div>

      {e.description && (
        <div className="prose max-w-none mb-8">
          <p className="text-gray-700 whitespace-pre-wrap">{e.description}</p>
        </div>
      )}

      {/* Poll Results & Signup Status */}
      <PublicCustomFields eventSlug={e.slug} />

      {/* Gift Info */}
      {(e.gift_registry_url || e.gift_message) && (
        <div className="bg-shindig-50 rounded-xl p-6 mb-8">
          <h3 className="font-semibold mb-2">🎁 Gifts</h3>
          {e.gift_message && <p className="text-gray-700 mb-2">{e.gift_message}</p>}
          {e.gift_registry_url && (
            <a
              href={e.gift_registry_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-shindig-600 hover:underline font-medium"
            >
              View Gift Registry →
            </a>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <Link
          href={`/api/events/${e.slug}/calendar`}
          className="border-2 border-gray-300 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:border-gray-400 transition-colors"
        >
          📅 Add to Calendar
        </Link>
      </div>
    </div>
  );
}
