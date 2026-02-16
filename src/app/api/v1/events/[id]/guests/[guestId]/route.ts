import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest, hasScope } from "@/lib/apiKeyAuth";
import { success, error, validationError, sanitizeError } from "@/lib/apiResponse";
import { validateGuestInput } from "@/lib/validation";
import type { Guest } from "@/lib/types";

/**
 * UUID validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verify that an event exists and belongs to the authenticated user.
 * Returns the event if found, null otherwise.
 */
async function verifyEventOwnership(
  eventId: string,
  userId: string
): Promise<{ id: string } | null> {
  const adminClient = createAdminClient();
  const { data, error: dbError } = await adminClient
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("host_id", userId)
    .single();

  if (dbError || !data) {
    return null;
  }
  return data;
}

/**
 * GET /api/v1/events/[id]/guests/[guestId]
 *
 * Gets a single guest by ID.
 * Requires guests:read scope for API key auth.
 * Verifies the event belongs to the authenticated user.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; guestId: string }> }
) {
  const { id: eventId, guestId } = await params;

  const auth = await authenticateRequest(request);

  if (!auth) {
    return error("Unauthorized", 401);
  }

  if (!hasScope(auth.scopes, "guests:read")) {
    return error("Insufficient scope: guests:read required", 403);
  }

  if (!UUID_REGEX.test(eventId)) {
    return error("Invalid event ID format", 400);
  }

  if (!UUID_REGEX.test(guestId)) {
    return error("Invalid guest ID format", 400);
  }

  // Verify event ownership
  const event = await verifyEventOwnership(eventId, auth.user_id);
  if (!event) {
    return error("Event not found", 404);
  }

  const adminClient = createAdminClient();

  try {
    const { data: guest, error: dbError } = await adminClient
      .from("guests")
      .select("*")
      .eq("id", guestId)
      .eq("event_id", eventId)
      .single<Guest>();

    if (dbError || !guest) {
      return error("Guest not found", 404);
    }

    return success(guest);
  } catch (err) {
    return error(sanitizeError(err), 500);
  }
}

/**
 * PUT /api/v1/events/[id]/guests/[guestId]
 *
 * Updates a guest by ID.
 * Requires guests:write scope for API key auth.
 * Verifies the event belongs to the authenticated user.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; guestId: string }> }
) {
  const { id: eventId, guestId } = await params;

  const auth = await authenticateRequest(request);

  if (!auth) {
    return error("Unauthorized", 401);
  }

  if (!hasScope(auth.scopes, "guests:write")) {
    return error("Insufficient scope: guests:write required", 403);
  }

  if (!UUID_REGEX.test(eventId)) {
    return error("Invalid event ID format", 400);
  }

  if (!UUID_REGEX.test(guestId)) {
    return error("Invalid guest ID format", 400);
  }

  // Verify event ownership
  const event = await verifyEventOwnership(eventId, auth.user_id);
  if (!event) {
    return error("Event not found", 404);
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
  const validation = validateGuestInput(body as Record<string, unknown>);
  if (!validation.valid) {
    return validationError(validation.errors);
  }

  const input = body as Record<string, unknown>;
  const adminClient = createAdminClient();

  try {
    // First verify guest exists
    const { data: existing, error: lookupError } = await adminClient
      .from("guests")
      .select("id")
      .eq("id", guestId)
      .eq("event_id", eventId)
      .single();

    if (lookupError || !existing) {
      return error("Guest not found", 404);
    }

    // Update the guest
    const { data: guest, error: dbError } = await adminClient
      .from("guests")
      .update({
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
      })
      .eq("id", guestId)
      .eq("event_id", eventId)
      .select()
      .single<Guest>();

    if (dbError) {
      return error(sanitizeError(dbError), 400);
    }

    return success(guest);
  } catch (err) {
    return error(sanitizeError(err), 500);
  }
}

/**
 * DELETE /api/v1/events/[id]/guests/[guestId]
 *
 * Deletes a guest by ID.
 * Requires guests:write scope for API key auth.
 * Verifies the event belongs to the authenticated user.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; guestId: string }> }
) {
  const { id: eventId, guestId } = await params;

  const auth = await authenticateRequest(request);

  if (!auth) {
    return error("Unauthorized", 401);
  }

  if (!hasScope(auth.scopes, "guests:write")) {
    return error("Insufficient scope: guests:write required", 403);
  }

  if (!UUID_REGEX.test(eventId)) {
    return error("Invalid event ID format", 400);
  }

  if (!UUID_REGEX.test(guestId)) {
    return error("Invalid guest ID format", 400);
  }

  // Verify event ownership
  const event = await verifyEventOwnership(eventId, auth.user_id);
  if (!event) {
    return error("Event not found", 404);
  }

  const adminClient = createAdminClient();

  try {
    // First verify guest exists
    const { data: existing, error: lookupError } = await adminClient
      .from("guests")
      .select("id")
      .eq("id", guestId)
      .eq("event_id", eventId)
      .single();

    if (lookupError || !existing) {
      return error("Guest not found", 404);
    }

    // Delete the guest
    const { error: dbError } = await adminClient
      .from("guests")
      .delete()
      .eq("id", guestId)
      .eq("event_id", eventId);

    if (dbError) {
      return error(sanitizeError(dbError), 400);
    }

    return success({ deleted: true, id: guestId });
  } catch (err) {
    return error(sanitizeError(err), 500);
  }
}
