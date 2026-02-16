import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const voter = searchParams.get("voter");

  if (!voter) {
    return NextResponse.json([]);
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("feature_votes")
    .select("feature_id")
    .eq("voter_identifier", voter);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
