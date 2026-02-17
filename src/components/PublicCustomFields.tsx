"use client";

import { useEffect, useState } from "react";

/**
 * Types for the API response from /api/events/[slug]/custom-fields
 */
interface PollResult {
  field_id: string;
  label: string;
  description: string | null;
  options: string[];
  multi_select: boolean;
  votes: Record<string, number>;
  total_votes: number;
}

interface SignupResult {
  field_id: string;
  label: string;
  description: string | null;
  options: string[];
  max_claims_per_item: number;
  claims: Record<string, number>;
}

interface CustomFieldsData {
  polls: PollResult[];
  signups: SignupResult[];
}

interface PublicCustomFieldsProps {
  eventSlug: string;
}

/**
 * Displays public poll results and signup status for an event.
 * Fetches data from the custom-fields API endpoint.
 * Renders nothing if the event has no poll or signup fields.
 */
export default function PublicCustomFields({ eventSlug }: PublicCustomFieldsProps) {
  const [data, setData] = useState<CustomFieldsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCustomFields() {
      try {
        const response = await fetch(`/api/events/${eventSlug}/custom-fields`);
        if (!response.ok) {
          if (response.status === 404) {
            // Event not found - just don't render anything
            setData({ polls: [], signups: [] });
            return;
          }
          throw new Error("Failed to fetch custom fields");
        }
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchCustomFields();
  }, [eventSlug]);

  // Loading state - return null to avoid layout shift
  if (loading) {
    return null;
  }

  // Error state - silently fail (don't show errors on public page)
  if (error || !data) {
    return null;
  }

  // No poll or signup fields - render nothing
  if (data.polls.length === 0 && data.signups.length === 0) {
    return null;
  }

  return (
    <section className="mb-8" data-testid="public-custom-fields">
      <div className="space-y-6">
        {/* Poll Results */}
        {data.polls.map((poll) => (
          <PollResultsDisplay key={poll.field_id} poll={poll} />
        ))}

        {/* Signup Status */}
        {data.signups.map((signup) => (
          <SignupStatusDisplay key={signup.field_id} signup={signup} />
        ))}
      </div>
    </section>
  );
}

interface PollResultsDisplayProps {
  poll: PollResult;
}

function PollResultsDisplay({ poll }: PollResultsDisplayProps) {
  // Don't show polls with no votes
  if (poll.total_votes === 0) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-gray-900 mb-1">📊 {poll.label}</h3>
        {poll.description && (
          <p className="text-sm text-gray-500 mb-3">{poll.description}</p>
        )}
        <p className="text-sm text-gray-400 italic">No votes yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-6">
      <h3 className="font-semibold text-gray-900 mb-1">📊 {poll.label}</h3>
      {poll.description && (
        <p className="text-sm text-gray-500 mb-3">{poll.description}</p>
      )}

      <div className="space-y-3">
        {poll.options.map((option) => {
          const count = poll.votes[option] || 0;
          const percentage = poll.total_votes > 0
            ? Math.round((count / poll.total_votes) * 100)
            : 0;

          return (
            <div key={option}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700">{option}</span>
                <span className="text-gray-500">
                  {count} vote{count !== 1 ? "s" : ""} ({percentage}%)
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-shindig-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                  role="progressbar"
                  aria-valuenow={percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${option}: ${percentage}%`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Total: {poll.total_votes} response{poll.total_votes !== 1 ? "s" : ""}
        {poll.multi_select ? " (multi-select)" : ""}
      </p>
    </div>
  );
}

interface SignupStatusDisplayProps {
  signup: SignupResult;
}

function SignupStatusDisplay({ signup }: SignupStatusDisplayProps) {
  // Check if any items have claims
  const hasAnyClaims = Object.values(signup.claims).some((count) => count > 0);

  return (
    <div className="bg-white rounded-xl border p-6">
      <h3 className="font-semibold text-gray-900 mb-1">📝 {signup.label}</h3>
      {signup.description && (
        <p className="text-sm text-gray-500 mb-3">{signup.description}</p>
      )}

      {!hasAnyClaims ? (
        <p className="text-sm text-gray-400 italic">No signups yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4 font-medium">Item</th>
                <th className="py-2 font-medium">Availability</th>
              </tr>
            </thead>
            <tbody>
              {signup.options.map((option) => {
                const claimedCount = signup.claims[option] || 0;
                const spotsLeft = signup.max_claims_per_item - claimedCount;
                const isFull = spotsLeft <= 0;

                return (
                  <tr key={option} className="border-b last:border-0">
                    <td className="py-2.5 pr-4 font-medium">{option}</td>
                    <td className="py-2.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          isFull
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {isFull
                          ? "Full"
                          : `${spotsLeft} of ${signup.max_claims_per_item} available`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
