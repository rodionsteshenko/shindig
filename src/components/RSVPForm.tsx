"use client";

import { useState } from "react";
import type { Guest, Event } from "@/lib/types";

interface RSVPFormProps {
  guest: Guest;
  event: Event;
}

export default function RSVPForm({ guest, event }: RSVPFormProps) {
  const [status, setStatus] = useState(guest.rsvp_status);
  const [plusOneCount, setPlusOneCount] = useState(guest.plus_one_count);
  const [dietary, setDietary] = useState(guest.dietary ?? "");
  const [message, setMessage] = useState(guest.message ?? "");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/rsvp/${guest.rsvp_token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rsvp_status: status,
        plus_one_count: status === "going" || status === "maybe" ? plusOneCount : 0,
        dietary: dietary || null,
        message: message || null,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    const emoji = status === "going" ? "🎉" : status === "maybe" ? "🤔" : "😢";
    const text =
      status === "going"
        ? "Awesome! You're in!"
        : status === "maybe"
        ? "Got it — we'll keep a spot for you."
        : "Sorry you can't make it!";

    return (
      <div className="text-center py-8">
        <div className="text-5xl mb-4">{emoji}</div>
        <h2 className="text-2xl font-bold mb-2">{text}</h2>
        <p className="text-gray-600">Your RSVP for {event.title} has been recorded.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
      <div>
        <p className="text-sm text-gray-500 mb-3">Responding as <strong>{guest.name}</strong></p>

        <div className="grid grid-cols-3 gap-3">
          {(["going", "maybe", "declined"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatus(option)}
              className={`py-3 rounded-xl font-semibold text-sm border-2 transition-colors ${
                status === option
                  ? option === "going"
                    ? "border-green-500 bg-green-50 text-green-700"
                    : option === "maybe"
                    ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                    : "border-red-500 bg-red-50 text-red-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {option === "going" ? "🎉 Going" : option === "maybe" ? "🤔 Maybe" : "😢 Can't"}
            </button>
          ))}
        </div>
      </div>

      {event.allow_plus_ones && (status === "going" || status === "maybe") && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bringing anyone? (+1s)
          </label>
          <select
            value={plusOneCount}
            onChange={(e) => setPlusOneCount(Number(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
          >
            <option value={0}>Just me</option>
            <option value={1}>+1</option>
            <option value={2}>+2</option>
            <option value={3}>+3</option>
          </select>
        </div>
      )}

      {(status === "going" || status === "maybe") && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dietary restrictions
          </label>
          <input
            type="text"
            value={dietary}
            onChange={(e) => setDietary(e.target.value)}
            placeholder="Vegetarian, gluten-free, allergies..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Message for the host
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Looking forward to it!"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none resize-y"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || status === "pending"}
        className="w-full bg-shindig-600 text-white py-3 rounded-xl font-semibold hover:bg-shindig-700 transition-colors disabled:opacity-50"
      >
        {loading ? "Sending..." : "Submit RSVP"}
      </button>
    </form>
  );
}
