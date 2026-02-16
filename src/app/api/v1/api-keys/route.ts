import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateApiKey,
  authenticateRequest,
  hasScope,
} from "@/lib/apiKeyAuth";
import { success, error, validationError, sanitizeError } from "@/lib/apiResponse";
import type { ApiKey } from "@/lib/types";

/**
 * Maximum number of API keys per user
 */
const MAX_API_KEYS_PER_USER = 10;

/**
 * Valid scopes that can be assigned to API keys
 */
const VALID_SCOPES = [
  "events:read",
  "events:write",
  "guests:read",
  "guests:write",
  "rsvp:read",
  "rsvp:write",
] as const;

interface CreateApiKeyInput {
  name: string;
  scopes?: string[];
  expires_at?: string;
}

function validateCreateApiKeyInput(body: unknown): {
  valid: boolean;
  errors: Record<string, string>;
  data?: CreateApiKeyInput;
} {
  const errors: Record<string, string> = {};

  if (!body || typeof body !== "object") {
    return { valid: false, errors: { body: "Request body is required" } };
  }

  const input = body as Record<string, unknown>;

  // Validate name
  if (!input.name || typeof input.name !== "string") {
    errors.name = "Name is required and must be a string";
  } else if (input.name.length < 1 || input.name.length > 100) {
    errors.name = "Name must be between 1 and 100 characters";
  }

  // Validate scopes (optional)
  let scopes: string[] | undefined;
  if (input.scopes !== undefined) {
    if (!Array.isArray(input.scopes)) {
      errors.scopes = "Scopes must be an array";
    } else {
      const invalidScopes = input.scopes.filter(
        (s) => typeof s !== "string" || !VALID_SCOPES.includes(s as typeof VALID_SCOPES[number])
      );
      if (invalidScopes.length > 0) {
        errors.scopes = `Invalid scopes: ${invalidScopes.join(", ")}. Valid scopes are: ${VALID_SCOPES.join(", ")}`;
      } else {
        scopes = input.scopes as string[];
      }
    }
  }

  // Validate expires_at (optional)
  let expires_at: string | undefined;
  if (input.expires_at !== undefined) {
    if (typeof input.expires_at !== "string") {
      errors.expires_at = "expires_at must be an ISO 8601 date string";
    } else {
      const date = new Date(input.expires_at);
      if (isNaN(date.getTime())) {
        errors.expires_at = "expires_at must be a valid ISO 8601 date string";
      } else if (date <= new Date()) {
        errors.expires_at = "expires_at must be in the future";
      } else {
        expires_at = input.expires_at;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    data: {
      name: input.name as string,
      scopes,
      expires_at,
    },
  };
}

/**
 * POST /api/v1/api-keys
 *
 * Creates a new API key. Session auth only (cannot create keys via API key).
 * Returns the full key ONCE - it cannot be retrieved again.
 */
export async function POST(request: Request) {
  // Session auth only - creating API keys requires full user auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return error("Unauthorized", 401);
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON in request body", 400);
  }

  const validation = validateCreateApiKeyInput(body);
  if (!validation.valid) {
    return validationError(validation.errors);
  }

  const input = validation.data!;
  const adminClient = createAdminClient();

  // Check API key count limit
  const { count } = await adminClient
    .from("api_keys")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) >= MAX_API_KEYS_PER_USER) {
    return error(`Cannot exceed ${MAX_API_KEYS_PER_USER} API keys per account`, 400);
  }

  try {
    // Generate the key
    const generated = await generateApiKey();

    // Default scopes to full access if not specified
    const scopes = input.scopes ?? [...VALID_SCOPES];

    // Insert into database
    const { data: apiKey, error: dbError } = await adminClient
      .from("api_keys")
      .insert({
        user_id: user.id,
        name: input.name,
        key_hash: generated.hash,
        key_prefix: generated.prefix,
        scopes,
        expires_at: input.expires_at ?? null,
      })
      .select()
      .single<ApiKey>();

    if (dbError) {
      return error(sanitizeError(dbError), 400);
    }

    // Return the full key (only time it's visible) along with metadata
    return success({
      id: apiKey.id,
      key: generated.key, // Full key shown ONCE
      name: apiKey.name,
      key_prefix: apiKey.key_prefix,
      scopes: apiKey.scopes,
      expires_at: apiKey.expires_at,
      created_at: apiKey.created_at,
    });
  } catch (err) {
    return error(sanitizeError(err), 500);
  }
}

/**
 * GET /api/v1/api-keys
 *
 * Lists the user's API keys. Supports both session and API key auth.
 * Never returns the key_hash field.
 */
export async function GET(request: Request) {
  // Support both session and API key auth
  const auth = await authenticateRequest(request);

  if (!auth) {
    return error("Unauthorized", 401);
  }

  // Check scope for API key auth
  if (!hasScope(auth.scopes, "events:read")) {
    return error("Insufficient scope: events:read required", 403);
  }

  const adminClient = createAdminClient();

  try {
    const { data: apiKeys, error: dbError } = await adminClient
      .from("api_keys")
      .select("id, name, key_prefix, scopes, last_used_at, expires_at, created_at")
      .eq("user_id", auth.user_id)
      .order("created_at", { ascending: false });

    if (dbError) {
      return error(sanitizeError(dbError), 400);
    }

    return success(apiKeys);
  } catch (err) {
    return error(sanitizeError(err), 500);
  }
}
