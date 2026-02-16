import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest, hasScope } from "@/lib/apiKeyAuth";
import {
  success,
  error,
  validationError,
  paginatedSuccess,
  sanitizeError,
} from "@/lib/apiResponse";
import { validateEventInput, MAX_EVENTS_PER_ACCOUNT } from "@/lib/validation";
import { generateSlug } from "@/lib/utils";
import type { Event } from "@/lib/types";

/**
 * Default and maximum pagination values
 */
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

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
 * GET /api/v1/events
 *
 * Lists the authenticated user's events with pagination.
 * Requires events:read scope for API key auth.
 */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return error("Unauthorized", 401);
  }

  if (!hasScope(auth.scopes, "events:read")) {
    return error("Insufficient scope: events:read required", 403);
  }

  const url = new URL(request.url);
  const { page, perPage } = parsePagination(url);
  const offset = (page - 1) * perPage;

  const adminClient = createAdminClient();

  try {
    // Get total count first
    const { count: total, error: countError } = await adminClient
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("host_id", auth.user_id);

    if (countError) {
      return error(sanitizeError(countError), 400);
    }

    // Get paginated events
    const { data: events, error: dbError } = await adminClient
      .from("events")
      .select("*")
      .eq("host_id", auth.user_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (dbError) {
      return error(sanitizeError(dbError), 400);
    }

    return paginatedSuccess(events as Event[], page, perPage, total ?? 0);
  } catch (err) {
    return error(sanitizeError(err), 500);
  }
}

/**
 * POST /api/v1/events
 *
 * Creates a new event for the authenticated user.
 * Requires events:write scope for API key auth.
 * Uses validateEventInput for validation.
 */
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return error("Unauthorized", 401);
  }

  if (!hasScope(auth.scopes, "events:write")) {
    return error("Insufficient scope: events:write required", 403);
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

  // Check account limits
  const { count } = await adminClient
    .from("events")
    .select("*", { count: "exact", head: true })
    .eq("host_id", auth.user_id);

  if (count != null && count >= MAX_EVENTS_PER_ACCOUNT) {
    return error(`Cannot exceed ${MAX_EVENTS_PER_ACCOUNT} events per account`, 400);
  }

  const slug = generateSlug(input.title as string);

  try {
    const { data, error: dbError } = await adminClient
      .from("events")
      .insert({
        host_id: auth.user_id,
        title: input.title,
        description: input.description ?? null,
        location: input.location ?? null,
        maps_url: input.maps_url ?? null,
        cover_image_url: input.cover_image_url ?? null,
        start_time: input.start_time,
        end_time: input.end_time ?? null,
        timezone: input.timezone,
        slug,
        is_public: input.is_public ?? true,
        allow_plus_ones: input.allow_plus_ones ?? true,
        gift_registry_url: input.gift_registry_url ?? null,
        gift_message: input.gift_message ?? null,
      })
      .select()
      .single<Event>();

    if (dbError) {
      return error(sanitizeError(dbError), 400);
    }

    return success(data);
  } catch (err) {
    return error(sanitizeError(err), 500);
  }
}
