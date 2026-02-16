import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResendClient } from "@/lib/resend";
import { invitationEmail } from "@/lib/emailTemplates";
import { formatDate, formatTime } from "@/lib/utils";
import { emailSendLimiter } from "@/lib/rateLimit";
import { sanitizeError } from "@/lib/apiResponse";
import type { Event, Guest } from "@/lib/types";

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

  const resend = getResendClient();
  if (!resend) {
    return NextResponse.json(
      { error: "Email not configured. Set RESEND_API_KEY to enable invitations." },
      { status: 503 }
    );
  }

  const body = await request.json();
  const guestIds: string[] | undefined = body.guest_ids;

  let query = supabase
    .from("guests")
    .select("*")
    .eq("event_id", id)
    .not("email", "is", null);

  if (guestIds) {
    query = query.in("id", guestIds);
  }

  const { data: guests } = await query;
  if (!guests || guests.length === 0) {
    return NextResponse.json({ error: "No guests with email addresses" }, { status: 400 });
  }

  const e = event as Event;
  const origin = new URL(request.url).origin;
  let sent = 0;
  let failed = 0;

  for (const guest of guests as Guest[]) {
    if (!guest.email) continue;

    const email = invitationEmail({
      guestName: guest.name,
      eventTitle: e.title,
      eventDate: formatDate(e.start_time),
      eventTime: formatTime(e.start_time),
      eventLocation: e.location,
      rsvpUrl: `${origin}/rsvp/${guest.rsvp_token}`,
    });

    try {
      await resend.emails.send({
        from: "Shindig <noreply@shindig.app>",
        to: guest.email,
        subject: email.subject,
        html: email.html,
      });

      await supabase
        .from("guests")
        .update({ invited_at: new Date().toISOString() })
        .eq("id", guest.id);

      sent++;
    } catch (err) {
      console.error(`Failed to send to ${guest.email}:`, sanitizeError(err));
      failed++;
    }
  }

  return NextResponse.json({ sent, failed });
}
