import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: guest, error } = await supabase
    .from("guests")
    .select("*, events(*)")
    .eq("rsvp_token", token)
    .single();

  if (error || !guest) {
    return NextResponse.json({ error: "Invalid RSVP link" }, { status: 404 });
  }

  return NextResponse.json(guest);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("guests")
    .update({
      rsvp_status: body.rsvp_status,
      plus_one_count: body.plus_one_count ?? 0,
      dietary: body.dietary || null,
      message: body.message || null,
      responded_at: new Date().toISOString(),
    })
    .eq("rsvp_token", token)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Failed to update RSVP" }, { status: 400 });
  }

  return NextResponse.json(data);
}
