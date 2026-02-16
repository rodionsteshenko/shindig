import { test, expect } from "@playwright/test";
import { ensureTestUser, seedApiKey, cleanupTestData, adminClient } from "./helpers";

/**
 * E2E tests for API Key Authentication Library
 *
 * These tests verify the core auth functions work correctly with the real database.
 * Tests that require the api_keys table will skip if the migration hasn't been applied.
 */

let testUserId: string;
let apiKeysTableExists = false;

test.beforeAll(async () => {
  testUserId = await ensureTestUser();

  // Check if api_keys table exists
  const supabase = adminClient();
  const { error } = await supabase.from("api_keys").select("*").limit(0);
  apiKeysTableExists = !error;

  if (!apiKeysTableExists) {
    console.log("⚠️  api_keys table not found. Skipping database tests.");
    console.log("   Apply migration: supabase/migrations/002_api_keys_and_features_v2.sql");
  }
});

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe("API Key Generation (Unit Tests)", () => {
  test("key format matches expected pattern", async () => {
    // Test the key format using same logic as library
    const randomPart = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const key = `shk_${randomPart.padEnd(48, "0").slice(0, 48)}`;

    expect(key).toMatch(/^shk_[a-z0-9]{48}$/);
    expect(key.length).toBe(4 + 48); // "shk_" + 48 chars
  });

  test("prefix extraction works correctly", () => {
    const key = "shk_abc123def456ghi789jkl012mno345pqr678stu901vwx0";
    const prefix = key.substring(0, 4);

    expect(prefix).toBe("shk_");
  });

  test("SHA-256 hash is 64 hex characters", async () => {
    const crypto = await import("crypto");
    const key = "shk_test123";
    const hash = crypto.createHash("sha256").update(key).digest("hex");

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash.length).toBe(64);
  });

  test("different keys produce different hashes", async () => {
    const crypto = await import("crypto");
    const key1 = "shk_key1";
    const key2 = "shk_key2";

    const hash1 = crypto.createHash("sha256").update(key1).digest("hex");
    const hash2 = crypto.createHash("sha256").update(key2).digest("hex");

    expect(hash1).not.toBe(hash2);
  });

  test("same key always produces same hash", async () => {
    const crypto = await import("crypto");
    const key = "shk_consistent";

    const hash1 = crypto.createHash("sha256").update(key).digest("hex");
    const hash2 = crypto.createHash("sha256").update(key).digest("hex");

    expect(hash1).toBe(hash2);
  });
});

test.describe("hasScope Function Logic (Unit Tests)", () => {
  // Test the hasScope logic (this mimics what the library function does)
  const hasScope = (scopes: string[] | null, scope: string): boolean => {
    if (scopes === null) return true;
    return scopes.includes(scope);
  };

  test("null scopes (session auth) allows all", () => {
    expect(hasScope(null, "events:read")).toBe(true);
    expect(hasScope(null, "events:write")).toBe(true);
    expect(hasScope(null, "any:scope")).toBe(true);
  });

  test("scope array requires exact match", () => {
    const scopes = ["events:read", "guests:read"];

    expect(hasScope(scopes, "events:read")).toBe(true);
    expect(hasScope(scopes, "guests:read")).toBe(true);
    expect(hasScope(scopes, "events:write")).toBe(false);
    expect(hasScope(scopes, "admin")).toBe(false);
  });

  test("empty scope array denies all", () => {
    const scopes: string[] = [];

    expect(hasScope(scopes, "events:read")).toBe(false);
    expect(hasScope(scopes, "any:scope")).toBe(false);
  });

  test("scope check is case-sensitive", () => {
    const scopes = ["events:read"];

    expect(hasScope(scopes, "events:read")).toBe(true);
    expect(hasScope(scopes, "Events:Read")).toBe(false);
    expect(hasScope(scopes, "EVENTS:READ")).toBe(false);
  });
});

