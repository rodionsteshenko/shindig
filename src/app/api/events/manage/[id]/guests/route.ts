import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const { data: guests, error } = await supabase
    .from("guests")
    .select("*")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(guests);
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
  const guestsToInsert = body.guests.map((g: { name: string; email: string; phone?: string }) => ({
    event_id: id,
    name: g.name,
    email: g.email,
    phone: g.phone || null,
  }));

  const { data: guests, error } = await supabase
    .from("guests")
    .insert(guestsToInsert)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(guests, { status: 201 });
}
