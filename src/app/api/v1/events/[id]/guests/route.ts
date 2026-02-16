import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest, hasScope } from "@/lib/apiKeyAuth";
import {
  success,
  error,
  validationError,
  paginatedSuccess,
  sanitizeError,
} from "@/lib/apiResponse";
import { validateGuestInput, MAX_GUESTS_PER_EVENT } from "@/lib/validation";
import type { Guest } from "@/lib/types";

/**
 * Default and maximum pagination values
 */
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

/**
 * UUID validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Valid RSVP status values for filtering
 */
const VALID_RSVP_STATUSES = ["pending", "going", "maybe", "declined"];

/**
 * Parse and validate pagination params
 */
function parsePagination(url: URL): { page: number; perPage: number } {
  const pageParam = url.searchParams.get("page");
  const perPageParam = url.searchParams.get("per_page");

  let page = 1;
  let perPage = DEFAULT_PER_PAGE;

  if (pageParam) {
    const parsed = parseInt(pageParam, 10);
    if (!isNaN(parsed) && parsed > 0) {
      page = parsed;
    }
  }

  if (perPageParam) {
    const parsed = parseInt(perPageParam, 10);
    if (!isNaN(parsed) && parsed > 0) {
      perPage = Math.min(parsed, MAX_PER_PAGE);
    }
  }

  return { page, perPage };
}

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
 * Generate a unique RSVP token for a guest
 */
function generateRsvpToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 16; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

/**
 * GET /api/v1/events/[id]/guests
 *
 * Lists guests for an event with pagination.
 * Supports filtering by rsvp_status query param.
 * Requires guests:read scope for API key auth.
 * Verifies the event belongs to the authenticated user.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;

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

  // Verify event ownership
  const event = await verifyEventOwnership(eventId, auth.user_id);
  if (!event) {
    return error("Event not found", 404);
  }

  const url = new URL(request.url);
  const { page, perPage } = parsePagination(url);
  const offset = (page - 1) * perPage;

  // Parse rsvp_status filter
  const rsvpStatusFilter = url.searchParams.get("rsvp_status");
  if (rsvpStatusFilter && !VALID_RSVP_STATUSES.includes(rsvpStatusFilter)) {
    return error(
      `Invalid rsvp_status. Must be one of: ${VALID_RSVP_STATUSES.join(", ")}`,
      400
    );
  }

  const adminClient = createAdminClient();

  try {
    // Build query for total count
    let countQuery = adminClient
      .from("guests")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);

    if (rsvpStatusFilter) {
      countQuery = countQuery.eq("rsvp_status", rsvpStatusFilter);
    }

    const { count: total, error: countError } = await countQuery;

    if (countError) {
      return error(sanitizeError(countError), 400);
    }

    // Build query for paginated guests
    let guestsQuery = adminClient
      .from("guests")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (rsvpStatusFilter) {
      guestsQuery = guestsQuery.eq("rsvp_status", rsvpStatusFilter);
    }

    const { data: guests, error: dbError } = await guestsQuery;

    if (dbError) {
      return error(sanitizeError(dbError), 400);
    }

    return paginatedSuccess(guests as Guest[], page, perPage, total ?? 0);
  } catch (err) {
    return error(sanitizeError(err), 500);
  }
}

/**
 * POST /api/v1/events/[id]/guests
 *
 * Adds a new guest to an event.
 * Requires guests:write scope for API key auth.
 * Verifies the event belongs to the authenticated user.
 * Uses validateGuestInput for validation.
 * Checks MAX_GUESTS_PER_EVENT limit.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;

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

  // Check guest limit
  const { count } = await adminClient
    .from("guests")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (count != null && count >= MAX_GUESTS_PER_EVENT) {
    return error(`Cannot exceed ${MAX_GUESTS_PER_EVENT} guests per event`, 400);
  }

  try {
    const { data, error: dbError } = await adminClient
      .from("guests")
      .insert({
        event_id: eventId,
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        rsvp_status: "pending",
        plus_one_count: 0,
        rsvp_token: generateRsvpToken(),
      })
      .select()
      .single<Guest>();

    if (dbError) {
      return error(sanitizeError(dbError), 400);
    }

    return success(data);
  } catch (err) {
    return error(sanitizeError(err), 500);
  }
}
