import { test, expect } from "@playwright/test";
import { ensureTestUser, loginAsTestUser, seedApiKey, seedEvent, cleanupTestData, adminClient } from "./helpers";

/**
 * E2E tests for /api/v1/events endpoints
 *
 * Tests the Events v1 API:
 * - GET /api/v1/events (list user's events, paginated)
 * - POST /api/v1/events (create event)
 * - GET /api/v1/events/[id] (get single event)
 * - PUT /api/v1/events/[id] (update event)
 * - DELETE /api/v1/events/[id] (delete event)
 * - GET /api/v1/events/public/[slug] (get public event, rate limited)
 */

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

test.describe("GET /api/v1/events (List Events)", () => {
  test.skip(!apiKeysTableExists, "api_keys table not found");

  test("requires authentication", async ({ request }) => {
    const response = await request.get("/api/v1/events");
    expect(response.status()).toBe(401);
    expect((await response.json()).error).toBe("Unauthorized");
  });

  test("works with session auth", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    await seedEvent(testUserId, { title: "E2E Test Session Event" });

    const response = await page.request.get("/api/v1/events");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.error).toBeNull();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.page).toBe(1);
    expect(body.meta.per_page).toBe(20);
    expect(typeof body.meta.total).toBe("number");
  });

  test("works with API key auth (events:read scope)", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const { key } = await seedApiKey(testUserId, { scopes: ["events:read", "events:write"] });

    const response = await request.get("/api/v1/events", {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.error).toBeNull();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("rejects API key without events:read scope", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const { key } = await seedApiKey(testUserId, { scopes: ["guests:read"] });

    const response = await request.get("/api/v1/events", {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status()).toBe(403);
    expect((await response.json()).error).toContain("scope");
  });

  test("supports pagination", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);

    // Seed multiple events
    for (let i = 0; i < 5; i++) {
      await seedEvent(testUserId, { title: `E2E Test Paginate Event ${i}` });
    }

    const response = await page.request.get("/api/v1/events?page=1&per_page=2");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data.length).toBeLessThanOrEqual(2);
    expect(body.meta.page).toBe(1);
    expect(body.meta.per_page).toBe(2);
    expect(body.meta.total).toBeGreaterThanOrEqual(5);
    expect(body.meta.total_pages).toBeGreaterThanOrEqual(3);
  });

  test("caps per_page at 100", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);

    const response = await page.request.get("/api/v1/events?per_page=500");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.meta.per_page).toBe(100);
  });

  test("only returns authenticated user's events", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    await seedEvent(testUserId, { title: "E2E Test My Event" });

    const response = await page.request.get("/api/v1/events");
    const body = await response.json();

    // All returned events should belong to test user (verified by host_id)
    for (const event of body.data) {
      expect(event.host_id).toBe(testUserId);
    }
  });
});

test.describe("POST /api/v1/events (Create Event)", () => {
  test.skip(!apiKeysTableExists, "api_keys table not found");

  const validEventData = {
    title: "E2E Test API Event",
    description: "A test event created via API",
    location: "123 Test Street",
    start_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    timezone: "America/New_York",
  };

  test("requires authentication", async ({ request }) => {
    const response = await request.post("/api/v1/events", {
      data: validEventData,
    });
    expect(response.status()).toBe(401);
  });

  test("creates event with session auth", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);

    const response = await page.request.post("/api/v1/events", {
      data: validEventData,
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.error).toBeNull();
    expect(body.data.title).toBe(validEventData.title);
    expect(body.data.description).toBe(validEventData.description);
    expect(body.data.host_id).toBe(testUserId);
    expect(body.data.slug).toBeDefined();
    expect(body.data.id).toBeDefined();
  });

  test("creates event with API key auth (events:write scope)", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const { key } = await seedApiKey(testUserId, { scopes: ["events:read", "events:write"] });

    const response = await request.post("/api/v1/events", {
      data: { ...validEventData, title: "E2E Test API Key Event" },
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data.title).toBe("E2E Test API Key Event");
  });

  test("rejects API key without events:write scope", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const { key } = await seedApiKey(testUserId, { scopes: ["events:read"] });

    const response = await request.post("/api/v1/events", {
      data: validEventData,
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status()).toBe(403);
    expect((await response.json()).error).toContain("scope");
  });

  test("validates required fields", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);

    const response = await page.request.post("/api/v1/events", {
      data: { description: "Missing title" },
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.errors.title).toBeDefined();
    expect(body.errors.start_time).toBeDefined();
    expect(body.errors.timezone).toBeDefined();
  });

  test("validates title length", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);

    const response = await page.request.post("/api/v1/events", {
      data: {
        ...validEventData,
        title: "A".repeat(201),
      },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).errors.title).toContain("200");
  });

  test("validates URL format for maps_url", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);

    const response = await page.request.post("/api/v1/events", {
      data: {
        ...validEventData,
        maps_url: "not-a-url",
      },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).errors.maps_url).toContain("URL");
  });

  test("sets default values for optional fields", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);

    const response = await page.request.post("/api/v1/events", {
      data: {
        title: "E2E Test Defaults Event",
        start_time: validEventData.start_time,
        timezone: validEventData.timezone,
      },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data.is_public).toBe(true);
    expect(body.data.allow_plus_ones).toBe(true);
  });
});

