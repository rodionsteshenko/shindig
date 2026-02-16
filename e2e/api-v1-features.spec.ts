import { test, expect } from "@playwright/test";
import { ensureTestUser, loginAsTestUser, cleanupTestData, adminClient } from "./helpers";

/**
 * E2E tests for /api/v1/features endpoints
 *
 * Tests the Features v1 API:
 * - GET /api/v1/features (list features, paginated, filterable by type and status, public but rate limited)
 * - POST /api/v1/features (submit feature, no auth required, rate limited)
 * - GET /api/v1/features/[id] (single feature, public, rate limited)
 * - PUT /api/v1/features/[id] (update feature status, session auth only)
 *
 * Note: Feature submission has a rate limit of 5 per hour.
 * POST tests are consolidated to stay under this limit.
 */

let testUserId: string;

test.beforeAll(async () => {
  testUserId = await ensureTestUser();
});

test.afterAll(async () => {
  await cleanupTestData();
});

/**
 * Helper to create a test feature request directly in the database
 */
async function seedFeature(overrides?: Record<string, unknown>) {
  const supabase = adminClient();

  const insertData: Record<string, unknown> = {
    title: "E2E Test Feature",
    description: "A test feature for E2E testing",
    author_name: "Test Author",
    ...overrides,
  };

  // Remove type if present - schema may not have it, we use it only when it exists
  if (insertData.type !== undefined) {
    // Check if type column exists by trying to query with it
    const { error: checkError } = await supabase
      .from("feature_requests")
      .select("type")
      .limit(1);

    // If type column doesn't exist, remove it from insert data
    if (checkError && checkError.message.includes("type")) {
      delete insertData.type;
    }
  }

  const { data, error } = await supabase
    .from("feature_requests")
    .insert(insertData)
    .select()
    .single();

  if (error) throw new Error(`Failed to seed feature: ${error.message}`);
  return data;
}

test.describe("GET /api/v1/features (List Features)", () => {

  test("returns features with envelope response format", async ({ request }) => {
    await seedFeature({ title: "E2E Test Public Feature List" });

    const response = await request.get("/api/v1/features");
    expect(response.status()).toBe(200);

    const body = await response.json();
    // Verify envelope structure
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("error");
    expect(body).toHaveProperty("meta");
    expect(body.error).toBeNull();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.page).toBe(1);
    expect(body.meta.per_page).toBe(20);
    expect(typeof body.meta.total).toBe("number");
  });

  test("supports pagination with limits", async ({ request }) => {
    // Seed multiple features
    for (let i = 0; i < 3; i++) {
      await seedFeature({ title: `E2E Test Paginate Feature ${i}` });
    }

    const response = await request.get("/api/v1/features?page=1&per_page=2");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data.length).toBeLessThanOrEqual(2);
    expect(body.meta.page).toBe(1);
    expect(body.meta.per_page).toBe(2);

    // Test per_page cap at 100
    const response2 = await request.get("/api/v1/features?per_page=500");
    expect(response2.status()).toBe(200);
    expect((await response2.json()).meta.per_page).toBe(100);
  });

  test("filters by status", async ({ request }) => {
    // Seed features with different statuses (status column exists in initial schema)
    await seedFeature({ title: "E2E Test Open Status Filter", status: "open" });
    await seedFeature({ title: "E2E Test Planned Status Filter", status: "planned" });

    const response = await request.get("/api/v1/features?status=planned");
    expect(response.status()).toBe(200);

    const body = await response.json();
    for (const feature of body.data) {
      expect(feature.status).toBe("planned");
    }
  });

  test("rejects invalid filters", async ({ request }) => {
    // Test invalid type filter
    const response1 = await request.get("/api/v1/features?type=invalid");
    expect(response1.status()).toBe(400);
    expect((await response1.json()).error).toContain("type");

    // Test invalid status filter
    const response2 = await request.get("/api/v1/features?status=invalid");
    expect(response2.status()).toBe(400);
    expect((await response2.json()).error).toContain("status");
  });

  test("orders features by vote_count descending", async ({ request }) => {
    await seedFeature({ title: "E2E Test Low Votes Order", vote_count: 1 });
    await seedFeature({ title: "E2E Test High Votes Order", vote_count: 100 });
    await seedFeature({ title: "E2E Test Mid Votes Order", vote_count: 50 });

    const response = await request.get("/api/v1/features");
    expect(response.status()).toBe(200);

    const body = await response.json();
    // Check that features are ordered by vote_count descending
    for (let i = 1; i < body.data.length; i++) {
      expect(body.data[i - 1].vote_count).toBeGreaterThanOrEqual(body.data[i].vote_count);
    }
  });
});

