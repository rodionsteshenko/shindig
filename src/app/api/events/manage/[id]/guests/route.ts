import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateGuestsArrayInput, MAX_GUESTS_PER_EVENT } from "@/lib/validation";
import { sanitizeError } from "@/lib/apiResponse";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify ownership
  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("id", id)
    .eq("host_id", user.id)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  try {
    const { data: guests, error } = await supabase
      .from("guests")
      .select("*")
      .eq("event_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: sanitizeError(error) }, { status: 400 });
    }

    return NextResponse.json(guests);
  } catch (err) {
    return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
  }
}

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

  // Verify ownership
  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("id", id)
    .eq("host_id", user.id)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const body = await request.json();

  // Validate guest input
  const validation = validateGuestsArrayInput(body);
  if (!validation.valid) {
    return NextResponse.json({ error: "Validation failed", errors: validation.errors }, { status: 400 });
  }

  // Check guest count limit
  const { count } = await supabase
    .from("guests")
    .select("*", { count: "exact", head: true })
    .eq("event_id", id);

  const newCount = (count ?? 0) + body.guests.length;
  if (newCount > MAX_GUESTS_PER_EVENT) {
    return NextResponse.json(
      { error: `Cannot exceed ${MAX_GUESTS_PER_EVENT} guests per event (currently ${count})` },
      { status: 400 }
    );
  }

  const guestsToInsert = body.guests.map((g: { name: string; email: string; phone?: string }) => ({
    event_id: id,
    name: g.name,
    email: g.email,
    phone: g.phone || null,
  }));

  try {
    const { data: guests, error } = await supabase
      .from("guests")
      .insert(guestsToInsert)
      .select();

    if (error) {
      return NextResponse.json({ error: sanitizeError(error) }, { status: 400 });
    }

    return NextResponse.json(guests, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
  }
}
