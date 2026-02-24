import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEndpointLimiter } from "@/lib/rateLimit";
import { normalizePhone } from "@/lib/phone";

/**
 * POST /api/events/[slug]/register
 *
 * Public open registration endpoint.
 * Allows anyone to self-register as a guest for events with allow_open_rsvp enabled.
 * No authentication required.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimit = publicEndpointLimiter(request);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  const { slug } = await params;

  if (!slug || typeof slug !== "string" || slug.length > 200) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  // Parse request body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate name (required)
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 200) {
    return NextResponse.json(
      { error: "Name is required (max 200 characters)" },
      { status: 400 }
    );
  }

  // Validate email (optional)
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  // Validate phone (optional, normalize to E.164)
  let phone: string | null = null;
  if (body.phone && typeof body.phone === "string" && body.phone.trim()) {
    phone = normalizePhone(body.phone.trim());
    if (!phone) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
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
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (!event.allow_open_rsvp) {
    return NextResponse.json(
      { error: "Open registration is not enabled for this event" },
      { status: 403 }
    );
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
    return NextResponse.json({ error: "Failed to register" }, { status: 500 });
  }

  return NextResponse.json({
    guest_id: guest.id,
    name: guest.name,
    rsvp_token: guest.rsvp_token,
    rsvp_url: `/rsvp/${guest.rsvp_token}`,
  }, { status: 201 });
}
