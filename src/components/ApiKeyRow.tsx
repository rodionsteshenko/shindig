"use client";

import { useState } from "react";
import type { ApiKey } from "@/lib/types";

interface ApiKeyRowProps {
  apiKey: Omit<ApiKey, "key_hash" | "user_id">;
  onRevoked: () => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatScopes(scopes: string[]): string {
  if (scopes.length === 6) return "Full access";
  const scopeGroups = new Set(scopes.map((s) => s.split(":")[0]));
  return Array.from(scopeGroups).join(", ");
}

export default function ApiKeyRow({ apiKey, onRevoked }: ApiKeyRowProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const isExpired = apiKey.expires_at && new Date(apiKey.expires_at) < new Date();

  async function handleRevoke() {
    setRevoking(true);
    try {
      const res = await fetch(`/api/v1/api-keys/${apiKey.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onRevoked();
      } else {
        console.error("Failed to revoke key");
        setRevoking(false);
        setShowConfirm(false);
      }
    } catch {
      console.error("Failed to revoke key");
      setRevoking(false);
      setShowConfirm(false);
    }
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <span className="font-medium text-gray-900">{apiKey.name}</span>
      </td>
      <td className="px-4 py-3">
        <code className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
          {apiKey.key_prefix}...
        </code>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-sm text-gray-600">{formatScopes(apiKey.scopes)}</span>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-sm text-gray-600">{formatDate(apiKey.last_used_at)}</span>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <span
          className={`text-sm ${
            isExpired ? "text-red-600 font-medium" : "text-gray-600"
          }`}
        >
          {apiKey.expires_at ? formatDate(apiKey.expires_at) : "Never"}
          {isExpired && " (Expired)"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Revoke
          </button>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              disabled={revoking}
              className="text-sm text-gray-600 hover:text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleRevoke}
              disabled={revoking}
              className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50"
            >
              {revoking ? "Revoking..." : "Confirm"}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
