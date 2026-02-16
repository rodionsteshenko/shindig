"use client";

import { useState } from "react";

interface FeatureFormProps {
  onSubmitted: () => void;
}

export default function FeatureForm({ onSubmitted }: FeatureFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError(null);

    const res = await fetch("/api/features", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        author_name: authorName.trim() || "Anonymous",
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Something went wrong");
      return;
    }

    setTitle("");
    setDescription("");
    setAuthorName("");
    onSubmitted();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-4 space-y-3">
      <h3 className="font-semibold text-gray-900">Suggest a Feature</h3>
      <div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Feature title *"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
        />
      </div>
      <div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the feature (optional)"
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none resize-y"
        />
      </div>
      <div>
        <input
          type="text"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="Your name (optional)"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading || !title.trim()}
        className="bg-shindig-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-shindig-700 transition-colors disabled:opacity-50"
      >
        {loading ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}
