import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const { data, error } = await supabase
    .from("events")
    .update({
      title: body.title,
      description: body.description,
      location: body.location,
      maps_url: body.maps_url,
      cover_image_url: body.cover_image_url,
      start_time: body.start_time,
      end_time: body.end_time,
      timezone: body.timezone,
      is_public: body.is_public,
      allow_plus_ones: body.allow_plus_ones,
      gift_registry_url: body.gift_registry_url,
      gift_message: body.gift_message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("host_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", id)
    .eq("host_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