test.describe("POST /api/v1/features (Submit Feature)", () => {
  // Rate limit: 5 submissions per hour. Keep total POST requests low.

  test("creates features with validation and defaults", async ({ request }) => {
    // Test 1: Successful creation with all fields and envelope format
    const response1 = await request.post("/api/v1/features", {
      data: {
        title: "E2E Test Full Feature Post",
        description: "Description of the feature",
        author_name: "Test Author",
        type: "bug", // May be ignored if column doesn't exist
      },
    });
    expect(response1.status()).toBe(200);

    const body1 = await response1.json();
    expect(body1.error).toBeNull();
    expect(body1.data.title).toBe("E2E Test Full Feature Post");
    expect(body1.data.description).toBe("Description of the feature");
    expect(body1.data.author_name).toBe("Test Author");
    expect(body1.data.status).toBe("open");
    expect(body1).toHaveProperty("data");
    expect(body1).toHaveProperty("error");
    expect(body1.data).toHaveProperty("id");
    // Note: type may or may not be present depending on schema

    // Test 2: Default author_name is Anonymous
    const response2 = await request.post("/api/v1/features", {
      data: {
        title: "E2E Test Anonymous Feature Post",
      },
    });
    expect(response2.status()).toBe(200);
    expect((await response2.json()).data.author_name).toBe("Anonymous");

    // Test 3: Missing title validation
    const response3 = await request.post("/api/v1/features", {
      data: {
        description: "Missing title",
      },
    });
    expect(response3.status()).toBe(400);
    const body3 = await response3.json();
    expect(body3.error).toBe("Validation failed");
    expect(body3.errors.title).toBeDefined();

    // Test 4: Title too long
    const response4 = await request.post("/api/v1/features", {
      data: {
        title: "A".repeat(201),
      },
    });
    expect(response4.status()).toBe(400);
    expect((await response4.json()).errors.title).toContain("200");
  });
});

test.describe("GET /api/v1/features/[id] (Get Single Feature)", () => {

  test("returns feature by ID with envelope format", async ({ request }) => {
    const feature = await seedFeature({ title: "E2E Test Get Feature Id" });

    const response = await request.get(`/api/v1/features/${feature.id}`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("error");
    expect(body.error).toBeNull();
    expect(body.data.id).toBe(feature.id);
    expect(body.data.title).toBe("E2E Test Get Feature Id");
  });

  test("returns 404 for non-existent feature", async ({ request }) => {
    const response = await request.get("/api/v1/features/00000000-0000-0000-0000-000000000000");
    expect(response.status()).toBe(404);
    expect((await response.json()).error).toBe("Feature not found");
  });

  test("returns 400 for invalid UUID format", async ({ request }) => {
    const response = await request.get("/api/v1/features/not-a-uuid");
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("Invalid");
  });
});

test.describe("PUT /api/v1/features/[id] (Update Feature Status)", () => {

  test("requires authentication", async ({ request }) => {
    const feature = await seedFeature({ title: "E2E Test Update Feature Auth" });

    const response = await request.put(`/api/v1/features/${feature.id}`, {
      data: { status: "planned" },
    });
    expect(response.status()).toBe(401);
    expect((await response.json()).error).toBe("Unauthorized");
  });

  test("updates status with session auth", async ({ page }) => {
    await loginAsTestUser(page);
    const feature = await seedFeature({ title: "E2E Test Update Status Session" });

    const response = await page.request.put(`/api/v1/features/${feature.id}`, {
      data: { status: "planned" },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("error");
    expect(body.error).toBeNull();
    expect(body.data.id).toBe(feature.id);
    expect(body.data.status).toBe("planned");
  });

  test("updates to various valid statuses", async ({ page }) => {
    await loginAsTestUser(page);
    const feature = await seedFeature({ title: "E2E Test All Statuses Update" });

    // Test a subset of statuses that are valid in the initial schema
    const statuses = ["planned", "in_progress", "done", "open"];
    for (const status of statuses) {
      const response = await page.request.put(`/api/v1/features/${feature.id}`, {
        data: { status },
      });
      expect(response.status()).toBe(200);
      expect((await response.json()).data.status).toBe(status);
    }
  });

  test("validates status field", async ({ page }) => {
    await loginAsTestUser(page);
    const feature = await seedFeature({ title: "E2E Test Invalid Status Update" });

    // Test invalid status
    const response1 = await page.request.put(`/api/v1/features/${feature.id}`, {
      data: { status: "invalid" },
    });
    expect(response1.status()).toBe(400);
    expect((await response1.json()).error).toContain("Invalid status");

    // Test missing status field
    const feature2 = await seedFeature({ title: "E2E Test Missing Status Update" });
    const response2 = await page.request.put(`/api/v1/features/${feature2.id}`, {
      data: {},
    });
    expect(response2.status()).toBe(400);
    expect((await response2.json()).error).toContain("Status field is required");
  });

  test("returns 404 for non-existent feature", async ({ page }) => {
    await loginAsTestUser(page);

    const response = await page.request.put("/api/v1/features/00000000-0000-0000-0000-000000000000", {
      data: { status: "planned" },
    });
    expect(response.status()).toBe(404);
  });

  test("returns 400 for invalid UUID format", async ({ page }) => {
    await loginAsTestUser(page);

    const response = await page.request.put("/api/v1/features/not-a-uuid", {
      data: { status: "planned" },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("Invalid");
  });
});
