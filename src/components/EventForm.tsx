"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { coverPresets } from "@/lib/coverPresets";
import type { Event } from "@/lib/types";

interface EventFormProps {
  event?: Event;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
  const [mapsUrlError, setMapsUrlError] = useState<string | null>(null);

  // Custom slug state
  const [customSlug, setCustomSlug] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const slugCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  function toLocalDatetime(iso: string): string {
    const d = new Date(iso);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  }

  function validateMapsUrl(url: string): boolean {
    if (!url.trim()) return true; // Empty is valid (optional field)
    if (!url.startsWith("https://")) {
      setMapsUrlError("Maps link must start with https://");
      return false;
    }
    setMapsUrlError(null);
    return true;
  }

  // Validate slug format locally
  function validateSlugFormat(slug: string): string | null {
    if (!slug.trim()) return null; // Empty is valid (optional field)
    if (slug.length < 3) return "URL must be at least 3 characters";
    if (slug.length > 60) return "URL must be 60 characters or less";
    if (!SLUG_RE.test(slug)) return "URL can only contain lowercase letters, numbers, and hyphens";
    return null;
  }

  // Check slug availability with debounce
  const checkSlugAvailability = useCallback(async (slug: string) => {
    if (!slug.trim()) {
      setSlugAvailable(null);
      setSlugError(null);
      return;
    }

    const formatError = validateSlugFormat(slug);
    if (formatError) {
      setSlugError(formatError);
      setSlugAvailable(null);
      return;
    }

    setSlugChecking(true);
    setSlugError(null);

    try {
      const res = await fetch(`/api/events/check-slug?slug=${encodeURIComponent(slug)}`);
      const data = await res.json();

      if (data.error) {
        setSlugError(data.error);
        setSlugAvailable(false);
      } else {
        setSlugAvailable(data.available);
        if (!data.available) {
          setSlugError("This URL is already taken");
        }
      }
    } catch {
      setSlugError("Failed to check URL availability");
      setSlugAvailable(null);
    } finally {
      setSlugChecking(false);
    }
  }, []);

  // Handle slug input change with debounce
  function handleSlugChange(value: string) {
    // Normalize input: lowercase and replace spaces with hyphens
    const normalized = value.toLowerCase().replace(/\s+/g, "-");
    setCustomSlug(normalized);
    setSlugAvailable(null);

    // Clear any pending timeout
    if (slugCheckTimeoutRef.current) {
      clearTimeout(slugCheckTimeoutRef.current);
    }

    // Debounce the availability check
    if (normalized.trim()) {
      const formatError = validateSlugFormat(normalized);
      if (formatError) {
        setSlugError(formatError);
      } else {
        setSlugError(null);
        slugCheckTimeoutRef.current = setTimeout(() => {
          checkSlugAvailability(normalized);
        }, 500);
      }
    } else {
      setSlugError(null);
    }
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (slugCheckTimeoutRef.current) {
        clearTimeout(slugCheckTimeoutRef.current);
      }
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate maps URL before submission
    if (!validateMapsUrl(mapsUrl)) {
      return;
    }

    // Validate custom slug if provided
    if (customSlug.trim()) {
      const formatError = validateSlugFormat(customSlug);
      if (formatError) {
        setSlugError(formatError);
        return;
      }
      if (slugAvailable === false) {
        setSlugError("This URL is already taken");
        return;
      }
    }

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
      slug: customSlug.trim() || null,
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

      {/* Custom URL (only for new events) */}
      {!event && (
        <div>
          <label htmlFor="custom_slug" className="block text-sm font-medium text-gray-700 mb-1">
            Custom URL
          </label>
          <div className="flex items-center">
            <span className="text-gray-500 text-sm mr-1">shindig.app/e/</span>
            <input
              id="custom_slug"
              type="text"
              value={customSlug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="my-awesome-party"
              className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none ${
                slugError ? "border-red-500" : slugAvailable === true ? "border-green-500" : "border-gray-300"
              }`}
            />
            {slugChecking && (
              <span className="ml-2 text-gray-500 text-sm">Checking...</span>
            )}
            {!slugChecking && slugAvailable === true && (
              <span className="ml-2 text-green-600 text-sm">Available</span>
            )}
          </div>
          {slugError && (
            <p className="text-red-600 text-sm mt-1">{slugError}</p>
          )}
          <p className="text-gray-500 text-xs mt-1">
            Optional. Use lowercase letters, numbers, and hyphens. Leave blank for an auto-generated URL.
          </p>
        </div>
      )}

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
            Location / Address
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
            Google Maps Link
          </label>
          <input
            id="maps_url"
            type="url"
            value={mapsUrl}
            onChange={(e) => {
              setMapsUrl(e.target.value);
              if (mapsUrlError) validateMapsUrl(e.target.value);
            }}
            onBlur={() => validateMapsUrl(mapsUrl)}
            placeholder="https://maps.google.com/..."
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none ${
              mapsUrlError ? "border-red-500" : "border-gray-300"
            }`}
          />
          {mapsUrlError && (
            <p className="text-red-600 text-sm mt-1">{mapsUrlError}</p>
          )}
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
