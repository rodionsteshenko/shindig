"use client";

import { useState } from "react";
import type { Guest } from "@/lib/types";
import { formatNational } from "@/lib/phone";

interface GuestListProps {
  guests: Guest[];
  eventId: string;
}

/**
 * Phone icon SVG component for SMS-invited guests
 */
function PhoneIcon({ className, "data-testid": testId }: { className?: string; "data-testid"?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      data-testid={testId}
    >
      <path
        fillRule="evenodd"
        d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 006.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 012.43 8.326 13.019 13.019 0 012 5V3.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const statusBadge: Record<string, { label: string; className: string }> = {
  going: { label: "Going", className: "bg-green-100 text-green-700" },
  maybe: { label: "Maybe", className: "bg-yellow-100 text-yellow-700" },
  declined: { label: "Declined", className: "bg-red-100 text-red-700" },
  pending: { label: "Pending", className: "bg-gray-100 text-gray-600" },
};

/**
 * Format a timestamp as a relative time (e.g., "2d ago", "3h ago")
 */
function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHour > 0) return `${diffHour}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return "just now";
}

type SortKey = "name" | "rsvp_status" | "created_at";

export default function GuestList({ guests, eventId }: GuestListProps) {
  const [sortBy, setSortBy] = useState<SortKey>("created_at");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filtered = filterStatus === "all"
    ? guests
    : guests.filter((g) => g.rsvp_status === filterStatus);

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "rsvp_status") return a.rsvp_status.localeCompare(b.rsvp_status);
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  if (guests.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No guests yet. Add some above!
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {["all", "going", "maybe", "declined", "pending"].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
              filterStatus === status
                ? "bg-shindig-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {status === "all" ? "All" : statusBadge[status].label}
            {status === "all"
              ? ` (${guests.length})`
              : ` (${guests.filter((g) => g.rsvp_status === status).length})`}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
        <span>Sort by:</span>
        {(["created_at", "name", "rsvp_status"] as SortKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`${sortBy === key ? "text-shindig-600 font-medium" : "hover:text-gray-700"}`}
          >
            {key === "created_at" ? "Date Added" : key === "name" ? "Name" : "Status"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Contact</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">+1s</th>
              <th className="py-2 pr-4 font-medium">Dietary</th>
              <th className="py-2 font-medium">RSVP Link</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((guest) => {
              const badge = statusBadge[guest.rsvp_status];
              return (
                <tr key={guest.id} className="border-b last:border-0">
                  <td className="py-2.5 pr-4 font-medium">{guest.name}</td>
                  <td className="py-2.5 pr-4 text-gray-600">
                    {guest.email ? (
                      guest.email
                    ) : guest.phone ? (
                      <span className="inline-flex items-center gap-1.5">
                        {guest.invited_at && (
                          <PhoneIcon
                            className="w-4 h-4 text-shindig-600"
                            data-testid="sms-invited-indicator"
                          />
                        )}
                        <span>{formatNational(guest.phone)}</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                    {guest.reminded_at && (
                      <span
                        className="ml-2 inline-flex items-center text-xs text-shindig-600"
                        title={`Reminded ${new Date(guest.reminded_at).toLocaleString()}`}
                        data-testid="reminded-indicator"
                      >
                        <span className="w-1.5 h-1.5 bg-shindig-500 rounded-full mr-1" />
                        Reminded {formatRelativeTime(guest.reminded_at)}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600">
                    {guest.plus_one_count > 0 ? `+${guest.plus_one_count}` : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600">{guest.dietary || "—"}</td>
                  <td className="py-2.5">
                    <button
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/rsvp/${guest.rsvp_token}`)}
                      className="text-shindig-600 hover:text-shindig-700 text-xs font-medium"
                      title="Copy RSVP link"
                    >
                      Copy Link
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
