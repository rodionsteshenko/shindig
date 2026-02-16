import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/apiKeyAuth";
import {
  success,
  error,
  sanitizeError,
} from "@/lib/apiResponse";
import type { FeatureRequest } from "@/lib/types";

/**
 * Validate UUID format
 */
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * POST /api/v1/features/[id]/queue
 *
 * Queues a feature for implementation.
 * Requires session auth only (admin operation).
 * Sets implementation_status to 'queued'.
 * Returns error if prd_json is not set (PRD must be generated first).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require session auth (admin only)
  const auth = await authenticateRequest(request);

  if (!auth) {
    return error("Unauthorized", 401);
  }

  // Only session auth is allowed (admin function)
  if (auth.authMethod !== "session") {
    return error("Session authentication required", 403);
  }

  const { id } = await params;

  // Validate UUID format
  if (!isValidUUID(id)) {
    return error("Invalid feature ID format", 400);
  }

  const adminClient = createAdminClient();

  try {
    // Fetch the feature to check if it exists and has prd_json
    const { data: existing, error: fetchError } = await adminClient
      .from("feature_requests")
      .select("*")
      .eq("id", id)
      .single<FeatureRequest>();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return error("Feature not found", 404);
      }
      return error(sanitizeError(fetchError), 400);
    }

    // Check if prd_json is set
    if (!existing.prd_json) {
      return error("PRD must be generated before queuing a feature for implementation", 400);
    }

    // Update implementation_status to 'queued'
    const { data: feature, error: dbError } = await adminClient
      .from("feature_requests")
      .update({ implementation_status: "queued" })
      .eq("id", id)
      .select()
      .single<FeatureRequest>();

    if (dbError) {
      return error(sanitizeError(dbError), 400);
    }

    return success(feature);
  } catch (err) {
    return error(sanitizeError(err), 500);
  }
}
