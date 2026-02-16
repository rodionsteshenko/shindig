import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/apiKeyAuth";
import {
  success,
  error,
  rateLimitError,
  sanitizeError,
} from "@/lib/apiResponse";
import { publicEndpointLimiter } from "@/lib/rateLimit";
import type { FeatureRequest } from "@/lib/types";

/**
 * Valid status values for updating
 */
const VALID_STATUSES = [
  "open",
  "approved",
  "rejected",
  "needs_clarification",
  "planned",
  "in_progress",
  "done",
];

/**
 * Validate UUID format
 */
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * GET /api/v1/features/[id]
 *
 * Returns a single feature request by ID.
 * Public endpoint, but rate limited.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limit public endpoint
  const limit = publicEndpointLimiter(request);
  if (!limit.allowed) {
    return rateLimitError(limit.retryAfter);
  }

  const { id } = await params;

  // Validate UUID format
  if (!isValidUUID(id)) {
    return error("Invalid feature ID format", 400);
  }

  const adminClient = createAdminClient();

  try {
    const { data: feature, error: dbError } = await adminClient
      .from("feature_requests")
      .select("*")
      .eq("id", id)
      .single<FeatureRequest>();

    if (dbError) {
      if (dbError.code === "PGRST116") {
        return error("Feature not found", 404);
      }
      return error(sanitizeError(dbError), 400);
    }

    return success(feature);
  } catch (err) {
    return error(sanitizeError(err), 500);
  }
}

/**
 * PUT /api/v1/features/[id]
 *
 * Updates a feature request's status.
 * Requires session auth (admin only).
 * Only updates the status field.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require session auth (admin only - API keys don't have feature scope)
  const auth = await authenticateRequest(request);

  if (!auth) {
    return error("Unauthorized", 401);
  }

  // Only session auth is allowed for status updates (admin function)
  if (auth.authMethod !== "session") {
    return error("Session authentication required", 403);
  }

  const { id } = await params;

  // Validate UUID format
  if (!isValidUUID(id)) {
    return error("Invalid feature ID format", 400);
  }

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON in request body", 400);
  }

  if (!body || typeof body !== "object") {
    return error("Request body must be an object", 400);
  }

  const input = body as Record<string, unknown>;

  // Validate status field
  if (!input.status || typeof input.status !== "string") {
    return error("Status field is required", 400);
  }

  if (!VALID_STATUSES.includes(input.status)) {
    return error(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
  }

  const adminClient = createAdminClient();

  try {
    // Check if feature exists first
    const { data: existing, error: fetchError } = await adminClient
      .from("feature_requests")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return error("Feature not found", 404);
    }

    // Update only the status field
    const { data: feature, error: dbError } = await adminClient
      .from("feature_requests")
      .update({ status: input.status })
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
