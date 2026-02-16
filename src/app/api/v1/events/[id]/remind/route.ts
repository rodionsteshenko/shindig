import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest, hasScope } from "@/lib/apiKeyAuth";
import { success, error, rateLimitError, sanitizeError } from "@/lib/apiResponse";
import { emailSendLimiter } from "@/lib/rateLimit";
import { getResendClient } from "@/lib/resend";
import { reminderEmail } from "@/lib/emailTemplates";
import { formatDate, formatTime } from "@/lib/utils";
import type { Event, Guest } from "@/lib/types";

/**
 * UUID validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/v1/events/[id]/remind
 *
 * Sends reminders to guests who haven't responded.
 * Only targets guests with rsvp_status = "pending" and valid email.
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
      "Email not configured. Set RESEND_API_KEY to enable reminders.",
      503
    );
  }

  // Only remind guests who haven't responded
  const { data: guests, error: guestsError } = await adminClient
    .from("guests")
    .select("*")
    .eq("event_id", eventId)
    .eq("rsvp_status", "pending")
    .not("email", "is", null);

  if (guestsError) {
    return error(sanitizeError(guestsError), 500);
  }

  if (!guests || guests.length === 0) {
    return error("No pending guests to remind", 400);
  }

  const origin = new URL(request.url).origin;
  let sent = 0;
  let failed = 0;

  for (const guest of guests as Guest[]) {
    if (!guest.email) continue;

    const email = reminderEmail({
      guestName: guest.name,
      eventTitle: event.title,
      eventDate: formatDate(event.start_time),
      eventTime: formatTime(event.start_time),
      rsvpUrl: `${origin}/rsvp/${guest.rsvp_token}`,
    });

    try {
      await resend.emails.send({
        from: "Shindig <noreply@shindig.app>",
        to: guest.email,
        subject: email.subject,
        html: email.html,
      });
      sent++;
    } catch (err) {
      console.error(`Failed to send reminder:`, sanitizeError(err));
      failed++;
    }
  }

  return success({ sent, failed });
}
