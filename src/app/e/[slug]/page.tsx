import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTime } from "@/lib/utils";
import type { Event } from "@/lib/types";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
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

        {e.location && (
          <div className="flex items-start gap-2 text-gray-700">
            {/* Map Pin Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5 flex-shrink-0 mt-0.5 text-shindig-600"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
              />
            </svg>
            {e.maps_url ? (
              <a
                href={e.maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-shindig-600 hover:underline break-words"
              >
                {e.location}
              </a>
            ) : (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-shindig-600 hover:underline break-words"
              >
                {e.location}
              </a>
            )}
          </div>
        )}
      </div>

      {e.description && (
        <div className="prose max-w-none mb-8">
          <p className="text-gray-700 whitespace-pre-wrap">{e.description}</p>
        </div>
      )}

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
