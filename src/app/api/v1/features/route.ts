import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/apiKeyAuth";
import {
  success,
  error,
  validationError,
  paginatedSuccess,
  rateLimitError,
  sanitizeError,
} from "@/lib/apiResponse";
import { validateFeatureInput } from "@/lib/validation";
import { publicEndpointLimiter, featureSubmitLimiter } from "@/lib/rateLimit";
import type { FeatureRequest } from "@/lib/types";

/**
 * Default and maximum pagination values
 */
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

/**
 * Valid status values for filtering
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
 * Valid type values for filtering
 */
const VALID_TYPES = ["feature", "bug"];

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
 * GET /api/v1/features
 *
 * Lists feature requests with pagination.
 * Public endpoint, but rate limited.
 * Supports filtering by type and status query params.
 */
export async function GET(request: Request) {
  // Rate limit public endpoint
  const limit = publicEndpointLimiter(request);
  if (!limit.allowed) {
    return rateLimitError(limit.retryAfter);
  }

  const url = new URL(request.url);
  const { page, perPage } = parsePagination(url);
  const offset = (page - 1) * perPage;

  // Parse filter params
  const typeFilter = url.searchParams.get("type");
  const statusFilter = url.searchParams.get("status");

  // Validate type filter
  if (typeFilter && !VALID_TYPES.includes(typeFilter)) {
    return error(`Invalid type filter. Must be one of: ${VALID_TYPES.join(", ")}`, 400);
  }

  // Validate status filter
  if (statusFilter && !VALID_STATUSES.includes(statusFilter)) {
    return error(`Invalid status filter. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
  }

  const adminClient = createAdminClient();

  try {
    // Build query with filters
    let countQuery = adminClient
      .from("feature_requests")
      .select("*", { count: "exact", head: true });

    let dataQuery = adminClient
      .from("feature_requests")
      .select("*");

    if (typeFilter) {
      countQuery = countQuery.eq("type", typeFilter);
      dataQuery = dataQuery.eq("type", typeFilter);
    }

    if (statusFilter) {
      countQuery = countQuery.eq("status", statusFilter);
      dataQuery = dataQuery.eq("status", statusFilter);
    }

    // Get total count
    const { count: total, error: countError } = await countQuery;

    if (countError) {
      return error(sanitizeError(countError), 400);
    }

    // Get paginated features ordered by vote_count descending
    const { data: features, error: dbError } = await dataQuery
      .order("vote_count", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (dbError) {
      return error(sanitizeError(dbError), 400);
    }

    return paginatedSuccess(features as FeatureRequest[], page, perPage, total ?? 0);
  } catch (err) {
    return error(sanitizeError(err), 500);
  }
}

/**
 * POST /api/v1/features
 *
 * Submits a new feature request.
 * No auth required, but rate limited with featureSubmitLimiter.
 * Uses validateFeatureInput for validation.
 * Accepts type field.
 */
export async function POST(request: Request) {
  // Rate limit feature submissions
  const limit = featureSubmitLimiter(request);
  if (!limit.allowed) {
    return rateLimitError(limit.retryAfter);
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
  const validation = validateFeatureInput(body as Record<string, unknown>);
  if (!validation.valid) {
    return validationError(validation.errors);
  }

  const input = body as Record<string, unknown>;
  const adminClient = createAdminClient();

  // Build insert object with required fields
  const insertData: Record<string, unknown> = {
    title: (input.title as string).trim(),
    description: input.description ? (input.description as string).trim() : null,
    author_name: input.author_name ? (input.author_name as string).trim() : "Anonymous",
    author_email: input.author_email ? (input.author_email as string).trim() : null,
  };

  // Only include type if provided (schema may not have this column yet)
  if (input.type) {
    insertData.type = (input.type as string).trim();
  }

  try {
    const { data, error: dbError } = await adminClient
      .from("feature_requests")
      .insert(insertData)
      .select()
      .single<FeatureRequest>();

    if (dbError) {
      // If the error is about the type column not existing, retry without it
      if (dbError.message?.includes("type")) {
        delete insertData.type;
        const { data: retryData, error: retryError } = await adminClient
          .from("feature_requests")
          .insert(insertData)
          .select()
          .single<FeatureRequest>();

        if (retryError) {
          return error(sanitizeError(retryError), 400);
        }
        return success(retryData);
      }
      return error(sanitizeError(dbError), 400);
    }

    return success(data);
  } catch (err) {
    return error(sanitizeError(err), 500);
  }
}
