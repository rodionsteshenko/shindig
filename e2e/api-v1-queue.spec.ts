import { test, expect } from "@playwright/test";
import { ensureTestUser, loginAsTestUser, cleanupTestData, adminClient, seedApiKey } from "./helpers";

/**
 * E2E tests for Queue Management API routes
 *
 * Tests:
 * - GET /api/v1/features/queue (list queued features, requires features:read scope)
 * - POST /api/v1/features/[id]/queue (queue a feature, session auth only)
 * - PUT /api/v1/features/[id]/implementation (update implementation status, requires features:read scope)
 *
 * Note: These tests require migration 002_api_keys_and_features_v2.sql to be applied.
 * Tests that require these tables/columns will skip gracefully if not available.
 */

let testUserId: string;
let apiKeysTableExists = false;
let implementationStatusColumnExists = false;

test.beforeAll(async () => {
  testUserId = await ensureTestUser();

  // Check if api_keys table exists
  const supabase = adminClient();
  const { error: apiKeysError } = await supabase.from("api_keys").select("*").limit(0);
  apiKeysTableExists = !apiKeysError;

  // Check if implementation_status column exists
  const { error: implStatusError } = await supabase
    .from("feature_requests")
    .select("implementation_status")
    .limit(0);
  implementationStatusColumnExists = !implStatusError;

  if (!apiKeysTableExists || !implementationStatusColumnExists) {
    console.log("⚠️  Queue management tests require migration 002_api_keys_and_features_v2.sql");
    console.log("   Some tests will be skipped.");
  }
});

test.afterAll(async () => {
  await cleanupTestData();
});

/**
 * Helper to create a test feature request with queued status
 */
