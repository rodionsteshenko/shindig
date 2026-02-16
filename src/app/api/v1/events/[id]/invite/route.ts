import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest, hasScope } from "@/lib/apiKeyAuth";
import { success, error, rateLimitError, sanitizeError } from "@/lib/apiResponse";
import { emailSendLimiter } from "@/lib/rateLimit";
import { getResendClient } from "@/lib/resend";
import { invitationEmail } from "@/lib/emailTemplates";
import { formatDate, formatTime } from "@/lib/utils";
import type { Event, Guest } from "@/lib/types";

/**
 * UUID validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/v1/events/[id]/invite
 *
 * Sends invitations to guests for an event.
 * Accepts optional body { guest_ids?: string[] } to send to specific guests.
 * If guest_ids is not provided, sends to all guests with email addresses.
 * Requires events:write scope for API key auth.
 * Rate limited with emailSendLimiter.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;

  // Rate limit
  const limit = emailSendLimiter(request);
  if (!limit.allowed) {
    return rateLimitError(limit.retryAfter);
  }

  const auth = await authenticateRequest(request);

  if (!auth) {
    return error("Unauthorized", 401);
  }

  if (!hasScope(auth.scopes, "events:write")) {
    return error("Insufficient scope: events:write required", 403);
  }

  if (!UUID_REGEX.test(eventId)) {
    return error("Invalid event ID format", 400);
  }

  const adminClient = createAdminClient();

  // Verify event ownership
  const { data: event, error: eventError } = await adminClient
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("host_id", auth.user_id)
    .single<Event>();

  if (eventError || !event) {
    return error("Event not found", 404);
  }

  // Check for Resend client
  const resend = getResendClient();
  if (!resend) {
    return error(
      "Email not configured. Set RESEND_API_KEY to enable invitations.",
      503
    );
  }

  // Parse request body
  let body: { guest_ids?: string[] } = {};
  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    return error("Invalid JSON in request body", 400);
  }

  const guestIds: string[] | undefined = body.guest_ids;

  // Validate guest_ids if provided
  if (guestIds !== undefined) {
    if (!Array.isArray(guestIds)) {
      return error("guest_ids must be an array", 400);
    }
    for (const gid of guestIds) {
      if (typeof gid !== "string" || !UUID_REGEX.test(gid)) {
        return error("Each guest_id must be a valid UUID", 400);
      }
    }
  }

  // Build query for guests
  let query = adminClient
    .from("guests")
    .select("*")
    .eq("event_id", eventId)
    .not("email", "is", null);

  if (guestIds && guestIds.length > 0) {
    query = query.in("id", guestIds);
  }

  const { data: guests, error: guestsError } = await query;

  if (guestsError) {
    return error(sanitizeError(guestsError), 500);
  }

  if (!guests || guests.length === 0) {
    return error("No guests with email addresses", 400);
  }

  const origin = new URL(request.url).origin;
  let sent = 0;
  let failed = 0;

  for (const guest of guests as Guest[]) {
    if (!guest.email) continue;

    const email = invitationEmail({
      guestName: guest.name,
      eventTitle: event.title,
      eventDate: formatDate(event.start_time),
      eventTime: formatTime(event.start_time),
      eventLocation: event.location,
      rsvpUrl: `${origin}/rsvp/${guest.rsvp_token}`,
    });

    try {
      await resend.emails.send({
        from: "Shindig <noreply@shindig.app>",
        to: guest.email,
        subject: email.subject,
        html: email.html,
      });

      // Update invited_at timestamp
      await adminClient
        .from("guests")
        .update({ invited_at: new Date().toISOString() })
        .eq("id", guest.id);

      sent++;
    } catch (err) {
      console.error(`Failed to send to ${guest.email}:`, sanitizeError(err));
      failed++;
    }
  }

  return success({ sent, failed });
}
