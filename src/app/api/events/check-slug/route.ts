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

  // Check if slug is already taken
  const { data, error } = await supabase
    .from("events")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to check slug availability" }, { status: 500 });
  }

  return NextResponse.json({ available: !data });
}
