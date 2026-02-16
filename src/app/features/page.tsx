"use client";

import { useEffect, useState, useCallback } from "react";
import FeatureCard from "@/components/FeatureCard";
import FeatureForm from "@/components/FeatureForm";
import type { FeatureRequest } from "@/lib/types";

function getVoterId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("shindig_voter_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("shindig_voter_id", id);
  }
  return id;
}

export default function FeaturesPage() {
  const [features, setFeatures] = useState<FeatureRequest[]>([]);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [voterId, setVoterId] = useState("");

  const fetchFeatures = useCallback(async () => {
    const res = await fetch("/api/features");
    if (res.ok) {
      const data = await res.json();
      setFeatures(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setVoterId(getVoterId());
    fetchFeatures();
  }, [fetchFeatures]);

  // Fetch which features this voter has voted on
  useEffect(() => {
    if (!voterId || features.length === 0) return;

    async function checkVotes() {
      const res = await fetch(`/api/features/votes?voter=${encodeURIComponent(voterId)}`);
      if (res.ok) {
        const data = await res.json();
        setVotedIds(new Set(data.map((v: { feature_id: string }) => v.feature_id)));
      }
    }
    checkVotes();
  }, [voterId, features.length]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Feature Board</h1>
        <p className="text-gray-600">
          Suggest features and vote on what we should build next.
        </p>
      </div>

      <div className="mb-8">
        <FeatureForm onSubmitted={fetchFeatures} />
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : features.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No feature requests yet. Be the first to suggest one!
        </div>
      ) : (
        <div className="space-y-3">
          {features.map((feature) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              voterId={voterId}
              initialVoted={votedIds.has(feature.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
