"use client";

import type { CustomField, CustomFieldConfig, CustomFieldResponse, Guest } from "@/lib/types";

interface GuestMap {
  [guestId: string]: Guest;
}

interface CustomFieldResultsProps {
  fields: CustomField[];
  responses: CustomFieldResponse[];
  guests: Guest[];
}

/**
 * Displays aggregated results for all custom fields on the event dashboard.
 * - Text fields: table with Guest Name, Response
 * - Poll fields: horizontal progress bars with vote distribution
 * - Signup fields: table with Item, Claimed By, Spots Left
 */
export default function CustomFieldResults({
  fields,
  responses,
  guests,
}: CustomFieldResultsProps) {
  // If no custom fields, don't render anything
  if (fields.length === 0) {
    return null;
  }

  // Build a map of guest ID to guest for quick lookup
  const guestMap: GuestMap = {};
  for (const guest of guests) {
    guestMap[guest.id] = guest;
  }

  // Group responses by field_id for easier lookup
  const responsesByField: Record<string, CustomFieldResponse[]> = {};
  for (const response of responses) {
    if (!responsesByField[response.field_id]) {
      responsesByField[response.field_id] = [];
    }
    responsesByField[response.field_id].push(response);
  }

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-4">Custom Field Results</h2>
      <div className="space-y-6">
        {fields.map((field) => {
          const fieldResponses = responsesByField[field.id] || [];
          return (
            <div key={field.id} className="bg-white rounded-xl border p-4">
              <FieldResult
                field={field}
                responses={fieldResponses}
                guestMap={guestMap}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

interface FieldResultProps {
  field: CustomField;
  responses: CustomFieldResponse[];
  guestMap: GuestMap;
}

function FieldResult({ field, responses, guestMap }: FieldResultProps) {
  const config = field.config as CustomFieldConfig;

  return (
    <div>
      <h3 className="font-medium text-gray-900 mb-1">{field.label}</h3>
      {field.description && (
        <p className="text-sm text-gray-500 mb-3">{field.description}</p>
      )}

      {field.type === "text" && (
        <TextFieldResults responses={responses} guestMap={guestMap} />
      )}

      {field.type === "poll" && (
        <PollFieldResults
          options={field.options || []}
          responses={responses}
          multiSelect={config.multi_select ?? false}
        />
      )}

      {field.type === "signup" && (
        <SignupFieldResults
          options={field.options || []}
          responses={responses}
          guestMap={guestMap}
          maxClaimsPerItem={config.max_claims_per_item ?? 1}
        />
      )}
    </div>
  );
}

interface TextFieldResultsProps {
  responses: CustomFieldResponse[];
  guestMap: GuestMap;
}

function TextFieldResults({ responses, guestMap }: TextFieldResultsProps) {
  // Filter out empty responses
  const nonEmptyResponses = responses.filter((r) => r.value && r.value.trim() !== "");

  if (nonEmptyResponses.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">No responses yet</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2 pr-4 font-medium">Guest Name</th>
            <th className="py-2 font-medium">Response</th>
          </tr>
        </thead>
        <tbody>
          {nonEmptyResponses.map((response) => {
            const guest = guestMap[response.guest_id];
            return (
              <tr key={response.id} className="border-b last:border-0">
                <td className="py-2.5 pr-4 font-medium">
                  {guest?.name || "Unknown Guest"}
                </td>
                <td className="py-2.5 text-gray-600">{response.value}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface PollFieldResultsProps {
  options: string[];
  responses: CustomFieldResponse[];
  multiSelect: boolean;
}

function PollFieldResults({ options, responses, multiSelect }: PollFieldResultsProps) {
  // Count votes for each option
  const voteCounts: Record<string, number> = {};
  for (const option of options) {
    voteCounts[option] = 0;
  }

  // Count responses, handling multi-select (comma-separated values)
  for (const response of responses) {
    if (!response.value) continue;

    if (multiSelect) {
      // Split comma-separated values
      const values = response.value.split(",").map((v) => v.trim()).filter(Boolean);
      for (const value of values) {
        if (voteCounts[value] !== undefined) {
          voteCounts[value]++;
        }
      }
    } else {
      const value = response.value.trim();
      if (voteCounts[value] !== undefined) {
        voteCounts[value]++;
      }
    }
  }

  // Calculate total votes
  const totalVotes = Object.values(voteCounts).reduce((sum, count) => sum + count, 0);

  if (totalVotes === 0) {
    return (
      <p className="text-sm text-gray-400 italic">No votes yet</p>
    );
  }

  return (
    <div className="space-y-3">
      {options.map((option) => {
        const count = voteCounts[option];
        const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

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
      <p className="text-xs text-gray-400 mt-2">
        Total: {totalVotes} response{totalVotes !== 1 ? "s" : ""}
        {multiSelect ? " (multi-select)" : ""}
      </p>
    </div>
  );
}

interface SignupFieldResultsProps {
  options: string[];
  responses: CustomFieldResponse[];
  guestMap: GuestMap;
  maxClaimsPerItem: number;
}

function SignupFieldResults({
  options,
  responses,
  guestMap,
  maxClaimsPerItem,
}: SignupFieldResultsProps) {
  // Build a map of option -> guest names who claimed it
  const claimsByOption: Record<string, string[]> = {};
  for (const option of options) {
    claimsByOption[option] = [];
  }

  // Process responses (comma-separated for multi-select)
  for (const response of responses) {
    if (!response.value) continue;

    const values = response.value.split(",").map((v) => v.trim()).filter(Boolean);
    const guest = guestMap[response.guest_id];
    const guestName = guest?.name || "Unknown Guest";

    for (const value of values) {
      if (claimsByOption[value]) {
        claimsByOption[value].push(guestName);
      }
    }
  }

  // Check if any options have claims
  const hasAnyClaims = Object.values(claimsByOption).some((claims) => claims.length > 0);

  if (!hasAnyClaims) {
    return (
      <p className="text-sm text-gray-400 italic">No signups yet</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2 pr-4 font-medium">Item</th>
            <th className="py-2 pr-4 font-medium">Claimed By</th>
            <th className="py-2 font-medium">Spots Left</th>
          </tr>
        </thead>
        <tbody>
          {options.map((option) => {
            const claims = claimsByOption[option];
            const claimedCount = claims.length;
            const spotsLeft = maxClaimsPerItem - claimedCount;
            const isFull = spotsLeft <= 0;

            return (
              <tr key={option} className="border-b last:border-0">
                <td className="py-2.5 pr-4 font-medium">{option}</td>
                <td className="py-2.5 pr-4 text-gray-600">
                  {claims.length > 0 ? claims.join(", ") : "—"}
                </td>
                <td className="py-2.5">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      isFull
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {isFull ? "Full" : `${spotsLeft} / ${maxClaimsPerItem}`}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
