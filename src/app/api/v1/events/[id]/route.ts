import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest, hasScope } from "@/lib/apiKeyAuth";
import { success, error, validationError, sanitizeError } from "@/lib/apiResponse";
import { validateEventInput } from "@/lib/validation";
import type { Event } from "@/lib/types";

/**
 * UUID validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/v1/events/[id]
 *
 * Gets a single event by ID.
 * Requires events:read scope for API key auth.
 * Verifies the event belongs to the authenticated user.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await authenticateRequest(request);

  if (!auth) {
    return error("Unauthorized", 401);
  }

  if (!hasScope(auth.scopes, "events:read")) {
    return error("Insufficient scope: events:read required", 403);
  }

  if (!UUID_REGEX.test(id)) {
    return error("Invalid event ID format", 400);
  }

  const adminClient = createAdminClient();

  try {
    const { data: event, error: dbError } = await adminClient
      .from("events")
      .select("*")
      .eq("id", id)
      .eq("host_id", auth.user_id)
      .single<Event>();

    if (dbError || !event) {
      return error("Event not found", 404);
    }

    return success(event);
  } catch (err) {
    return error(sanitizeError(err), 500);
  }
}

/**
 * PUT /api/v1/events/[id]
 *
 * Updates an event by ID.
 * Requires events:write scope for API key auth.
 * Verifies the event belongs to the authenticated user.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await authenticateRequest(request);

  if (!auth) {
    return error("Unauthorized", 401);
  }

  if (!hasScope(auth.scopes, "events:write")) {
    return error("Insufficient scope: events:write required", 403);
  }

  if (!UUID_REGEX.test(id)) {
    return error("Invalid event ID format", 400);
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

  // Validate input
  const validation = validateEventInput(body as Record<string, unknown>);
  if (!validation.valid) {
    return validationError(validation.errors);
  }

  const input = body as Record<string, unknown>;
  const adminClient = createAdminClient();

  try {
    // First verify ownership
    const { data: existing, error: lookupError } = await adminClient
      .from("events")
      .select("id")
      .eq("id", id)
      .eq("host_id", auth.user_id)
      .single();

    if (lookupError || !existing) {
      return error("Event not found", 404);
    }

    // Update the event
    const { data: event, error: dbError } = await adminClient
      .from("events")
      .update({
        title: input.title,
        description: input.description ?? null,
        location: input.location ?? null,
        maps_url: input.maps_url ?? null,
        cover_image_url: input.cover_image_url ?? null,
        start_time: input.start_time,
        end_time: input.end_time ?? null,
        timezone: input.timezone,
        is_public: input.is_public ?? true,
        allow_plus_ones: input.allow_plus_ones ?? true,
        gift_registry_url: input.gift_registry_url ?? null,
        gift_message: input.gift_message ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("host_id", auth.user_id)
      .select()
      .single<Event>();

    if (dbError) {
      return error(sanitizeError(dbError), 400);
    }

    return success(event);
  } catch (err) {
    return error(sanitizeError(err), 500);
  }
}

/**
 * DELETE /api/v1/events/[id]
 *
 * Deletes an event by ID.
 * Requires events:write scope for API key auth.
 * Verifies the event belongs to the authenticated user.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await authenticateRequest(request);

  if (!auth) {
    return error("Unauthorized", 401);
  }

  if (!hasScope(auth.scopes, "events:write")) {
    return error("Insufficient scope: events:write required", 403);
  }

  if (!UUID_REGEX.test(id)) {
    return error("Invalid event ID format", 400);
  }

  const adminClient = createAdminClient();

  try {
    // First verify ownership
    const { data: existing, error: lookupError } = await adminClient
      .from("events")
      .select("id")
      .eq("id", id)
      .eq("host_id", auth.user_id)
      .single();

    if (lookupError || !existing) {
      return error("Event not found", 404);
    }

    // Delete the event
    const { error: dbError } = await adminClient
      .from("events")
      .delete()
      .eq("id", id)
      .eq("host_id", auth.user_id);

    if (dbError) {
      return error(sanitizeError(dbError), 400);
    }

    return success({ deleted: true, id });
  } catch (err) {
    return error(sanitizeError(err), 500);
  }
}
