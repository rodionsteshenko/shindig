"use client";

import { useState } from "react";
import type { Guest, Event, CustomField, CustomFieldResponse } from "@/lib/types";
import CustomFieldInput, { type SignupClaims } from "./CustomFieldInput";

interface RSVPFormProps {
  guest: Guest;
  event: Event;
  customFields?: CustomField[];
  customResponses?: CustomFieldResponse[];
  signupClaims?: SignupClaims;
}

export default function RSVPForm({
  guest,
  event,
  customFields = [],
  customResponses = [],
  signupClaims = {},
}: RSVPFormProps) {
  const [status, setStatus] = useState(guest.rsvp_status);
  const [plusOneCount, setPlusOneCount] = useState(guest.plus_one_count);
  const [dietary, setDietary] = useState(guest.dietary ?? "");
  const [message, setMessage] = useState(guest.message ?? "");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Initialize custom field values from existing responses
  const [customValues, setCustomValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const resp of customResponses) {
      initial[resp.field_id] = resp.value ?? "";
    }
    return initial;
  });

  function handleCustomFieldChange(fieldId: string, value: string) {
    setCustomValues((prev) => ({ ...prev, [fieldId]: value }));
    // Clear validation error when user starts typing
    if (validationErrors[fieldId]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  }

  // Validate required custom fields before submission
  function validateCustomFields(): boolean {
    const errors: Record<string, string> = {};
    const showCustomFields = status === "going" || status === "maybe";

    if (showCustomFields) {
      for (const field of customFields) {
        if (field.required) {
          const value = customValues[field.id]?.trim();
          if (!value) {
            errors[field.id] = `${field.label} is required`;
          }
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate custom fields before submitting
    if (!validateCustomFields()) {
      return;
    }

    setLoading(true);
    setError(null);

    // Build custom_responses array for the API
    const showCustomFields = status === "going" || status === "maybe";
    const customResponsesPayload = showCustomFields
      ? customFields.map((field) => ({
          field_id: field.id,
          value: customValues[field.id] || null,
        }))
      : [];

    const res = await fetch(`/api/rsvp/${guest.rsvp_token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rsvp_status: status,
        plus_one_count: status === "going" || status === "maybe" ? plusOneCount : 0,
        dietary: dietary || null,
        message: message || null,
        custom_responses: customResponsesPayload,
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

      {/* Custom Fields - only shown when going or maybe */}
      {(status === "going" || status === "maybe") && customFields.length > 0 && (
        <div className="space-y-4 pt-2">
          <hr className="border-gray-200" />
          {customFields.map((field) => (
            <div key={field.id}>
              <CustomFieldInput
                field={field}
                value={customValues[field.id] ?? ""}
                onChange={(value) => handleCustomFieldChange(field.id, value)}
                signupClaims={signupClaims}
              />
              {validationErrors[field.id] && (
                <p className="text-red-600 text-sm mt-1">{validationErrors[field.id]}</p>
              )}
            </div>
          ))}
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
