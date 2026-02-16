/**
 * Standardized API response envelope for v1 API routes.
 * Existing (non-v1) routes keep their current response shapes.
 */

import { NextResponse } from "next/server";

export function success<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json({ data, error: null, meta: meta ?? null });
}

export function error(message: string, status: number) {
  return NextResponse.json({ data: null, error: message }, { status });
}

export function validationError(errors: Record<string, string>) {
  return NextResponse.json(
    { data: null, error: "Validation failed", errors },
    { status: 400 }
  );
}

export function rateLimitError(retryAfter: number) {
  return NextResponse.json(
    { data: null, error: "Too many requests" },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    }
  );
}

export function paginatedSuccess<T>(
  data: T[],
  page: number,
  perPage: number,
  total: number
) {
  return NextResponse.json({
    data,
    error: null,
    meta: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
    },
  });
}

/**
 * Strip Supabase/SQL internals from error messages.
 * Returns a generic message for production safety.
 */
export function sanitizeError(err: unknown): string {
  if (process.env.NODE_ENV === "development") {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    // Supabase errors are objects with a message property
    if (err && typeof err === "object" && "message" in err) {
      return String((err as { message: unknown }).message);
    }
  }
  return "An unexpected error occurred";
}
