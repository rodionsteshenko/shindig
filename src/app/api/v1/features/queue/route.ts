import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest, hasScope } from "@/lib/apiKeyAuth";
import {
  success,
  error,
  rateLimitError,
  sanitizeError,
} from "@/lib/apiResponse";
import { publicEndpointLimiter } from "@/lib/rateLimit";
import type { FeatureRequest } from "@/lib/types";

/**
 * GET /api/v1/features/queue
 *
 * Lists queued features ordered by vote_count descending.
 * Filters to features where implementation_status='queued'.
 * Requires features:read scope for API key auth, or session auth.
 */
export async function GET(request: Request) {
  // Rate limit check
  const limit = publicEndpointLimiter(request);
  if (!limit.allowed) {
    return rateLimitError(limit.retryAfter);
  }

  // Authenticate - requires features:read scope for API key
  const auth = await authenticateRequest(request);
  if (!auth) {
    return error("Unauthorized", 401);
  }

  // Check scope for API key auth
  if (!hasScope(auth.scopes, "features:read")) {
    return error("Insufficient permissions. Requires features:read scope", 403);
  }

  const adminClient = createAdminClient();

  try {
    const { data: features, error: dbError } = await adminClient
      .from("feature_requests")
      .select("*")
      .eq("implementation_status", "queued")
      .order("vote_count", { ascending: false });

    if (dbError) {
      return error(sanitizeError(dbError), 400);
    }

    return success(features as FeatureRequest[]);
  } catch (err) {
    return error(sanitizeError(err), 500);
  }
}
