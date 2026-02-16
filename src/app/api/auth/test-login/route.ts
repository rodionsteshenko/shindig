import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Test-only endpoint for E2E tests to sign in with email/password.
 * In production, auth uses magic links only.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { email, password } = await request.json();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return NextResponse.json({ user: data.user });
}
