export interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  location: string | null;
  maps_url: string | null;
  cover_image_url: string | null;
  start_time: string;
  end_time: string | null;
  timezone: string;
  slug: string;
  is_public: boolean;
  allow_plus_ones: boolean;
  gift_registry_url: string | null;
  gift_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Guest {
  id: string;
  event_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  rsvp_status: "pending" | "going" | "maybe" | "declined";
  plus_one_count: number;
  dietary: string | null;
  message: string | null;
  rsvp_token: string;
  invited_at: string | null;
  responded_at: string | null;
  created_at: string;
}

export interface FeatureRequest {
  id: string;
  title: string;
  description: string | null;
  author_name: string;
  author_email: string | null;
  type: "feature" | "bug";
  status: "open" | "approved" | "rejected" | "needs_clarification" | "planned" | "in_progress" | "done";
  ai_verdict: "approved" | "rejected" | "needs_clarification" | null;
  ai_reason: string | null;
  severity: "critical" | "high" | "medium" | "low" | null;
  prd_json: Record<string, unknown> | null;
  implementation_status: "none" | "queued" | "in_progress" | "completed" | "failed";
  vote_count: number;
  created_at: string;
}

export interface FeatureVote {
  id: string;
  feature_id: string;
  voter_identifier: string;
  created_at: string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}
