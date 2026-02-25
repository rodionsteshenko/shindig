import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResendClient } from "@/lib/resend";
import { invitationEmail } from "@/lib/emailTemplates";
import { formatDate, formatTime, stripHtml } from "@/lib/utils";
import { sanitizeError } from "@/lib/apiResponse";
import type { Event, User } from "@/lib/types";

/**
 * GET /api/events/manage/[id]/preview-email
 * Returns the HTML preview of the invitation email
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  // Fetch host's display name
  const { data: hostUser } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .single<Pick<User, "display_name">>();

  const hostName = hostUser?.display_name || user.email?.split("@")[0] || "The host";

  const e = event as Event;
  const origin = new URL(request.url).origin;

  // Generate preview email with placeholder guest data
  const email = invitationEmail({
    guestName: "Guest Name",
    eventTitle: e.title,
    eventDate: formatDate(e.start_time, e.timezone),
    eventTime: formatTime(e.start_time, e.timezone),
    eventLocation: e.location,
    eventDescription: e.description ? stripHtml(e.description) : null,
    coverImageUrl: e.cover_image_url,
    hostName,
    rsvpUrl: `${origin}/rsvp/preview-token`,
  });

  return NextResponse.json({ html: email.html });
}

/**
 * POST /api/events/manage/[id]/preview-email
 * Sends a test invitation email to the host's email address
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  if (!user.email) {
    return NextResponse.json(
      { error: "No email address associated with your account" },
      { status: 400 }
    );
  }

  const resend = getResendClient();
  if (!resend) {
    return NextResponse.json(
      { error: "Email not configured. Set RESEND_API_KEY to enable email." },
      { status: 503 }
    );
  }

  // Fetch host's display name
  const { data: hostUser } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .single<Pick<User, "display_name">>();

  const hostName = hostUser?.display_name || user.email?.split("@")[0] || "The host";

  const e = event as Event;
  const origin = new URL(request.url).origin;

  // Generate test email
  const email = invitationEmail({
    guestName: user.email.split("@")[0],
    eventTitle: e.title,
    eventDate: formatDate(e.start_time, e.timezone),
    eventTime: formatTime(e.start_time, e.timezone),
    eventLocation: e.location,
    eventDescription: e.description ? stripHtml(e.description) : null,
    coverImageUrl: e.cover_image_url,
    hostName,
    rsvpUrl: `${origin}/rsvp/preview-token`,
  });

  try {
    await resend.emails.send({
      from: "Shindig <noreply@shindig.app>",
      to: user.email,
      subject: `[TEST] ${email.subject}`,
      html: email.html,
      text: email.text,
    });

    return NextResponse.json({ success: true, sentTo: user.email });
  } catch (err) {
    console.error("Failed to send test email:", sanitizeError(err));
    return NextResponse.json(
      { error: "Failed to send test email" },
      { status: 500 }
    );
  }
}
