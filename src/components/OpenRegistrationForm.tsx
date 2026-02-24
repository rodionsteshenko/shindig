"use client";

import { useState } from "react";

interface OpenRegistrationFormProps {
  eventSlug: string;
}

export default function OpenRegistrationForm({ eventSlug }: OpenRegistrationFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ rsvp_token: string; rsvp_url: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/events/${eventSlug}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }

    setResult({ rsvp_token: data.rsvp_token, rsvp_url: data.rsvp_url });
  }

  if (result) {
    return (
      <div className="text-center py-4">
        <div className="text-4xl mb-3">🎉</div>
        <h3 className="text-xl font-bold mb-2">You&apos;re registered!</h3>
        <p className="text-gray-600 mb-4">
          Bookmark your personal RSVP link to update your response later.
        </p>
        <a
          href={result.rsvp_url}
          className="inline-block bg-shindig-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-shindig-700 transition-colors"
        >
          View My RSVP
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700 mb-1">
          Your Name *
        </label>
        <input
          id="reg-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Jane Smith"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="reg-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
          />
        </div>
        <div>
          <label htmlFor="reg-phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            id="reg-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="w-full bg-shindig-600 text-white py-3 rounded-xl font-semibold hover:bg-shindig-700 transition-colors disabled:opacity-50"
      >
        {loading ? "Registering..." : "Count Me In!"}
      </button>
    </form>
  );
}
