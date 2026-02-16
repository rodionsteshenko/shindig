import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest, hasScope } from "@/lib/apiKeyAuth";
import {
  success,
  error,
  sanitizeError,
} from "@/lib/apiResponse";
import type { FeatureRequest } from "@/lib/types";

/**
 * Valid implementation status values for updating
 */
const VALID_IMPLEMENTATION_STATUSES = ["in_progress", "completed", "failed"];

/**
 * Validate UUID format
 */
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * PUT /api/v1/features/[id]/implementation
 *
 * Updates a feature's implementation status.
 * Requires features:read scope for API key auth, or session auth.
 * Body: { status: 'in_progress' | 'completed' | 'failed' }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Authenticate - requires features:read scope for API key
  const auth = await authenticateRequest(request);
  if (!auth) {
    return error("Unauthorized", 401);
  }

  // Check scope for API key auth
  if (!hasScope(auth.scopes, "features:read")) {
    return error("Insufficient permissions. Requires features:read scope", 403);
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

  if (!VALID_IMPLEMENTATION_STATUSES.includes(input.status)) {
    return error(
      `Invalid status. Must be one of: ${VALID_IMPLEMENTATION_STATUSES.join(", ")}`,
      400
    );
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

    // Update implementation_status
    const { data: feature, error: dbError } = await adminClient
      .from("feature_requests")
      .update({ implementation_status: input.status })
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
