import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResendClient } from "@/lib/resend";
import { sendSms } from "@/lib/twilio";
import { invitationEmail } from "@/lib/emailTemplates";
import { formatDate, formatTime, stripHtml } from "@/lib/utils";
import { emailSendLimiter } from "@/lib/rateLimit";
import { sanitizeError } from "@/lib/apiResponse";
import type { Event, Guest, User } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Rate limit
  const limit = emailSendLimiter(request);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("host_id", user.id)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Fetch host's display name from users table
  const { data: hostUser } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .single<Pick<User, "display_name">>();

  const hostName = hostUser?.display_name || user.email?.split("@")[0] || "The host";

  const resend = getResendClient();

  const body = await request.json();
  const guestIds: string[] | undefined = body.guest_ids;

  // Fetch all guests who have either email OR phone
  let query = supabase
    .from("guests")
    .select("*")
    .eq("event_id", id)
    .or("email.not.is.null,phone.not.is.null");

  if (guestIds) {
    query = query.in("id", guestIds);
  }

  const { data: guests } = await query;
  if (!guests || guests.length === 0) {
    return NextResponse.json(
      { error: "No guests with email or phone" },
      { status: 400 }
    );
  }

  // Split guests into email recipients and phone-only recipients
  // Guests with both email and phone receive email only (to avoid duplicate notifications)
  const emailGuests = (guests as Guest[]).filter((g) => g.email);
  const phoneOnlyGuests = (guests as Guest[]).filter((g) => !g.email && g.phone);

  // Check if we can send either channel
  const canSendEmail = resend !== null;
  const totalInvitable = emailGuests.length + phoneOnlyGuests.length;

  if (totalInvitable === 0) {
    return NextResponse.json(
      { error: "No guests with email or phone" },
      { status: 400 }
    );
  }

  // If we have email guests but no email config, and no phone-only guests, error
  if (emailGuests.length > 0 && !canSendEmail && phoneOnlyGuests.length === 0) {
    return NextResponse.json(
      { error: "Email not configured. Set RESEND_API_KEY to enable invitations." },
      { status: 503 }
    );
  }

  const e = event as Event;
  const origin = new URL(request.url).origin;
  let emailsSent = 0;
  let smsSent = 0;
  let failed = 0;

  // Send email invitations to guests with email
  if (canSendEmail) {
    for (const guest of emailGuests) {
      const emailContent = invitationEmail({
        guestName: guest.name,
        eventTitle: e.title,
        eventDate: formatDate(e.start_time),
        eventTime: formatTime(e.start_time),
        eventLocation: e.location,
        eventDescription: e.description ? stripHtml(e.description) : null,
        coverImageUrl: e.cover_image_url,
        hostName,
        rsvpUrl: `${origin}/rsvp/${guest.rsvp_token}`,
      });

      try {
        await resend.emails.send({
          from: "Shindig <noreply@shindig.app>",
          to: guest.email!,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });

        await supabase
          .from("guests")
          .update({ invited_at: new Date().toISOString() })
          .eq("id", guest.id);

        emailsSent++;
      } catch (err) {
        console.error(`Failed to send email to ${guest.email}:`, sanitizeError(err));
        failed++;
      }
    }
  } else if (emailGuests.length > 0) {
    // Email not configured, count these as failed
    failed += emailGuests.length;
    console.warn(`Email not configured, skipping ${emailGuests.length} email invitations`);
  }

  // Send SMS invitations to phone-only guests
  for (const guest of phoneOnlyGuests) {
    const rsvpUrl = `${origin}/rsvp/${guest.rsvp_token}`;
    const smsBody = composeSmsInvitation({
      guestName: guest.name,
      eventTitle: e.title,
      eventDate: formatDate(e.start_time),
      eventTime: formatTime(e.start_time),
      hostName,
      rsvpUrl,
    });

    const result = await sendSms(guest.phone!, smsBody);

    if (result.success) {
      await supabase
        .from("guests")
        .update({ invited_at: new Date().toISOString() })
        .eq("id", guest.id);

      smsSent++;
    } else {
      console.error(`Failed to send SMS to ${guest.phone}:`, result.error);
      failed++;
    }
  }

  return NextResponse.json({ emailsSent, smsSent, failed });
}

/**
 * Compose SMS invitation message body.
 * Kept concise to fit SMS character limits while including essential info.
 */
function composeSmsInvitation({
  guestName,
  eventTitle,
  eventDate,
  eventTime,
  hostName,
  rsvpUrl,
}: {
  guestName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  hostName: string;
  rsvpUrl: string;
}): string {
  return `Hi ${guestName}! You're invited to ${eventTitle} on ${eventDate} at ${eventTime}. ${hostName} would love to see you there. RSVP here: ${rsvpUrl}`;
}
