import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateSlug } from "@/lib/validation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "Slug parameter is required" }, { status: 400 });
  }

  // Validate slug format
  const validation = validateSlug(slug);
  if (!validation.valid) {
    return NextResponse.json({ available: false, error: validation.errors.slug }, { status: 200 });
  }

  const supabase = await createClient();

  // Optional: exclude a specific event ID (for edit mode — the event's own slug is allowed)
  const exclude = searchParams.get("exclude");

  // Check if slug is already taken
  let query = supabase.from("events").select("id").eq("slug", slug);
  if (exclude) {
    query = query.neq("id", exclude);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to check slug availability" }, { status: 500 });
  }

  return NextResponse.json({ available: !data });
}
