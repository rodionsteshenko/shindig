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

const aiVerdictBadge: Record<string, { label: string; className: string }> = {
  approved: { label: "Approved", className: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
  needs_clarification: { label: "Needs Clarification", className: "bg-yellow-100 text-yellow-700" },
};

const severityBadge: Record<string, { label: string; className: string }> = {
  critical: { label: "Critical", className: "bg-red-100 text-red-700" },
  high: { label: "High", className: "bg-orange-100 text-orange-700" },
  medium: { label: "Medium", className: "bg-yellow-100 text-yellow-700" },
  low: { label: "Low", className: "bg-gray-100 text-gray-700" },
};

function FeatureIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function BugIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

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

  const badge = statusBadge[feature.status] ?? statusBadge.open;
  const verdict = feature.ai_verdict ? aiVerdictBadge[feature.ai_verdict] : null;
  const severity = feature.type === "bug" && feature.severity ? severityBadge[feature.severity] : null;

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
          <div className="flex items-center gap-2">
            {/* Type indicator */}
            <span
              className={`flex-shrink-0 ${feature.type === "bug" ? "text-red-500" : "text-shindig-500"}`}
              title={feature.type === "bug" ? "Bug Report" : "Feature Request"}
            >
              {feature.type === "bug" ? <BugIcon /> : <FeatureIcon />}
            </span>
            <h3 className="font-semibold text-gray-900">{feature.title}</h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Severity badge for bugs */}
            {severity && (
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${severity.className}`}>
                {severity.label}
              </span>
            )}
            {/* AI Verdict badge */}
            {verdict && (
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${verdict.className}`}>
                {verdict.label}
              </span>
            )}
            {/* Status badge */}
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badge.className}`}>
              {badge.label}
            </span>
          </div>
        </div>
        {feature.description && (
          <p className="text-sm text-gray-600 mb-2">{feature.description}</p>
        )}
        {/* AI reason text */}
        {feature.ai_reason && (
          <p className="text-sm text-gray-500 italic mb-2 border-l-2 border-gray-200 pl-2">
            {feature.ai_reason}
          </p>
        )}
        <p className="text-xs text-gray-400">
          by {feature.author_name}
        </p>
      </div>
    </div>
  );
}
