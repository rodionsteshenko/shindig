"use client";

import { useState } from "react";
import type { ApiKey } from "@/lib/types";
import CreateApiKeyModal from "./CreateApiKeyModal";
import ApiKeyRow from "./ApiKeyRow";

interface ApiKeysListProps {
  initialKeys: Omit<ApiKey, "key_hash" | "user_id">[];
}

export default function ApiKeysList({ initialKeys }: ApiKeysListProps) {
  const [keys, setKeys] = useState(initialKeys);
  const [showCreateModal, setShowCreateModal] = useState(false);

  function handleKeyCreated(newKey: Omit<ApiKey, "key_hash" | "user_id">) {
    setKeys((prev) => [newKey, ...prev]);
    setShowCreateModal(false);
  }

  function handleKeyRevoked(id: string) {
    setKeys((prev) => prev.filter((k) => k.id !== id));
  }

  return (
    <div>
      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-shindig-600 text-white px-5 py-2 rounded-lg font-semibold text-sm hover:bg-shindig-700 transition-colors"
        >
          + Create API Key
        </button>
      </div>

      {keys.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <div className="text-4xl mb-4">🔑</div>
          <h2 className="text-xl font-semibold mb-2">No API keys yet</h2>
          <p className="text-gray-600 mb-6">
            Create an API key to access Shindig programmatically.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-shindig-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-shindig-700 transition-colors"
          >
            Create API Key
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                  Key
                </th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 hidden md:table-cell">
                  Scopes
                </th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 hidden lg:table-cell">
                  Last Used
                </th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 hidden lg:table-cell">
                  Expires
                </th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {keys.map((key) => (
                <ApiKeyRow
                  key={key.id}
                  apiKey={key}
                  onRevoked={() => handleKeyRevoked(key.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <CreateApiKeyModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleKeyCreated}
        />
      )}
    </div>
  );
}
