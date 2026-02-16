import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateFeatureInput } from "@/lib/validation";
import { featureSubmitLimiter } from "@/lib/rateLimit";
import { sanitizeError } from "@/lib/apiResponse";

export async function GET() {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("feature_requests")
      .select("*")
      .order("vote_count", { ascending: false });

    if (error) {
      return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Rate limit feature submissions
  const limit = featureSubmitLimiter(request);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const supabase = await createClient();
  const body = await request.json();

  // Validate input
  const validation = validateFeatureInput(body);
  if (!validation.valid) {
    return NextResponse.json({ error: "Validation failed", errors: validation.errors }, { status: 400 });
  }

  try {
    const baseData = {
      title: body.title.trim(),
      description: body.description?.trim() || null,
      author_name: body.author_name?.trim() || "Anonymous",
      author_email: body.author_email?.trim() || null,
    };

    // Try with type field first; fall back without it if column doesn't exist
    const insertData = body.type
      ? { ...baseData, type: body.type.trim() }
      : baseData;

    let { data, error } = await supabase
      .from("feature_requests")
      .insert(insertData)
      .select()
      .single();

    // If type column doesn't exist, retry without it
    if (error && body.type && (error.code === "42703" || error.message?.includes("type"))) {
      ({ data, error } = await supabase
        .from("feature_requests")
        .insert(baseData)
        .select()
        .single());
    }

    if (error) {
      return NextResponse.json({ error: sanitizeError(error) }, { status: 400 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
  }
}
