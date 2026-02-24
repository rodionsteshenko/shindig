import { createAdminClient } from "@/lib/supabase/admin";
import { success, error, rateLimitError } from "@/lib/apiResponse";
import { publicEndpointLimiter } from "@/lib/rateLimit";
import { normalizePhone } from "@/lib/phone";

/**
 * POST /api/v1/events/public/[slug]/register
 *
 * Public open registration endpoint (v1 API envelope format).
 * Allows anyone to self-register as a guest for events with allow_open_rsvp enabled.
 * No authentication required.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimit = publicEndpointLimiter(request);
  if (!rateLimit.allowed) {
    return rateLimitError(rateLimit.retryAfter);
  }

  const { slug } = await params;

  if (!slug || typeof slug !== "string" || slug.length > 200) {
    return error("Invalid slug", 400);
  }

  // Parse request body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON in request body", 400);
  }

  // Validate name (required)
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 200) {
    return error("Name is required (max 200 characters)", 400);
  }

  // Validate email (optional)
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return error("Invalid email format", 400);
  }

  // Validate phone (optional, normalize to E.164)
  let phone: string | null = null;
  if (body.phone && typeof body.phone === "string" && body.phone.trim()) {
    phone = normalizePhone(body.phone.trim());
    if (!phone) {
      return error("Invalid phone number", 400);
    }
  }

  const adminClient = createAdminClient();

  // Look up event by slug — must be public and have open registration
  const { data: event, error: dbError } = await adminClient
    .from("events")
    .select("id, allow_open_rsvp, is_public")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (dbError || !event) {
    return error("Event not found", 404);
  }

  if (!event.allow_open_rsvp) {
    return error("Open registration is not enabled for this event", 403);
  }

  // Generate RSVP token
  const rsvpToken = crypto.randomUUID().replace(/-/g, "");

  // Insert guest
  const { data: guest, error: insertError } = await adminClient
    .from("guests")
    .insert({
      event_id: event.id,
      name,
      email,
      phone,
      rsvp_status: "going",
      rsvp_token: rsvpToken,
    })
    .select("id, name, rsvp_token")
    .single();

  if (insertError) {
    return error("Failed to register", 500);
  }

  return success({
    guest_id: guest.id,
    name: guest.name,
    rsvp_token: guest.rsvp_token,
    rsvp_url: `/rsvp/${guest.rsvp_token}`,
  });
}
