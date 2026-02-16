import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { voteLimiter } from "@/lib/rateLimit";
import { sanitizeError } from "@/lib/apiResponse";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limit votes
  const limit = voteLimiter(request);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();

  // Use a voter identifier — could be user ID if logged in, or a fingerprint/IP
  const voterIdentifier = body.voter_identifier;
  if (!voterIdentifier) {
    return NextResponse.json({ error: "voter_identifier is required" }, { status: 400 });
  }

  try {
    // Check if already voted
    const { data: existing } = await supabase
      .from("feature_votes")
      .select("id")
      .eq("feature_id", id)
      .eq("voter_identifier", voterIdentifier)
      .single();

    if (existing) {
      // Remove vote (toggle off)
      await supabase.from("feature_votes").delete().eq("id", existing.id);

      // Decrement vote count
      const { data: feature } = await supabase
        .from("feature_requests")
        .select("vote_count")
        .eq("id", id)
        .single();

      if (feature) {
        await supabase
          .from("feature_requests")
          .update({ vote_count: Math.max(0, feature.vote_count - 1) })
          .eq("id", id);
      }

      return NextResponse.json({ voted: false });
    }

    // Add vote
    const { error } = await supabase
      .from("feature_votes")
      .insert({ feature_id: id, voter_identifier: voterIdentifier });

    if (error) {
      return NextResponse.json({ error: sanitizeError(error) }, { status: 400 });
    }

    // Increment vote count
    const { data: feature } = await supabase
      .from("feature_requests")
      .select("vote_count")
      .eq("id", id)
      .single();

    if (feature) {
      await supabase
        .from("feature_requests")
        .update({ vote_count: feature.vote_count + 1 })
        .eq("id", id);
    }

    return NextResponse.json({ voted: true });
  } catch (err) {
    return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
  }
}
