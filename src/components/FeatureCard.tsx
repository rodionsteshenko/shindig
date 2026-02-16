"use client";

import { useState } from "react";
import type { FeatureRequest } from "@/lib/types";

interface FeatureCardProps {
  feature: FeatureRequest;
  voterId: string;
  initialVoted: boolean;
}

const statusBadge: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-blue-100 text-blue-700" },
  planned: { label: "Planned", className: "bg-purple-100 text-purple-700" },
  in_progress: { label: "In Progress", className: "bg-yellow-100 text-yellow-700" },
  done: { label: "Done", className: "bg-green-100 text-green-700" },
};

export default function FeatureCard({ feature, voterId, initialVoted }: FeatureCardProps) {
  const [voteCount, setVoteCount] = useState(feature.vote_count);
  const [voted, setVoted] = useState(initialVoted);
  const [loading, setLoading] = useState(false);

  async function handleVote() {
    setLoading(true);
    const res = await fetch(`/api/features/${feature.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voter_identifier: voterId }),
    });

    if (res.ok) {
      const data = await res.json();
      setVoted(data.voted);
      setVoteCount((prev) => prev + (data.voted ? 1 : -1));
    }
    setLoading(false);
  }

  const badge = statusBadge[feature.status];

  return (
    <div className="bg-white rounded-xl border p-4 flex gap-4">
      {/* Vote button */}
      <div className="flex flex-col items-center gap-1 pt-1">
        <button
          onClick={handleVote}
          disabled={loading}
          className={`w-12 h-12 rounded-lg border-2 flex flex-col items-center justify-center transition-colors ${
            voted
              ? "border-shindig-600 bg-shindig-50 text-shindig-600"
              : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500"
          }`}
          title={voted ? "Remove vote" : "Upvote"}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          <span className="text-xs font-bold">{voteCount}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-gray-900">{feature.title}</h3>
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        {feature.description && (
          <p className="text-sm text-gray-600 mb-2">{feature.description}</p>
        )}
        <p className="text-xs text-gray-400">
          by {feature.author_name}
        </p>
      </div>
    </div>
  );
}
