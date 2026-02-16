import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateSlug } from "@/lib/utils";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const slug = generateSlug(body.title);

  const { data, error } = await supabase
    .from("events")
    .insert({
      host_id: user.id,
      title: body.title,
      description: body.description,
      location: body.location,
      maps_url: body.maps_url,
      cover_image_url: body.cover_image_url,
      start_time: body.start_time,
      end_time: body.end_time,
      timezone: body.timezone,
      slug,
      is_public: body.is_public,
      allow_plus_ones: body.allow_plus_ones,
      gift_registry_url: body.gift_registry_url,
      gift_message: body.gift_message,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
