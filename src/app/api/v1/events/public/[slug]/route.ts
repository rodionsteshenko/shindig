import { createAdminClient } from "@/lib/supabase/admin";
import { success, error, rateLimitError, sanitizeError } from "@/lib/apiResponse";
import { publicEndpointLimiter } from "@/lib/rateLimit";
import type { Event } from "@/lib/types";

/**
 * GET /api/v1/events/public/[slug]
 *
 * Gets a public event by slug.
 * No authentication required.
 * Rate limited with publicEndpointLimiter (20 requests/minute).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Apply rate limiting
  const rateLimit = publicEndpointLimiter(request);
  if (!rateLimit.allowed) {
    return rateLimitError(rateLimit.retryAfter);
  }

  const { slug } = await params;

  // Validate slug format (basic sanity check)
  if (!slug || typeof slug !== "string" || slug.length > 200) {
    return error("Invalid slug", 400);
  }

  const adminClient = createAdminClient();

  try {
    const { data: event, error: dbError } = await adminClient
      .from("events")
      .select("*")
      .eq("slug", slug)
      .eq("is_public", true)
      .single<Event>();

    if (dbError || !event) {
      return error("Event not found", 404);
    }

    return success(event);
  } catch (err) {
    return error(sanitizeError(err), 500);
  }
}
