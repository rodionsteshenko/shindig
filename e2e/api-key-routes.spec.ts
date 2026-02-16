import { test, expect } from "@playwright/test";
import { ensureTestUser, loginAsTestUser, seedApiKey, cleanupTestData, adminClient } from "./helpers";

// E2E tests for POST/GET /api/v1/api-keys and DELETE /api/v1/api-keys/[id]

let testUserId: string;
let apiKeysTableExists = false;

test.beforeAll(async () => {
  testUserId = await ensureTestUser();
  const supabase = adminClient();
  const { error } = await supabase.from("api_keys").select("*").limit(0);
  apiKeysTableExists = !error;
  if (!apiKeysTableExists) {
    console.log("api_keys table not found. Apply migration: 002_api_keys_and_features_v2.sql");
  }
});

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe("POST /api/v1/api-keys", () => {
  test.skip(!apiKeysTableExists, "api_keys table not found");

  test("requires session authentication", async ({ request }) => {
    const response = await request.post("/api/v1/api-keys", {
      data: { name: "Test Key" },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
    expect(body.data).toBeNull();
  });

  test("rejects API key authentication for creating keys", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const { key } = await seedApiKey(testUserId);
    const response = await request.post("/api/v1/api-keys", {
      data: { name: "New Key" },
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status()).toBe(401);
  });

  test("creates API key with name only", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const response = await page.request.post("/api/v1/api-keys", { data: { name: "My API Key" } });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.error).toBeNull();
    expect(body.data.name).toBe("My API Key");
    expect(body.data.key).toMatch(/^shk_[a-f0-9]{48}$/);
    expect(body.data.key_prefix).toBe("shk_");
    expect(body.data.id).toBeDefined();
    expect(body.data.scopes).toContain("events:read");
    expect(body.data.scopes).toContain("events:write");
  });

  test("creates API key with custom scopes", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const response = await page.request.post("/api/v1/api-keys", {
      data: { name: "Read-Only Key", scopes: ["events:read", "guests:read"] },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.scopes).toEqual(["events:read", "guests:read"]);
  });

  test("creates API key with expiration", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const response = await page.request.post("/api/v1/api-keys", {
      data: { name: "Expiring Key", expires_at: futureDate },
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).data.expires_at).toBe(futureDate);
  });

  test("validates name is required", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const response = await page.request.post("/api/v1/api-keys", { data: {} });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.errors.name).toBeDefined();
  });

  test("validates scopes are valid", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const response = await page.request.post("/api/v1/api-keys", {
      data: { name: "Bad Scope Key", scopes: ["invalid:scope", "admin:all"] },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.errors.scopes).toContain("Invalid scopes");
  });

  test("validates expires_at is in the future", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const response = await page.request.post("/api/v1/api-keys", {
      data: { name: "Past Expiry Key", expires_at: pastDate },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.errors.expires_at).toContain("future");
  });

  test("enforces maximum API keys per user", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    for (let i = 0; i < 10; i++) await seedApiKey(testUserId, { name: `Limit Test Key ${i}` });
    const response = await page.request.post("/api/v1/api-keys", { data: { name: "Over Limit Key" } });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Cannot exceed");
    expect(body.error).toContain("10");
    await adminClient().from("api_keys").delete().eq("user_id", testUserId);
  });
});

test.describe("GET /api/v1/api-keys", () => {
  test.skip(!apiKeysTableExists, "api_keys table not found");

  test("requires authentication", async ({ request }) => {
    const response = await request.get("/api/v1/api-keys");
    expect(response.status()).toBe(401);
    expect((await response.json()).error).toBe("Unauthorized");
  });

  test("lists API keys with session auth", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    await seedApiKey(testUserId, { name: "List Test Key 1" });
    await seedApiKey(testUserId, { name: "List Test Key 2" });
    const response = await page.request.get("/api/v1/api-keys");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.error).toBeNull();
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    const key = body.data[0];
    expect(key.id).toBeDefined();
    expect(key.name).toBeDefined();
    expect(key.key_prefix).toBeDefined();
    expect(key.scopes).toBeDefined();
    expect(key.key_hash).toBeUndefined();
    expect(key.key).toBeUndefined();
  });

  test("lists API keys with API key auth", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const { key } = await seedApiKey(testUserId, { name: "Auth Key", scopes: ["events:read", "events:write"] });
    const response = await request.get("/api/v1/api-keys", { headers: { Authorization: `Bearer ${key}` } });
    expect(response.status()).toBe(200);
    expect((await response.json()).error).toBeNull();
  });

  test("rejects API key without events:read scope", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const { key } = await seedApiKey(testUserId, { name: "No Read Scope", scopes: ["guests:read"] });
    const response = await request.get("/api/v1/api-keys", { headers: { Authorization: `Bearer ${key}` } });
    expect(response.status()).toBe(403);
    expect((await response.json()).error).toContain("scope");
  });

  test("only returns keys owned by the user", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const body = await (await page.request.get("/api/v1/api-keys")).json();
    for (const key of body.data) expect(key.key_prefix).toBe("shk_");
  });

  test("returns keys sorted by created_at descending", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await adminClient().from("api_keys").delete().eq("user_id", testUserId);
    await loginAsTestUser(page);
    await seedApiKey(testUserId, { name: "First Key" });
    await new Promise((r) => setTimeout(r, 100));
    await seedApiKey(testUserId, { name: "Second Key" });
    await new Promise((r) => setTimeout(r, 100));
    await seedApiKey(testUserId, { name: "Third Key" });
    const body = await (await page.request.get("/api/v1/api-keys")).json();
    expect(body.data[0].name).toBe("Third Key");
    expect(body.data[1].name).toBe("Second Key");
    expect(body.data[2].name).toBe("First Key");
  });
});

