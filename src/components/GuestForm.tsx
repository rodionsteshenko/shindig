"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseGuestCSV } from "@/lib/csvParser";

interface GuestFormProps {
  eventId: string;
}

export default function GuestForm({ eventId }: GuestFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"manual" | "csv">("manual");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/events/manage/${eventId}/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guests: [{ name, email, phone: phone || undefined }] }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to add guest");
      return;
    }

    setName("");
    setEmail("");
    setPhone("");
    router.refresh();
  }

  async function handleCSVImport() {
    const guests = parseGuestCSV(csvText);
    if (guests.length === 0) {
      setError("No valid guests found in CSV. Format: name, email, phone (optional)");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch(`/api/events/manage/${eventId}/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guests }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to import guests");
      return;
    }

    setCsvText("");
    router.refresh();
  }

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex gap-4 mb-4">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`text-sm font-medium px-3 py-1 rounded-full ${
            mode === "manual"
              ? "bg-shindig-100 text-shindig-700"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Add Manually
        </button>
        <button
          type="button"
          onClick={() => setMode("csv")}
          className={`text-sm font-medium px-3 py-1 rounded-full ${
            mode === "csv"
              ? "bg-shindig-100 text-shindig-700"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Import CSV
        </button>
      </div>

      {mode === "manual" ? (
        <form onSubmit={handleManualSubmit} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-gray-500 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Jane Doe"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-gray-500 mb-1">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="jane@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs text-gray-500 mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555-0123"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-shindig-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-shindig-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add Guest"}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={6}
            placeholder={"name, email, phone\nJane Doe, jane@example.com, +1 555-0123\nJohn Smith, john@example.com"}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none resize-y"
          />
          <button
            type="button"
            onClick={handleCSVImport}
            disabled={loading || !csvText.trim()}
            className="bg-shindig-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-shindig-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Importing..." : "Import Guests"}
          </button>
        </div>
      )}

      {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
    </div>
  );
}
