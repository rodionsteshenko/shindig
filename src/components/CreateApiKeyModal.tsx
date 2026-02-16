"use client";

import { useState } from "react";
import type { ApiKey } from "@/lib/types";

interface CreateApiKeyModalProps {
  onClose: () => void;
  onCreated: (key: Omit<ApiKey, "key_hash" | "user_id">) => void;
}

const SCOPE_OPTIONS = [
  { value: "events:read", label: "Read Events" },
  { value: "events:write", label: "Write Events" },
  { value: "guests:read", label: "Read Guests" },
  { value: "guests:write", label: "Write Guests" },
  { value: "rsvp:read", label: "Read RSVP" },
  { value: "rsvp:write", label: "Write RSVP" },
] as const;

interface CreatedKeyResponse {
  id: string;
  key: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  expires_at: string | null;
  created_at: string;
}

export default function CreateApiKeyModal({
  onClose,
  onCreated,
}: CreateApiKeyModalProps) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([...SCOPE_OPTIONS.map((s) => s.value)]);
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<CreatedKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);

  function toggleScope(scope: string) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          scopes: scopes.length < 6 ? scopes : undefined,
          expires_at: expiresAt || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create API key");
        setLoading(false);
        return;
      }

      setCreatedKey(data.data);
      setLoading(false);
    } catch {
      setError("Failed to create API key");
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Failed to copy to clipboard");
    }
  }

  function handleDone() {
    if (!createdKey) return;
    onCreated({
      id: createdKey.id,
      name: createdKey.name,
      key_prefix: createdKey.key_prefix,
      scopes: createdKey.scopes,
      last_used_at: null,
      expires_at: createdKey.expires_at,
      created_at: createdKey.created_at,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-xl">
        {!createdKey ? (
          <>
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Create API Key</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Production Server"
                  required
                  maxLength={100}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scopes
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SCOPE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={scopes.includes(option.value)}
                        onChange={() => toggleScope(option.value)}
                        className="rounded border-gray-300 text-shindig-600 focus:ring-shindig-500"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiration (optional)
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty for no expiration
                </p>
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim() || scopes.length === 0}
                  className="bg-shindig-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-shindig-700 transition-colors disabled:opacity-50"
                >
                  {loading ? "Creating..." : "Create Key"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-green-700">API Key Created</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 font-medium mb-2">
                  Important: Copy your API key now
                </p>
                <p className="text-sm text-yellow-700">
                  This is the only time you'll see the full key. Store it securely -
                  you won't be able to retrieve it later.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your API Key
                </label>
                <div className="flex gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-100 border rounded-lg text-sm font-mono break-all">
                    {createdKey.key}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <p>
                  <strong>Name:</strong> {createdKey.name}
                </p>
                <p>
                  <strong>Scopes:</strong> {createdKey.scopes.join(", ")}
                </p>
                {createdKey.expires_at && (
                  <p>
                    <strong>Expires:</strong>{" "}
                    {new Date(createdKey.expires_at).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleDone}
                  className="bg-shindig-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-shindig-700 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