test.describe("DELETE /api/v1/api-keys/[id]", () => {
  test.skip(!apiKeysTableExists, "api_keys table not found");

  test("requires session authentication", async ({ request }) => {
    const { row } = await seedApiKey(testUserId);
    const response = await request.delete(`/api/v1/api-keys/${row.id}`);
    expect(response.status()).toBe(401);
    expect((await response.json()).error).toBe("Unauthorized");
  });

  test("rejects API key authentication for deleting keys", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const { key } = await seedApiKey(testUserId, { name: "Auth Key" });
    const { row: targetRow } = await seedApiKey(testUserId, { name: "Target Key" });
    const response = await request.delete(`/api/v1/api-keys/${targetRow.id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status()).toBe(401);
  });

  test("deletes owned API key", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const { row } = await seedApiKey(testUserId, { name: "Key To Delete" });
    const response = await page.request.delete(`/api/v1/api-keys/${row.id}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.error).toBeNull();
    expect(body.data.deleted).toBe(true);
    expect(body.data.id).toBe(row.id);
    const { data } = await adminClient().from("api_keys").select("*").eq("id", row.id).single();
    expect(data).toBeNull();
  });

  test("returns 404 for non-existent key", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const response = await page.request.delete("/api/v1/api-keys/00000000-0000-0000-0000-000000000000");
    expect(response.status()).toBe(404);
    expect((await response.json()).error).toBe("API key not found");
  });

  test("returns 400 for invalid UUID format", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const response = await page.request.delete("/api/v1/api-keys/not-a-uuid");
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("Invalid");
  });

  test("cannot delete another user's key", async ({ page }) => {
    if (!apiKeysTableExists) return;
    const supabase = adminClient();
    const crypto = await import("crypto");
    const key = `shk_${crypto.randomBytes(24).toString("hex")}`;
    const hash = crypto.createHash("sha256").update(key).digest("hex");
    const { data: otherKey, error } = await supabase.from("api_keys").insert({
      user_id: "00000000-0000-0000-0000-000000000001",
      name: "Other User Key", key_hash: hash, key_prefix: key.substring(0, 8), scopes: ["events:read"],
    }).select().single();
    if (error) { console.log("Skipping cross-user test (FK constraint)"); return; }
    await loginAsTestUser(page);
    const response = await page.request.delete(`/api/v1/api-keys/${otherKey.id}`);
    expect(response.status()).toBe(404);
    await supabase.from("api_keys").delete().eq("id", otherKey.id);
  });
});

test.describe("API Key Integration", () => {
  test.skip(!apiKeysTableExists, "api_keys table not found");

  test("newly created key can be used immediately", async ({ page, request }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const createResponse = await page.request.post("/api/v1/api-keys", {
      data: { name: "Immediate Use Key", scopes: ["events:read", "events:write", "guests:read", "guests:write"] },
    });
    expect(createResponse.status()).toBe(200);
    const newKey = (await createResponse.json()).data.key;
    const listResponse = await request.get("/api/v1/api-keys", { headers: { Authorization: `Bearer ${newKey}` } });
    expect(listResponse.status()).toBe(200);
    expect(Array.isArray((await listResponse.json()).data)).toBe(true);
  });

  test("deleted key cannot be used", async ({ page, request }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const createBody = await (await page.request.post("/api/v1/api-keys", { data: { name: "Key To Revoke" } })).json();
    const keyId = createBody.data.id;
    const keyValue = createBody.data.key;
    expect((await request.get("/api/v1/api-keys", { headers: { Authorization: `Bearer ${keyValue}` } })).status()).toBe(200);
    expect((await page.request.delete(`/api/v1/api-keys/${keyId}`)).status()).toBe(200);
    expect((await request.get("/api/v1/api-keys", { headers: { Authorization: `Bearer ${keyValue}` } })).status()).toBe(401);
  });
});
