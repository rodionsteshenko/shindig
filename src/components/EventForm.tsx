"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { coverPresets } from "@/lib/coverPresets";
import type { Event } from "@/lib/types";

interface EventFormProps {
  event?: Event;
}

export default function EventForm({ event }: EventFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [mapsUrl, setMapsUrl] = useState(event?.maps_url ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(event?.cover_image_url ?? "");
  const [startTime, setStartTime] = useState(
    event?.start_time ? toLocalDatetime(event.start_time) : ""
  );
  const [endTime, setEndTime] = useState(
    event?.end_time ? toLocalDatetime(event.end_time) : ""
  );
  const [timezone, setTimezone] = useState(
    event?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [isPublic, setIsPublic] = useState(event?.is_public ?? true);
  const [allowPlusOnes, setAllowPlusOnes] = useState(event?.allow_plus_ones ?? true);
  const [giftRegistryUrl, setGiftRegistryUrl] = useState(event?.gift_registry_url ?? "");
  const [giftMessage, setGiftMessage] = useState(event?.gift_message ?? "");

  function toLocalDatetime(iso: string): string {
    const d = new Date(iso);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const body = {
      title,
      description: description || null,
      location: location || null,
      maps_url: mapsUrl || null,
      cover_image_url: coverImageUrl || null,
      start_time: new Date(startTime).toISOString(),
      end_time: endTime ? new Date(endTime).toISOString() : null,
      timezone,
      is_public: isPublic,
      allow_plus_ones: allowPlusOnes,
      gift_registry_url: giftRegistryUrl || null,
      gift_message: giftMessage || null,
    };

    const url = event
      ? `/api/events/manage/${event.id}`
      : "/api/events";
    const method = event ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }

    if (event) {
      router.push(`/dashboard/${event.id}`);
    } else {
      router.push(`/dashboard/${data.id}`);
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Event Title *
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Summer BBQ, Birthday Party, Team Offsite..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Tell guests what to expect..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none resize-y"
        />
      </div>

      {/* Date/Time */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 mb-1">
            Start Date & Time *
          </label>
          <input
            id="start_time"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
          />
        </div>
        <div>
          <label htmlFor="end_time" className="block text-sm font-medium text-gray-700 mb-1">
            End Date & Time
          </label>
          <input
            id="end_time"
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
          Timezone
        </label>
        <input
          id="timezone"
          type="text"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Location */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="123 Main St or My Backyard"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
          />
        </div>
        <div>
          <label htmlFor="maps_url" className="block text-sm font-medium text-gray-700 mb-1">
            Maps Link
          </label>
          <input
            id="maps_url"
            type="url"
            value={mapsUrl}
            onChange={(e) => setMapsUrl(e.target.value)}
            placeholder="https://maps.google.com/..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Cover Image */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Cover Image
        </label>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {coverPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setCoverImageUrl(preset.url)}
              className={`relative rounded-lg overflow-hidden aspect-video border-2 transition-colors ${
                coverImageUrl === preset.url
                  ? "border-shindig-600"
                  : "border-transparent hover:border-gray-300"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preset.url}
                alt={preset.label}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs py-0.5 text-center">
                {preset.label}
              </span>
            </button>
          ))}
        </div>
        <input
          type="url"
          value={coverImageUrl}
          onChange={(e) => setCoverImageUrl(e.target.value)}
          placeholder="Or paste a custom image URL"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Options */}
      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="rounded border-gray-300 text-shindig-600 focus:ring-shindig-500"
          />
          <span className="text-sm text-gray-700">Public event page</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allowPlusOnes}
            onChange={(e) => setAllowPlusOnes(e.target.checked)}
            className="rounded border-gray-300 text-shindig-600 focus:ring-shindig-500"
          />
          <span className="text-sm text-gray-700">Allow plus-ones</span>
        </label>
      </div>

      {/* Gift Settings */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="gift_registry_url" className="block text-sm font-medium text-gray-700 mb-1">
            Gift Registry URL
          </label>
          <input
            id="gift_registry_url"
            type="url"
            value={giftRegistryUrl}
            onChange={(e) => setGiftRegistryUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
          />
        </div>
        <div>
          <label htmlFor="gift_message" className="block text-sm font-medium text-gray-700 mb-1">
            Gift Message
          </label>
          <input
            id="gift_message"
            type="text"
            value={giftMessage}
            onChange={(e) => setGiftMessage(e.target.value)}
            placeholder="No gifts please! / Registry link above"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="bg-shindig-600 text-white px-8 py-2.5 rounded-lg font-semibold hover:bg-shindig-700 transition-colors disabled:opacity-50"
      >
        {loading ? "Saving..." : event ? "Update Event" : "Create Event"}
      </button>
    </form>
  );
}
