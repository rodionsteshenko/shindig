import { test, expect } from "@playwright/test";
import {
  ensureTestUser,
  loginAsTestUser,
  seedApiKey,
  seedEvent,
  seedGuest,
  cleanupTestData,
  adminClient,
} from "./helpers";

/**
 * Consolidated E2E tests for v1 API endpoints
 *
 * This file tests:
 * - Events v1 API (list, create, get, update, delete) with session auth
 * - Public event endpoint
 * - Guests v1 API
 * - Features v1 API
 * - API key creation and authentication
 * - Scope enforcement (403 without required scope)
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

  const { data, error } = await supabase
    .from("feature_requests")
    .insert(insertData)
    .select()
    .single();

  if (error) throw new Error(`Failed to seed feature: ${error.message}`);
  return data;
}

// ============================================================================
// EVENTS v1 API - Session Auth
// ============================================================================

test.describe("Events v1 API - Session Auth", () => {
  test.describe("GET /api/v1/events (List Events)", () => {
    test("requires authentication", async ({ request }) => {
      const response = await request.get("/api/v1/events");
      expect(response.status()).toBe(401);
      expect((await response.json()).error).toBe("Unauthorized");
    });

    test("works with session auth and returns paginated results", async ({ page }) => {
      if (!apiKeysTableExists) return;
      await loginAsTestUser(page);
      await seedEvent(testUserId, { title: "E2E Test Session Event v1" });

      const response = await page.request.get("/api/v1/events");
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.error).toBeNull();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta.page).toBe(1);
      expect(body.meta.per_page).toBe(20);
      expect(typeof body.meta.total).toBe("number");
    });

    test("supports pagination parameters", async ({ page }) => {
      if (!apiKeysTableExists) return;
      await loginAsTestUser(page);

      for (let i = 0; i < 5; i++) {
        await seedEvent(testUserId, { title: `E2E Test Paginate Event v1 ${i}` });
      }

      const response = await page.request.get("/api/v1/events?page=1&per_page=2");
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data.length).toBeLessThanOrEqual(2);
      expect(body.meta.page).toBe(1);
      expect(body.meta.per_page).toBe(2);
    });

    test("caps per_page at 100", async ({ page }) => {
      if (!apiKeysTableExists) return;
      await loginAsTestUser(page);

      const response = await page.request.get("/api/v1/events?per_page=500");
      expect(response.status()).toBe(200);
      expect((await response.json()).meta.per_page).toBe(100);
    });

    test("only returns authenticated user's events", async ({ page }) => {
      if (!apiKeysTableExists) return;
      await loginAsTestUser(page);
      await seedEvent(testUserId, { title: "E2E Test My Event v1" });

      const response = await page.request.get("/api/v1/events");
      const body = await response.json();

      for (const event of body.data) {
        expect(event.host_id).toBe(testUserId);
      }
    });
  });

  test.describe("POST /api/v1/events (Create Event)", () => {
    const validEventData = {
      title: "E2E Test API Event v1",
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
      expect(body.data.host_id).toBe(testUserId);
      expect(body.data.slug).toBeDefined();
      expect(body.data.id).toBeDefined();
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
  });

  test.describe("GET /api/v1/events/[id] (Get Single Event)", () => {
    test("requires authentication", async ({ request }) => {
      const event = await seedEvent(testUserId, { title: "E2E Test Get Event v1" });
      const response = await request.get(`/api/v1/events/${event.id}`);
      expect(response.status()).toBe(401);
    });

    test("returns event for owner with session auth", async ({ page }) => {
      if (!apiKeysTableExists) return;
      await loginAsTestUser(page);
      const event = await seedEvent(testUserId, { title: "E2E Test My Get Event v1" });

      const response = await page.request.get(`/api/v1/events/${event.id}`);
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.error).toBeNull();
      expect(body.data.id).toBe(event.id);
      expect(body.data.title).toBe("E2E Test My Get Event v1");
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
  });

  test.describe("PUT /api/v1/events/[id] (Update Event)", () => {
    const updateData = {
      title: "E2E Test Updated Event v1",
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

    test("updates event for owner with session auth", async ({ page }) => {
      if (!apiKeysTableExists) return;
      await loginAsTestUser(page);
      const event = await seedEvent(testUserId, { title: "E2E Test Original v1" });

      const response = await page.request.put(`/api/v1/events/${event.id}`, {
        data: updateData,
      });
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.error).toBeNull();
      expect(body.data.title).toBe(updateData.title);
      expect(body.data.description).toBe(updateData.description);
    });

    test("returns 404 for non-existent event", async ({ page }) => {
      if (!apiKeysTableExists) return;
      await loginAsTestUser(page);

      const response = await page.request.put("/api/v1/events/00000000-0000-0000-0000-000000000000", {
        data: updateData,
      });
      expect(response.status()).toBe(404);
    });
  });

  test.describe("DELETE /api/v1/events/[id] (Delete Event)", () => {
    test("requires authentication", async ({ request }) => {
      const event = await seedEvent(testUserId);
      const response = await request.delete(`/api/v1/events/${event.id}`);
      expect(response.status()).toBe(401);
    });

    test("deletes event for owner with session auth", async ({ page }) => {
      if (!apiKeysTableExists) return;
      await loginAsTestUser(page);
      const event = await seedEvent(testUserId, { title: "E2E Test Delete Event v1" });

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

    test("returns 404 for non-existent event", async ({ page }) => {
      if (!apiKeysTableExists) return;
      await loginAsTestUser(page);

      const response = await page.request.delete("/api/v1/events/00000000-0000-0000-0000-000000000000");
      expect(response.status()).toBe(404);
    });
  });
});

// ============================================================================
// PUBLIC EVENT ENDPOINT
// ============================================================================

test.describe("Public Event Endpoint", () => {
  test.describe("GET /api/v1/events/public/[slug]", () => {
    test("returns public event without authentication", async ({ request }) => {
      const event = await seedEvent(testUserId, {
        title: "E2E Test Public Event v1",
        is_public: true,
      });

      const response = await request.get(`/api/v1/events/public/${event.slug}`);
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.error).toBeNull();
      expect(body.data.title).toBe("E2E Test Public Event v1");
      expect(body.data.slug).toBe(event.slug);
    });

    test("returns 404 for non-public event", async ({ request }) => {
      const event = await seedEvent(testUserId, {
        title: "E2E Test Private Event v1",
        is_public: false,
      });

      const response = await request.get(`/api/v1/events/public/${event.slug}`);
      expect(response.status()).toBe(404);
    });

    test("returns 404 for non-existent slug", async ({ request }) => {
      const response = await request.get("/api/v1/events/public/non-existent-slug-12345-v1");
      expect(response.status()).toBe(404);
    });

    test("returns 400 for invalid slug", async ({ request }) => {
      const longSlug = "a".repeat(201);
      const response = await request.get(`/api/v1/events/public/${longSlug}`);
      expect(response.status()).toBe(400);
    });

    test("uses envelope response format", async ({ request }) => {
      const event = await seedEvent(testUserId, {
        title: "E2E Test Envelope Event v1",
        is_public: true,
      });

      const response = await request.get(`/api/v1/events/public/${event.slug}`);
      const body = await response.json();

      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("error");
      expect(body.error).toBeNull();
      expect(body.data).toHaveProperty("id");
      expect(body.data).toHaveProperty("title");
    });
  });
});

// ============================================================================
// GUESTS v1 API
// ============================================================================

test.describe("Guests v1 API", () => {
  test.describe("GET /api/v1/events/[id]/guests (List Guests)", () => {
    test("requires authentication", async ({ request }) => {
      const event = await seedEvent(testUserId, { title: "E2E Test Guest List v1" });
      const response = await request.get(`/api/v1/events/${event.id}/guests`);
      expect(response.status()).toBe(401);
    });

    test("works with session auth", async ({ page }) => {
      if (!apiKeysTableExists) return;
      await loginAsTestUser(page);
      const event = await seedEvent(testUserId, { title: "E2E Test Guest List Session v1" });
      await seedGuest(event.id, { name: "Test Guest 1 v1", email: "guest1v1@shindig.test" });

      const response = await page.request.get(`/api/v1/events/${event.id}/guests`);
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.error).toBeNull();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta.page).toBe(1);
      expect(body.meta.per_page).toBe(20);
    });

    test("filters by rsvp_status", async ({ page }) => {
      if (!apiKeysTableExists) return;
      await loginAsTestUser(page);
      const event = await seedEvent(testUserId, { title: "E2E Test Guest Filter v1" });

      await seedGuest(event.id, {
        name: "Going Guest v1",
        email: "goingv1@shindig.test",
        rsvp_status: "going",
      });
      await seedGuest(event.id, {
        name: "Pending Guest v1",
        email: "pendingv1@shindig.test",
        rsvp_status: "pending",
      });

      const response = await page.request.get(
        `/api/v1/events/${event.id}/guests?rsvp_status=going`
      );
      expect(response.status()).toBe(200);

      const body = await response.json();
      for (const guest of body.data) {
        expect(guest.rsvp_status).toBe("going");
      }
    });
  });

  test.describe("POST /api/v1/events/[id]/guests (Add Guest)", () => {
    const validGuestData = {
      name: "New Test Guest v1",
      email: "newguestv1@shindig.test",
    };

    test("requires authentication", async ({ request }) => {
      const event = await seedEvent(testUserId, { title: "E2E Test Add Guest Auth v1" });
      const response = await request.post(`/api/v1/events/${event.id}/guests`, {
        data: validGuestData,
      });
      expect(response.status()).toBe(401);
    });

    test("creates guest with session auth", async ({ page }) => {
      if (!apiKeysTableExists) return;
      await loginAsTestUser(page);
      const event = await seedEvent(testUserId, { title: "E2E Test Add Guest Session v1" });

      const response = await page.request.post(`/api/v1/events/${event.id}/guests`, {
        data: validGuestData,
      });
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.error).toBeNull();
      expect(body.data.name).toBe(validGuestData.name);
      expect(body.data.email).toBe(validGuestData.email);
      expect(body.data.event_id).toBe(event.id);
      expect(body.data.rsvp_status).toBe("pending");
      expect(body.data.rsvp_token).toBeDefined();
    });
  });

  test.describe("GET /api/v1/events/[id]/guests/[guestId] (Get Single Guest)", () => {
    test("returns guest for owner with session auth", async ({ page }) => {
      if (!apiKeysTableExists) return;
      await loginAsTestUser(page);
      const event = await seedEvent(testUserId, { title: "E2E Test Get Guest Owner v1" });
      const guest = await seedGuest(event.id, {
        name: "Specific Guest v1",
        email: "specificv1@shindig.test",
      });

      const response = await page.request.get(`/api/v1/events/${event.id}/guests/${guest.id}`);
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.error).toBeNull();
      expect(body.data.id).toBe(guest.id);
      expect(body.data.name).toBe("Specific Guest v1");
    });

    test("returns 404 for non-existent guest", async ({ page }) => {
      if (!apiKeysTableExists) return;
      await loginAsTestUser(page);
      const event = await seedEvent(testUserId, { title: "E2E Test Get Guest 404 v1" });

      const response = await page.request.get(
        `/api/v1/events/${event.id}/guests/00000000-0000-0000-0000-000000000000`
      );
      expect(response.status()).toBe(404);
    });
  });

  test.describe("PUT /api/v1/events/[id]/guests/[guestId] (Update Guest)", () => {
    const updateData = {
      name: "Updated Guest Name v1",
      email: "updatedv1@shindig.test",
    };

    test("updates guest for owner with session auth", async ({ page }) => {
      if (!apiKeysTableExists) return;
      await loginAsTestUser(page);
      const event = await seedEvent(testUserId, { title: "E2E Test Update Guest Owner v1" });
      const guest = await seedGuest(event.id, {
        name: "Original Name v1",
        email: "originalv1@shindig.test",
      });

      const response = await page.request.put(`/api/v1/events/${event.id}/guests/${guest.id}`, {
        data: updateData,
      });
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.error).toBeNull();
      expect(body.data.name).toBe(updateData.name);
      expect(body.data.email).toBe(updateData.email);
    });
  });

  test.describe("DELETE /api/v1/events/[id]/guests/[guestId] (Delete Guest)", () => {
    test("deletes guest for owner with session auth", async ({ page }) => {
      if (!apiKeysTableExists) return;
      await loginAsTestUser(page);
      const event = await seedEvent(testUserId, { title: "E2E Test Delete Guest Owner v1" });
      const guest = await seedGuest(event.id, { email: "deleteownerv1@shindig.test" });

      const response = await page.request.delete(
        `/api/v1/events/${event.id}/guests/${guest.id}`
      );
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.error).toBeNull();
      expect(body.data.deleted).toBe(true);
      expect(body.data.id).toBe(guest.id);
    });
  });
});

// ============================================================================
// FEATURES v1 API
// ============================================================================

test.describe("Features v1 API", () => {
  test.describe("GET /api/v1/features (List Features)", () => {
    test("returns features with envelope response format (no auth required)", async ({ request }) => {
      await seedFeature({ title: "E2E Test Public Feature List v1" });

      const response = await request.get("/api/v1/features");
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("error");
      expect(body).toHaveProperty("meta");
      expect(body.error).toBeNull();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta.page).toBe(1);
    });

    test("supports pagination", async ({ request }) => {
      for (let i = 0; i < 3; i++) {
        await seedFeature({ title: `E2E Test Paginate Feature v1 ${i}` });
      }

      const response = await request.get("/api/v1/features?page=1&per_page=2");
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data.length).toBeLessThanOrEqual(2);
      expect(body.meta.page).toBe(1);
      expect(body.meta.per_page).toBe(2);
    });

    test("filters by status", async ({ request }) => {
      await seedFeature({ title: "E2E Test Planned Feature v1", status: "planned" });

      const response = await request.get("/api/v1/features?status=planned");
      expect(response.status()).toBe(200);

      const body = await response.json();
      for (const feature of body.data) {
        expect(feature.status).toBe("planned");
      }
    });
  });

  test.describe("POST /api/v1/features (Submit Feature)", () => {
    test("creates feature without authentication", async ({ request }) => {
      const response = await request.post("/api/v1/features", {
        data: {
          title: "E2E Test Full Feature Post v1",
          description: "Description of the feature",
          author_name: "Test Author",
        },
      });
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.error).toBeNull();
      expect(body.data.title).toBe("E2E Test Full Feature Post v1");
      expect(body.data.status).toBe("open");
    });

    test("validates required fields", async ({ request }) => {
      const response = await request.post("/api/v1/features", {
        data: { description: "Missing title" },
      });
      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("Validation failed");
      expect(body.errors.title).toBeDefined();
    });
  });

  test.describe("GET /api/v1/features/[id] (Get Single Feature)", () => {
    test("returns feature by ID without authentication", async ({ request }) => {
      const feature = await seedFeature({ title: "E2E Test Get Feature Id v1" });

      const response = await request.get(`/api/v1/features/${feature.id}`);
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.error).toBeNull();
      expect(body.data.id).toBe(feature.id);
      expect(body.data.title).toBe("E2E Test Get Feature Id v1");
    });

    test("returns 404 for non-existent feature", async ({ request }) => {
      const response = await request.get("/api/v1/features/00000000-0000-0000-0000-000000000000");
      expect(response.status()).toBe(404);
    });
  });

  test.describe("PUT /api/v1/features/[id] (Update Feature Status)", () => {
    test("requires authentication", async ({ request }) => {
      const feature = await seedFeature({ title: "E2E Test Update Feature Auth v1" });

      const response = await request.put(`/api/v1/features/${feature.id}`, {
        data: { status: "planned" },
      });
      expect(response.status()).toBe(401);
    });

    test("updates status with session auth", async ({ page }) => {
      await loginAsTestUser(page);
      const feature = await seedFeature({ title: "E2E Test Update Status Session v1" });

      const response = await page.request.put(`/api/v1/features/${feature.id}`, {
        data: { status: "planned" },
      });
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.error).toBeNull();
      expect(body.data.status).toBe("planned");
    });
  });
});

// ============================================================================
// API KEY CREATION AND AUTHENTICATION
// ============================================================================

test.describe("API Key Creation and Authentication", () => {
  test.describe("POST /api/v1/api-keys (Create API Key)", () => {
    test.skip(!apiKeysTableExists, "api_keys table not found");

    test("requires session authentication", async ({ request }) => {
      const response = await request.post("/api/v1/api-keys", {
        data: { name: "Test Key v1" },
      });
      expect(response.status()).toBe(401);
      expect((await response.json()).error).toBe("Unauthorized");
    });

    test("rejects API key authentication for creating keys", async ({ request }) => {
      if (!apiKeysTableExists) return;
      const { key } = await seedApiKey(testUserId);
      const response = await request.post("/api/v1/api-keys", {
        data: { name: "New Key v1" },
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(response.status()).toBe(401);
    });

    test("creates API key with session auth", async ({ page }) => {
      if (!apiKeysTableExists) return;
      await loginAsTestUser(page);

      const response = await page.request.post("/api/v1/api-keys", {
        data: { name: "My API Key v1" },
      });
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.error).toBeNull();
      expect(body.data.name).toBe("My API Key v1");
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
        data: { name: "Read-Only Key v1", scopes: ["events:read", "guests:read"] },
      });
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data.scopes).toEqual(["events:read", "guests:read"]);
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
        data: { name: "Bad Scope Key v1", scopes: ["invalid:scope", "admin:all"] },
      });
      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("Validation failed");
      expect(body.errors.scopes).toContain("Invalid scopes");
    });
  });

  test.describe("GET /api/v1/api-keys (List API Keys)", () => {
    test.skip(!apiKeysTableExists, "api_keys table not found");

    test("requires authentication", async ({ request }) => {
      const response = await request.get("/api/v1/api-keys");
      expect(response.status()).toBe(401);
    });

    test("lists API keys with session auth", async ({ page }) => {
      if (!apiKeysTableExists) return;
      await loginAsTestUser(page);
      await seedApiKey(testUserId, { name: "List Test Key v1" });

      const response = await page.request.get("/api/v1/api-keys");
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.error).toBeNull();
      expect(body.data.length).toBeGreaterThanOrEqual(1);

      const key = body.data[0];
      expect(key.id).toBeDefined();
      expect(key.name).toBeDefined();
      expect(key.key_prefix).toBeDefined();
      expect(key.scopes).toBeDefined();
      // Sensitive fields should not be exposed
      expect(key.key_hash).toBeUndefined();
      expect(key.key).toBeUndefined();
    });
  });

  test.describe("DELETE /api/v1/api-keys/[id] (Delete API Key)", () => {
    test.skip(!apiKeysTableExists, "api_keys table not found");

    test("requires session authentication", async ({ request }) => {
      const { row } = await seedApiKey(testUserId);
      const response = await request.delete(`/api/v1/api-keys/${row.id}`);
      expect(response.status()).toBe(401);
    });

    test("rejects API key authentication for deleting keys", async ({ request }) => {
      if (!apiKeysTableExists) return;
      const { key } = await seedApiKey(testUserId, { name: "Auth Key v1" });
      const { row: targetRow } = await seedApiKey(testUserId, { name: "Target Key v1" });

      const response = await request.delete(`/api/v1/api-keys/${targetRow.id}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(response.status()).toBe(401);
    });

    test("deletes owned API key with session auth", async ({ page }) => {
      if (!apiKeysTableExists) return;
      await loginAsTestUser(page);
      const { row } = await seedApiKey(testUserId, { name: "Key To Delete v1" });

      const response = await page.request.delete(`/api/v1/api-keys/${row.id}`);
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.error).toBeNull();
      expect(body.data.deleted).toBe(true);
      expect(body.data.id).toBe(row.id);
    });
  });

  test.describe("API Key Authentication Flow", () => {
    test.skip(!apiKeysTableExists, "api_keys table not found");

    test("newly created key can be used immediately", async ({ page, request }) => {
      if (!apiKeysTableExists) return;
      await loginAsTestUser(page);

      const createResponse = await page.request.post("/api/v1/api-keys", {
        data: {
          name: "Immediate Use Key v1",
          scopes: ["events:read", "events:write", "guests:read", "guests:write"],
        },
      });
      expect(createResponse.status()).toBe(200);

      const newKey = (await createResponse.json()).data.key;

      // Use the key immediately to list events
      const listResponse = await request.get("/api/v1/events", {
        headers: { Authorization: `Bearer ${newKey}` },
      });
      expect(listResponse.status()).toBe(200);
    });

    test("deleted key cannot be used", async ({ page, request }) => {
      if (!apiKeysTableExists) return;
      await loginAsTestUser(page);

      // Create key
      const createBody = await (
        await page.request.post("/api/v1/api-keys", {
          data: { name: "Key To Revoke v1" },
        })
      ).json();
      const keyId = createBody.data.id;
      const keyValue = createBody.data.key;

      // Verify key works
      expect(
        (
          await request.get("/api/v1/events", {
            headers: { Authorization: `Bearer ${keyValue}` },
          })
        ).status()
      ).toBe(200);

      // Delete key
      expect((await page.request.delete(`/api/v1/api-keys/${keyId}`)).status()).toBe(200);

      // Verify key no longer works
      expect(
        (
          await request.get("/api/v1/events", {
            headers: { Authorization: `Bearer ${keyValue}` },
          })
        ).status()
      ).toBe(401);
    });
  });
});

// ============================================================================
// SCOPE ENFORCEMENT (403 without required scope)
// ============================================================================

test.describe("Scope Enforcement", () => {
  test.skip(!apiKeysTableExists, "api_keys table not found");

  test.describe("Events API Scope Enforcement", () => {
    test("GET /api/v1/events requires events:read scope", async ({ request }) => {
      if (!apiKeysTableExists) return;
      const { key } = await seedApiKey(testUserId, { scopes: ["guests:read"] });

      const response = await request.get("/api/v1/events", {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(response.status()).toBe(403);
      expect((await response.json()).error).toContain("scope");
    });

    test("POST /api/v1/events requires events:write scope", async ({ request }) => {
      if (!apiKeysTableExists) return;
      const { key } = await seedApiKey(testUserId, { scopes: ["events:read"] });

      const response = await request.post("/api/v1/events", {
        data: {
          title: "Test Event v1",
          start_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          timezone: "America/New_York",
        },
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(response.status()).toBe(403);
      expect((await response.json()).error).toContain("scope");
    });

    test("PUT /api/v1/events/[id] requires events:write scope", async ({ request }) => {
      if (!apiKeysTableExists) return;
      const event = await seedEvent(testUserId);
      const { key } = await seedApiKey(testUserId, { scopes: ["events:read"] });

      const response = await request.put(`/api/v1/events/${event.id}`, {
        data: {
          title: "Updated v1",
          start_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          timezone: "America/New_York",
        },
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(response.status()).toBe(403);
    });

    test("DELETE /api/v1/events/[id] requires events:write scope", async ({ request }) => {
      if (!apiKeysTableExists) return;
      const event = await seedEvent(testUserId);
      const { key } = await seedApiKey(testUserId, { scopes: ["events:read"] });

      const response = await request.delete(`/api/v1/events/${event.id}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(response.status()).toBe(403);
    });

    test("events:read scope allows GET /api/v1/events", async ({ request }) => {
      if (!apiKeysTableExists) return;
      const { key } = await seedApiKey(testUserId, { scopes: ["events:read"] });

      const response = await request.get("/api/v1/events", {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(response.status()).toBe(200);
    });

    test("events:write scope allows POST /api/v1/events", async ({ request }) => {
      if (!apiKeysTableExists) return;
      const { key } = await seedApiKey(testUserId, { scopes: ["events:read", "events:write"] });

      const response = await request.post("/api/v1/events", {
        data: {
          title: "E2E Test Scope Write v1",
          start_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          timezone: "America/New_York",
        },
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(response.status()).toBe(200);
    });
  });

  test.describe("Guests API Scope Enforcement", () => {
    test("GET /api/v1/events/[id]/guests requires guests:read scope", async ({ request }) => {
      if (!apiKeysTableExists) return;
      const event = await seedEvent(testUserId);
      const { key } = await seedApiKey(testUserId, { scopes: ["events:read"] });

      const response = await request.get(`/api/v1/events/${event.id}/guests`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(response.status()).toBe(403);
      expect((await response.json()).error).toContain("scope");
    });

    test("POST /api/v1/events/[id]/guests requires guests:write scope", async ({ request }) => {
      if (!apiKeysTableExists) return;
      const event = await seedEvent(testUserId);
      const { key } = await seedApiKey(testUserId, { scopes: ["guests:read"] });

      const response = await request.post(`/api/v1/events/${event.id}/guests`, {
        data: { name: "Test Guest v1" },
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(response.status()).toBe(403);
      expect((await response.json()).error).toContain("scope");
    });

    test("PUT /api/v1/events/[id]/guests/[guestId] requires guests:write scope", async ({
      request,
    }) => {
      if (!apiKeysTableExists) return;
      const event = await seedEvent(testUserId);
      const guest = await seedGuest(event.id, { email: "scopetestv1@shindig.test" });
      const { key } = await seedApiKey(testUserId, { scopes: ["guests:read"] });

      const response = await request.put(`/api/v1/events/${event.id}/guests/${guest.id}`, {
        data: { name: "Updated v1" },
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(response.status()).toBe(403);
    });

    test("DELETE /api/v1/events/[id]/guests/[guestId] requires guests:write scope", async ({
      request,
    }) => {
      if (!apiKeysTableExists) return;
      const event = await seedEvent(testUserId);
      const guest = await seedGuest(event.id, { email: "scopedelv1@shindig.test" });
      const { key } = await seedApiKey(testUserId, { scopes: ["guests:read"] });

      const response = await request.delete(`/api/v1/events/${event.id}/guests/${guest.id}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(response.status()).toBe(403);
    });

    test("guests:read scope allows GET /api/v1/events/[id]/guests", async ({ request }) => {
      if (!apiKeysTableExists) return;
      const event = await seedEvent(testUserId);
      const { key } = await seedApiKey(testUserId, { scopes: ["guests:read"] });

      const response = await request.get(`/api/v1/events/${event.id}/guests`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(response.status()).toBe(200);
    });

    test("guests:write scope allows POST /api/v1/events/[id]/guests", async ({ request }) => {
      if (!apiKeysTableExists) return;
      const event = await seedEvent(testUserId);
      const { key } = await seedApiKey(testUserId, { scopes: ["guests:read", "guests:write"] });

      const response = await request.post(`/api/v1/events/${event.id}/guests`, {
        data: { name: "E2E Test Scope Write Guest v1" },
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(response.status()).toBe(200);
    });
  });

  test.describe("API Keys List Scope Enforcement", () => {
    test("GET /api/v1/api-keys requires events:read scope", async ({ request }) => {
      if (!apiKeysTableExists) return;
      const { key } = await seedApiKey(testUserId, { scopes: ["guests:read"] });

      const response = await request.get("/api/v1/api-keys", {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(response.status()).toBe(403);
      expect((await response.json()).error).toContain("scope");
    });

    test("events:read scope allows GET /api/v1/api-keys", async ({ request }) => {
      if (!apiKeysTableExists) return;
      const { key } = await seedApiKey(testUserId, { scopes: ["events:read"] });

      const response = await request.get("/api/v1/api-keys", {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(response.status()).toBe(200);
    });
  });

  test.describe("Invitations API Scope Enforcement", () => {
    test("POST /api/v1/events/[id]/invite requires events:write scope", async ({ request }) => {
      if (!apiKeysTableExists) return;
      const event = await seedEvent(testUserId);
      const { key } = await seedApiKey(testUserId, { scopes: ["events:read"] });

      const response = await request.post(`/api/v1/events/${event.id}/invite`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(response.status()).toBe(403);
      expect((await response.json()).error).toContain("scope");
    });

    test("POST /api/v1/events/[id]/remind requires events:write scope", async ({ request }) => {
      if (!apiKeysTableExists) return;
      const event = await seedEvent(testUserId);
      const { key } = await seedApiKey(testUserId, { scopes: ["events:read"] });

      const response = await request.post(`/api/v1/events/${event.id}/remind`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(response.status()).toBe(403);
      expect((await response.json()).error).toContain("scope");
    });
  });
});
