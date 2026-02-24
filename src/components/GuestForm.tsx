"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { parseGuestCSV, formatCSVErrors } from "@/lib/csvParser";
import {
  getCountryOptions,
  formatAsYouType,
  type CountryCode,
  DEFAULT_COUNTRY,
} from "@/lib/phone";

interface GuestFormProps {
  eventId: string;
}

export default function GuestForm({ eventId }: GuestFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"manual" | "csv">("manual");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvWarning, setCsvWarning] = useState<string | null>(null);

  // Get country options for the selector
  const countryOptions = useMemo(() => getCountryOptions(), []);

  // Format phone as user types
  const formattedPhone = useMemo(() => {
    if (!phone) return "";
    return formatAsYouType(phone, countryCode);
  }, [phone, countryCode]);

  // Handle phone input change - store raw digits only
  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Extract digits only (and leading + if present)
    const value = e.target.value;
    // Allow digits, spaces, dashes, parens, dots for user convenience
    // The actual value will be normalized on submit
    setPhone(value);
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/events/manage/${eventId}/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guests: [{
          name,
          email: email || undefined,
          phone: phone || undefined,
          countryCode, // Send country code for server-side normalization
        }],
        defaultCountry: countryCode,
      }),
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
    const result = parseGuestCSV(csvText, countryCode);
    setCsvWarning(null);

    if (result.guests.length === 0 && result.errors.length === 0) {
      setError("No valid guests found in CSV. Format: name, email, phone (optional)");
      return;
    }

    if (result.guests.length === 0) {
      setError(formatCSVErrors(result.errors));
      return;
    }

    // Show warning for skipped rows but proceed with valid ones
    if (result.errors.length > 0) {
      setCsvWarning(formatCSVErrors(result.errors));
    }

    setLoading(true);
    setError(null);

    const res = await fetch(`/api/events/manage/${eventId}/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guests: result.guests }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to import guests");
      return;
    }

    setCsvText("");
    setCsvWarning(null);
    router.refresh();
  }

  // Find current country for display
  const currentCountry = countryOptions.find(c => c.code === countryCode);

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
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1">Phone</label>
            <div className="flex gap-1">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value as CountryCode)}
                className="w-[90px] px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none bg-white"
                aria-label="Country code"
              >
                {countryOptions.slice(0, 15).map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.code} {country.dialCode}
                  </option>
                ))}
                <option disabled>──────────</option>
                {countryOptions.slice(15).map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.code} {country.dialCode}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                value={formattedPhone}
                onChange={handlePhoneChange}
                placeholder="(555) 123-4567"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
              />
            </div>
            {phone && currentCountry && (
              <p className="text-xs text-gray-400 mt-1">
                {currentCountry.name} ({currentCountry.dialCode})
              </p>
            )}
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
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-gray-500">Default country for phone numbers:</label>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value as CountryCode)}
              className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none bg-white"
              aria-label="Default country code for CSV import"
            >
              {countryOptions.slice(0, 15).map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name} ({country.dialCode})
                </option>
              ))}
              <option disabled>──────────</option>
              {countryOptions.slice(15).map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name} ({country.dialCode})
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={6}
            placeholder={"name, email, phone\nJane Doe, jane@example.com, (555) 123-4567\nJohn Smith, john@example.com, +44 20 7946 0958"}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none resize-y"
          />
          <p className="text-xs text-gray-400">
            Phone numbers will be validated and normalized. Rows with invalid phone numbers will be skipped.
          </p>
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

      {csvWarning && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg p-3 mt-3 whitespace-pre-wrap">
          {csvWarning}
        </div>
      )}
      {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
    </div>
  );
}