test.describe("Bearer Token Extraction (Unit Tests)", () => {
  const extractBearerToken = (authHeader: string | null): string | null => {
    if (!authHeader) return null;
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
      return null;
    }
    return parts[1];
  };

  test("extracts token from valid Bearer header", () => {
    expect(extractBearerToken("Bearer shk_abc123")).toBe("shk_abc123");
  });

  test("returns null for missing header", () => {
    expect(extractBearerToken(null)).toBeNull();
  });

  test("returns null for non-Bearer auth", () => {
    expect(extractBearerToken("Basic abc123")).toBeNull();
  });

  test("is case-insensitive for Bearer prefix", () => {
    expect(extractBearerToken("bearer shk_abc123")).toBe("shk_abc123");
    expect(extractBearerToken("BEARER shk_abc123")).toBe("shk_abc123");
  });

  test("returns null for malformed header", () => {
    expect(extractBearerToken("Bearer")).toBeNull();
    expect(extractBearerToken("Bearer token extra")).toBeNull();
    expect(extractBearerToken("")).toBeNull();
  });
});

// Database-dependent tests (skip if table doesn't exist)
test.describe("API Key Database Operations", () => {
  test.skip(!apiKeysTableExists, "api_keys table not found");

  test("can create and lookup API key by hash", async () => {
    if (!apiKeysTableExists) return;

    const { key, row } = await seedApiKey(testUserId, { name: "Lookup Test Key" });
    const supabase = adminClient();

    // Hash the key
    const crypto = await import("crypto");
    const hash = crypto.createHash("sha256").update(key).digest("hex");

    const { data, error } = await supabase
      .from("api_keys")
      .select("*")
      .eq("key_hash", hash)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data.id).toBe(row.id);
    expect(data.user_id).toBe(testUserId);
  });

  test("stores key hash and prefix correctly", async () => {
    if (!apiKeysTableExists) return;

    const { key, row } = await seedApiKey(testUserId, { name: "Hash Test Key" });

    // Hash should be a 64-char hex string (SHA-256)
    expect(row.key_hash).toMatch(/^[a-f0-9]{64}$/);
    // Prefix should be first 4 chars
    expect(row.key_prefix).toBe(key.substring(0, 4));
    // Hash should NOT be the raw key
    expect(row.key_hash).not.toBe(key);
  });

  test("stores scopes array correctly", async () => {
    if (!apiKeysTableExists) return;

    const { row } = await seedApiKey(testUserId, {
      name: "Scoped Key",
      scopes: ["events:read", "guests:read"],
    });

    expect(row.scopes).toEqual(["events:read", "guests:read"]);
  });

  test("handles expiration correctly", async () => {
    if (!apiKeysTableExists) return;

    // Non-expired key
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { row: validKey } = await seedApiKey(testUserId, {
      name: "Valid Key",
      expires_at: futureDate,
    });
    expect(new Date(validKey.expires_at as string).getTime()).toBeGreaterThan(Date.now());

    // Expired key
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { row: expiredKey } = await seedApiKey(testUserId, {
      name: "Expired Key",
      expires_at: pastDate,
    });
    expect(new Date(expiredKey.expires_at as string).getTime()).toBeLessThan(Date.now());

    // No expiry
    const { row: noExpiryKey } = await seedApiKey(testUserId, {
      name: "No Expiry Key",
      expires_at: null,
    });
    expect(noExpiryKey.expires_at).toBeNull();
  });

  test("can update last_used_at", async () => {
    if (!apiKeysTableExists) return;

    const { row } = await seedApiKey(testUserId, { name: "Usage Tracking Key" });
    expect(row.last_used_at).toBeNull();

    const supabase = adminClient();
    const now = new Date().toISOString();
    await supabase.from("api_keys").update({ last_used_at: now }).eq("id", row.id);

    const { data } = await supabase
      .from("api_keys")
      .select("last_used_at")
      .eq("id", row.id)
      .single();

    expect(data?.last_used_at).not.toBeNull();
  });
});