async function seedQueuedFeature(overrides?: Record<string, unknown>) {
  if (!implementationStatusColumnExists) {
    throw new Error("implementation_status column not found - migration not applied");
  }

  const supabase = adminClient();

  const { data, error } = await supabase
    .from("feature_requests")
    .insert({
      title: "E2E Test Queued Feature",
      description: "A test feature for queue testing",
      author_name: "Test Author",
      implementation_status: "queued",
      prd_json: { test: true },
      ...overrides,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to seed queued feature: ${error.message}`);
  return data;
}

/**
 * Helper to create a test feature request
 */
async function seedFeature(overrides?: Record<string, unknown>) {
  const supabase = adminClient();

  // Build insert data, optionally including implementation_status if column exists
  const insertData: Record<string, unknown> = {
    title: "E2E Test Feature Queue",
    description: "A test feature for queue testing",
    author_name: "Test Author",
  };

  // If implementation_status column exists and override is provided, include it
  if (implementationStatusColumnExists && overrides?.implementation_status !== undefined) {
    insertData.implementation_status = overrides.implementation_status;
  }

  // If prd_json column exists and override is provided, include it
  if (implementationStatusColumnExists && overrides?.prd_json !== undefined) {
    insertData.prd_json = overrides.prd_json;
  }

  // Add other overrides (excluding special fields we handled)
  const { implementation_status: _impl, prd_json: _prd, ...restOverrides } = overrides || {};
  Object.assign(insertData, restOverrides);

  const { data, error } = await supabase
    .from("feature_requests")
    .insert(insertData)
    .select()
    .single();

  if (error) throw new Error(`Failed to seed feature: ${error.message}`);
  return data;
}

test.describe("GET /api/v1/features/queue (List Queued Features)", () => {

  test("requires authentication", async ({ request }) => {
    const response = await request.get("/api/v1/features/queue");
    expect(response.status()).toBe(401);
    expect((await response.json()).error).toBe("Unauthorized");
  });

  test("requires features:read scope for API key", async ({ request }) => {
    test.skip(!apiKeysTableExists, "api_keys table not found");

    // Create API key without features:read scope
    const { key } = await seedApiKey(testUserId, {
      scopes: ["events:read"],
      name: "E2E Test Key No Features Scope",
    });

    const response = await request.get("/api/v1/features/queue", {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
    expect(response.status()).toBe(403);
    expect((await response.json()).error).toContain("features:read");
  });

  test("returns queued features with API key having features:read scope", async ({ request }) => {
    test.skip(!apiKeysTableExists || !implementationStatusColumnExists, "migration not applied");

    // Create features with different implementation statuses
    await seedQueuedFeature({ title: "E2E Test Queued List 1", vote_count: 10 });
    await seedQueuedFeature({ title: "E2E Test Queued List 2", vote_count: 20 });
    await seedFeature({ title: "E2E Test Not Queued", implementation_status: "none" });

    // Create API key with features:read scope
    const { key } = await seedApiKey(testUserId, {
      scopes: ["features:read"],
      name: "E2E Test Key Features Read",
    });

    const response = await request.get("/api/v1/features/queue", {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("error");
    expect(body.error).toBeNull();
    expect(Array.isArray(body.data)).toBe(true);

    // All returned features should have implementation_status='queued'
    for (const feature of body.data) {
      expect(feature.implementation_status).toBe("queued");
    }
  });

  test("orders queued features by vote_count descending", async ({ request }) => {
    test.skip(!apiKeysTableExists || !implementationStatusColumnExists, "migration not applied");

    await seedQueuedFeature({ title: "E2E Test Queued Low Votes", vote_count: 5 });
    await seedQueuedFeature({ title: "E2E Test Queued High Votes", vote_count: 100 });
    await seedQueuedFeature({ title: "E2E Test Queued Mid Votes", vote_count: 50 });

    const { key } = await seedApiKey(testUserId, {
      scopes: ["features:read"],
      name: "E2E Test Key Vote Order",
    });

    const response = await request.get("/api/v1/features/queue", {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    // Check that features are ordered by vote_count descending
    for (let i = 1; i < body.data.length; i++) {
      expect(body.data[i - 1].vote_count).toBeGreaterThanOrEqual(body.data[i].vote_count);
    }
  });

  test("works with session auth", async ({ page }) => {
    test.skip(!implementationStatusColumnExists, "migration not applied");

    await loginAsTestUser(page);
    await seedQueuedFeature({ title: "E2E Test Queued Session Auth" });

    const response = await page.request.get("/api/v1/features/queue");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.error).toBeNull();
    expect(Array.isArray(body.data)).toBe(true);
  });
});

test.describe("POST /api/v1/features/[id]/queue (Queue Feature)", () => {

  test("requires authentication", async ({ request }) => {
    test.skip(!implementationStatusColumnExists, "migration not applied");

    const feature = await seedFeature({ title: "E2E Test Queue Auth Required" });

    const response = await request.post(`/api/v1/features/${feature.id}/queue`);
    expect(response.status()).toBe(401);
    expect((await response.json()).error).toBe("Unauthorized");
  });

  test("requires session auth, not API key", async ({ request }) => {
    test.skip(!apiKeysTableExists || !implementationStatusColumnExists, "migration not applied");

    const feature = await seedFeature({
      title: "E2E Test Queue Session Only",
      prd_json: { test: true },
    });
    const { key } = await seedApiKey(testUserId, {
      scopes: ["features:read", "features:write"],
      name: "E2E Test Key Queue Attempt",
    });

    const response = await request.post(`/api/v1/features/${feature.id}/queue`, {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
    expect(response.status()).toBe(403);
    expect((await response.json()).error).toBe("Session authentication required");
  });

  test("returns error if prd_json not set", async ({ page }) => {
    test.skip(!implementationStatusColumnExists, "migration not applied");

    await loginAsTestUser(page);
    const feature = await seedFeature({
      title: "E2E Test Queue No PRD",
      prd_json: null,
    });

    const response = await page.request.post(`/api/v1/features/${feature.id}/queue`);
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("PRD must be generated");
  });

  test("queues feature with session auth when prd_json is set", async ({ page }) => {
    test.skip(!implementationStatusColumnExists, "migration not applied");

    await loginAsTestUser(page);
    const feature = await seedFeature({
      title: "E2E Test Queue Success",
      prd_json: { title: "Test PRD", description: "Test description" },
      implementation_status: "none",
    });

    const response = await page.request.post(`/api/v1/features/${feature.id}/queue`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("error");
    expect(body.error).toBeNull();
    expect(body.data.id).toBe(feature.id);
    expect(body.data.implementation_status).toBe("queued");
  });

  test("returns 404 for non-existent feature", async ({ page }) => {
    await loginAsTestUser(page);

    const response = await page.request.post(
      "/api/v1/features/00000000-0000-0000-0000-000000000000/queue"
    );
    expect(response.status()).toBe(404);
    expect((await response.json()).error).toBe("Feature not found");
  });

  test("returns 400 for invalid UUID format", async ({ page }) => {
    await loginAsTestUser(page);

    const response = await page.request.post("/api/v1/features/not-a-uuid/queue");
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("Invalid");
  });
});

test.describe("PUT /api/v1/features/[id]/implementation (Update Implementation Status)", () => {

  test("requires authentication", async ({ request }) => {
    test.skip(!implementationStatusColumnExists, "migration not applied");

    const feature = await seedQueuedFeature({ title: "E2E Test Impl Auth Required" });

    const response = await request.put(`/api/v1/features/${feature.id}/implementation`, {
      data: { status: "in_progress" },
    });
    expect(response.status()).toBe(401);
    expect((await response.json()).error).toBe("Unauthorized");
  });

  test("requires features:read scope for API key", async ({ request }) => {
    test.skip(!apiKeysTableExists || !implementationStatusColumnExists, "migration not applied");

    const feature = await seedQueuedFeature({ title: "E2E Test Impl Scope Required" });
    const { key } = await seedApiKey(testUserId, {
      scopes: ["events:read"],
      name: "E2E Test Key No Impl Scope",
    });

    const response = await request.put(`/api/v1/features/${feature.id}/implementation`, {
      headers: {
        Authorization: `Bearer ${key}`,
      },
      data: { status: "in_progress" },
    });
    expect(response.status()).toBe(403);
    expect((await response.json()).error).toContain("features:read");
  });

  test("updates implementation status with API key", async ({ request }) => {
    test.skip(!apiKeysTableExists || !implementationStatusColumnExists, "migration not applied");

    const feature = await seedQueuedFeature({ title: "E2E Test Impl API Key" });
    const { key } = await seedApiKey(testUserId, {
      scopes: ["features:read"],
      name: "E2E Test Key Impl Update",
    });

    const response = await request.put(`/api/v1/features/${feature.id}/implementation`, {
      headers: {
        Authorization: `Bearer ${key}`,
      },
      data: { status: "in_progress" },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("error");
    expect(body.error).toBeNull();
    expect(body.data.id).toBe(feature.id);
    expect(body.data.implementation_status).toBe("in_progress");
  });

  test("updates to various valid statuses", async ({ request }) => {
    test.skip(!apiKeysTableExists || !implementationStatusColumnExists, "migration not applied");

    const feature = await seedQueuedFeature({ title: "E2E Test Impl All Statuses" });
    const { key } = await seedApiKey(testUserId, {
      scopes: ["features:read"],
      name: "E2E Test Key All Impl Statuses",
    });

    const statuses = ["in_progress", "completed", "failed"];
    for (const status of statuses) {
      const response = await request.put(`/api/v1/features/${feature.id}/implementation`, {
        headers: {
          Authorization: `Bearer ${key}`,
        },
        data: { status },
      });
      expect(response.status()).toBe(200);
      expect((await response.json()).data.implementation_status).toBe(status);
    }
  });

  test("validates status field", async ({ request }) => {
    test.skip(!apiKeysTableExists || !implementationStatusColumnExists, "migration not applied");

    const feature = await seedQueuedFeature({ title: "E2E Test Impl Invalid Status" });
    const { key } = await seedApiKey(testUserId, {
      scopes: ["features:read"],
      name: "E2E Test Key Invalid Impl Status",
    });

    // Test invalid status
    const response1 = await request.put(`/api/v1/features/${feature.id}/implementation`, {
      headers: {
        Authorization: `Bearer ${key}`,
      },
      data: { status: "invalid" },
    });
    expect(response1.status()).toBe(400);
    expect((await response1.json()).error).toContain("Invalid status");

    // Test missing status
    const response2 = await request.put(`/api/v1/features/${feature.id}/implementation`, {
      headers: {
        Authorization: `Bearer ${key}`,
      },
      data: {},
    });
    expect(response2.status()).toBe(400);
    expect((await response2.json()).error).toContain("Status field is required");
  });

  test("returns 404 for non-existent feature", async ({ request }) => {
    test.skip(!apiKeysTableExists, "api_keys table not found");

    const { key } = await seedApiKey(testUserId, {
      scopes: ["features:read"],
      name: "E2E Test Key Impl 404",
    });

    const response = await request.put(
      "/api/v1/features/00000000-0000-0000-0000-000000000000/implementation",
      {
        headers: {
          Authorization: `Bearer ${key}`,
        },
        data: { status: "in_progress" },
      }
    );
    expect(response.status()).toBe(404);
  });

  test("returns 400 for invalid UUID format", async ({ request }) => {
    test.skip(!apiKeysTableExists, "api_keys table not found");

    const { key } = await seedApiKey(testUserId, {
      scopes: ["features:read"],
      name: "E2E Test Key Impl Invalid UUID",
    });

    const response = await request.put("/api/v1/features/not-a-uuid/implementation", {
      headers: {
        Authorization: `Bearer ${key}`,
      },
      data: { status: "in_progress" },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("Invalid");
  });

  test("works with session auth", async ({ page }) => {
    test.skip(!implementationStatusColumnExists, "migration not applied");

    await loginAsTestUser(page);
    const feature = await seedQueuedFeature({ title: "E2E Test Impl Session Auth" });

    const response = await page.request.put(`/api/v1/features/${feature.id}/implementation`, {
      data: { status: "completed" },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.error).toBeNull();
    expect(body.data.implementation_status).toBe("completed");
  });
});