test.describe("GET /api/v1/events/[id] (Get Single Event)", () => {
  test.skip(!apiKeysTableExists, "api_keys table not found");

  test("requires authentication", async ({ request }) => {
    const event = await seedEvent(testUserId, { title: "E2E Test Get Event" });
    const response = await request.get(`/api/v1/events/${event.id}`);
    expect(response.status()).toBe(401);
  });

  test("returns event for owner", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test My Get Event" });

    const response = await page.request.get(`/api/v1/events/${event.id}`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.error).toBeNull();
    expect(body.data.id).toBe(event.id);
    expect(body.data.title).toBe("E2E Test My Get Event");
  });

  test("works with API key auth", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const event = await seedEvent(testUserId, { title: "E2E Test API Get Event" });
    const { key } = await seedApiKey(testUserId, { scopes: ["events:read"] });

    const response = await request.get(`/api/v1/events/${event.id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).data.id).toBe(event.id);
  });

  test("returns 404 for non-existent event", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);

    const response = await page.request.get("/api/v1/events/00000000-0000-0000-0000-000000000000");
    expect(response.status()).toBe(404);
  });

  test("returns 400 for invalid UUID format", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);

    const response = await page.request.get("/api/v1/events/not-a-uuid");
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("Invalid");
  });

  test("returns 404 for event owned by another user", async ({ page }) => {
    if (!apiKeysTableExists) return;
    // Create event as different user
    const supabase = adminClient();
    const { data: otherEvent, error } = await supabase
      .from("events")
      .insert({
        host_id: "00000000-0000-0000-0000-000000000001",
        title: "E2E Test Other User Event",
        start_time: new Date().toISOString(),
        timezone: "UTC",
        slug: `other-user-event-${Date.now()}`,
      })
      .select()
      .single();

    if (error) {
      console.log("Skipping cross-user test (FK constraint)");
      return;
    }

    await loginAsTestUser(page);
    const response = await page.request.get(`/api/v1/events/${otherEvent.id}`);
    expect(response.status()).toBe(404);

    await supabase.from("events").delete().eq("id", otherEvent.id);
  });
});

test.describe("PUT /api/v1/events/[id] (Update Event)", () => {
  test.skip(!apiKeysTableExists, "api_keys table not found");

  const updateData = {
    title: "E2E Test Updated Event",
    description: "Updated description",
    location: "456 New Street",
    start_time: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    timezone: "America/Los_Angeles",
  };

  test("requires authentication", async ({ request }) => {
    const event = await seedEvent(testUserId);
    const response = await request.put(`/api/v1/events/${event.id}`, {
      data: updateData,
    });
    expect(response.status()).toBe(401);
  });

  test("updates event for owner", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Original Title" });

    const response = await page.request.put(`/api/v1/events/${event.id}`, {
      data: updateData,
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.error).toBeNull();
    expect(body.data.title).toBe(updateData.title);
    expect(body.data.description).toBe(updateData.description);
    expect(body.data.location).toBe(updateData.location);
  });

  test("works with API key auth (events:write scope)", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const event = await seedEvent(testUserId);
    const { key } = await seedApiKey(testUserId, { scopes: ["events:read", "events:write"] });

    const response = await request.put(`/api/v1/events/${event.id}`, {
      data: updateData,
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status()).toBe(200);
  });

  test("rejects API key without events:write scope", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const event = await seedEvent(testUserId);
    const { key } = await seedApiKey(testUserId, { scopes: ["events:read"] });

    const response = await request.put(`/api/v1/events/${event.id}`, {
      data: updateData,
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status()).toBe(403);
  });

  test("validates input", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId);

    const response = await page.request.put(`/api/v1/events/${event.id}`, {
      data: { description: "Missing title" },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).errors.title).toBeDefined();
  });

  test("returns 404 for non-existent event", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);

    const response = await page.request.put("/api/v1/events/00000000-0000-0000-0000-000000000000", {
      data: updateData,
    });
    expect(response.status()).toBe(404);
  });

  test("returns 404 for event owned by another user", async ({ page }) => {
    if (!apiKeysTableExists) return;
    const supabase = adminClient();
    const { data: otherEvent, error } = await supabase
      .from("events")
      .insert({
        host_id: "00000000-0000-0000-0000-000000000001",
        title: "E2E Test Other User Update",
        start_time: new Date().toISOString(),
        timezone: "UTC",
        slug: `other-user-update-${Date.now()}`,
      })
      .select()
      .single();

    if (error) {
      console.log("Skipping cross-user test (FK constraint)");
      return;
    }

    await loginAsTestUser(page);
    const response = await page.request.put(`/api/v1/events/${otherEvent.id}`, {
      data: updateData,
    });
    expect(response.status()).toBe(404);

    await supabase.from("events").delete().eq("id", otherEvent.id);
  });
});

test.describe("DELETE /api/v1/events/[id] (Delete Event)", () => {
  test.skip(!apiKeysTableExists, "api_keys table not found");

  test("requires authentication", async ({ request }) => {
    const event = await seedEvent(testUserId);
    const response = await request.delete(`/api/v1/events/${event.id}`);
    expect(response.status()).toBe(401);
  });

  test("deletes event for owner", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Delete Event" });

    const response = await page.request.delete(`/api/v1/events/${event.id}`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.error).toBeNull();
    expect(body.data.deleted).toBe(true);
    expect(body.data.id).toBe(event.id);

    // Verify event is deleted
    const { data } = await adminClient()
      .from("events")
      .select("*")
      .eq("id", event.id)
      .single();
    expect(data).toBeNull();
  });

  test("works with API key auth (events:write scope)", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const event = await seedEvent(testUserId, { title: "E2E Test API Delete" });
    const { key } = await seedApiKey(testUserId, { scopes: ["events:write"] });

    const response = await request.delete(`/api/v1/events/${event.id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status()).toBe(200);
  });

  test("rejects API key without events:write scope", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const event = await seedEvent(testUserId);
    const { key } = await seedApiKey(testUserId, { scopes: ["events:read"] });

    const response = await request.delete(`/api/v1/events/${event.id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status()).toBe(403);
  });

  test("returns 404 for non-existent event", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);

    const response = await page.request.delete("/api/v1/events/00000000-0000-0000-0000-000000000000");
    expect(response.status()).toBe(404);
  });

  test("returns 400 for invalid UUID format", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);

    const response = await page.request.delete("/api/v1/events/not-a-uuid");
    expect(response.status()).toBe(400);
  });
});

test.describe("GET /api/v1/events/public/[slug] (Public Event)", () => {
  test("returns public event without authentication", async ({ request }) => {
    const event = await seedEvent(testUserId, {
      title: "E2E Test Public Event",
      is_public: true,
    });

    const response = await request.get(`/api/v1/events/public/${event.slug}`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.error).toBeNull();
    expect(body.data.title).toBe("E2E Test Public Event");
    expect(body.data.slug).toBe(event.slug);
  });

  test("returns 404 for non-public event", async ({ request }) => {
    const event = await seedEvent(testUserId, {
      title: "E2E Test Private Event",
      is_public: false,
    });

    const response = await request.get(`/api/v1/events/public/${event.slug}`);
    expect(response.status()).toBe(404);
  });

  test("returns 404 for non-existent slug", async ({ request }) => {
    const response = await request.get("/api/v1/events/public/non-existent-slug-12345");
    expect(response.status()).toBe(404);
  });

  test("returns 400 for invalid slug", async ({ request }) => {
    // Test with very long slug
    const longSlug = "a".repeat(201);
    const response = await request.get(`/api/v1/events/public/${longSlug}`);
    expect(response.status()).toBe(400);
  });

  test("uses envelope response format", async ({ request }) => {
    const event = await seedEvent(testUserId, {
      title: "E2E Test Envelope Event",
      is_public: true,
    });

    const response = await request.get(`/api/v1/events/public/${event.slug}`);
    const body = await response.json();

    // Verify envelope structure
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("error");
    expect(body.error).toBeNull();
    expect(body.data).toHaveProperty("id");
    expect(body.data).toHaveProperty("title");
  });
});
