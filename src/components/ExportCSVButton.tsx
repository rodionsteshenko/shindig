"use client";

import type { Guest } from "@/lib/types";

interface ExportCSVButtonProps {
  guests: Guest[];
  eventTitle: string;
}

export default function ExportCSVButton({ guests, eventTitle }: ExportCSVButtonProps) {
  function handleExport() {
    const headers = ["Name", "Email", "Phone", "Status", "Plus Ones", "Dietary", "Message", "Responded At"];
    const rows = guests.map((g) => [
      g.name,
      g.email || "",
      g.phone || "",
      g.rsvp_status,
      String(g.plus_one_count),
      g.dietary || "",
      g.message || "",
      g.responded_at || "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${eventTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-guests.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
    >
      Export CSV
    </button>
  );
}
