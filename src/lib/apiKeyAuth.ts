import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ApiKey } from "@/lib/types";

/**
 * Result of generating a new API key
 */
export interface GeneratedApiKey {
  /** Full API key to show user once (shk_...) */
  key: string;
  /** SHA-256 hash to store in database */
  hash: string;
  /** First 8 characters for identification */
  prefix: string;
}

/**
 * Result of successful API key authentication
 */
export interface ApiKeyAuthResult {
  user_id: string;
  scopes: string[];
}

/**
 * Result of authenticating a request (via API key or session)
 */
export interface AuthResult {
  user_id: string;
  /** null for session auth, array for API key auth */
  scopes: string[] | null;
  authMethod: "api_key" | "session";
}

/**
 * Generate cryptographically random bytes and encode as hex
 */
async function randomHex(bytes: number): Promise<string> {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Hash a string using SHA-256 (Edge runtime compatible)
 */
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a new API key
 *
 * Returns an object with:
 * - key: The full API key to show the user (only shown once)
 * - hash: SHA-256 hash to store in the database
 * - prefix: First 8 characters for identification
 *
 * Key format: shk_{48 random hex characters}
 */
export async function generateApiKey(): Promise<GeneratedApiKey> {
  // Generate 24 random bytes = 48 hex characters
  const randomPart = await randomHex(24);
  const key = `shk_${randomPart}`;
  const hash = await sha256(key);
  const prefix = key.substring(0, 12);

  return { key, hash, prefix };
}

/**
 * Extract bearer token from Authorization header
 */
function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Authenticate a request using API key
 *
 * Reads the Authorization: Bearer header, hashes the key,
 * looks up in api_keys table, validates expiry, and updates last_used_at.
 *
 * @returns { user_id, scopes } on success, null on failure
 */
export async function authenticateApiKey(
  request: Request
): Promise<ApiKeyAuthResult | null> {
  const token = extractBearerToken(request);
  if (!token) return null;

  // Only process tokens that look like our API keys
  if (!token.startsWith("shk_")) return null;

  const keyHash = await sha256(token);
  const supabase = createAdminClient();

  // Look up the API key by hash
  const { data: apiKey, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .single<ApiKey>();

  if (error || !apiKey) return null;

  // Check expiration
  if (apiKey.expires_at) {
    const expiresAt = new Date(apiKey.expires_at);
    if (expiresAt < new Date()) return null;
  }

  // Update last_used_at (fire and forget - don't block on this)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKey.id)
    .then(() => {});

  return {
    user_id: apiKey.user_id,
    scopes: apiKey.scopes,
  };
}

/**
 * Authenticate a request using either API key or session
 *
 * Tries API key auth first (if Authorization header present),
 * then falls back to Supabase session auth.
 *
 * @returns { user_id, scopes, authMethod } on success, null on failure
 */
export async function authenticateRequest(
  request: Request
): Promise<AuthResult | null> {
  // Try API key auth first
  const apiKeyResult = await authenticateApiKey(request);
  if (apiKeyResult) {
    return {
      user_id: apiKeyResult.user_id,
      scopes: apiKeyResult.scopes,
      authMethod: "api_key",
    };
  }

  // Fall back to session auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    user_id: user.id,
    scopes: null, // Session auth has no scope restrictions
    authMethod: "session",
  };
}

/**
 * Check if required scope is present
 *
 * For session auth (scopes is null), always returns true.
 * For API key auth, checks if the required scope is in the scopes array.
 */
export function hasScope(scopes: string[] | null, scope: string): boolean {
  // Session auth has full access
  if (scopes === null) return true;

  return scopes.includes(scope);
}
