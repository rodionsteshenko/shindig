import Link from "next/link";
import { formatDate, formatTime } from "@/lib/utils";
import type { Event } from "@/lib/types";

interface EventCardProps {
  event: Event;
  guestCount?: number;
  goingCount?: number;
}

export default function EventCard({ event, guestCount = 0, goingCount = 0 }: EventCardProps) {
  const isPast = new Date(event.start_time) < new Date();

  return (
    <Link
      href={`/dashboard/${event.id}`}
      className="block bg-white rounded-xl border hover:border-shindig-300 transition-colors overflow-hidden"
    >
      {event.cover_image_url && (
        <div className="aspect-[3/1] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.cover_image_url}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-lg font-semibold">{event.title}</h3>
          {isPast && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full whitespace-nowrap">
              Past
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 mb-3">
          {formatDate(event.start_time)} at {formatTime(event.start_time)}
        </p>
        <div className="flex gap-4 text-sm text-gray-500">
          <span>{guestCount} guests</span>
          <span>{goingCount} going</span>
        </div>
      </div>
    </Link>
  );
}
