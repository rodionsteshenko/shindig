"use client";

import { useState } from "react";
import type { Guest } from "@/lib/types";

interface GuestListProps {
  guests: Guest[];
  eventId: string;
}

const statusBadge: Record<string, { label: string; className: string }> = {
  going: { label: "Going", className: "bg-green-100 text-green-700" },
  maybe: { label: "Maybe", className: "bg-yellow-100 text-yellow-700" },
  declined: { label: "Declined", className: "bg-red-100 text-red-700" },
  pending: { label: "Pending", className: "bg-gray-100 text-gray-600" },
};

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
              <th className="py-2 pr-4 font-medium">Email</th>
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
                  <td className="py-2.5 pr-4 text-gray-600">{guest.email || "—"}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
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
