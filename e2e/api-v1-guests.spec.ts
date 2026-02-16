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
 * E2E tests for /api/v1/events/[id]/guests endpoints
 *
 * Tests the Guests v1 API:
 * - GET /api/v1/events/[id]/guests (list guests, paginated, filterable)
 * - POST /api/v1/events/[id]/guests (add guest)
 * - GET /api/v1/events/[id]/guests/[guestId] (get single guest)
 * - PUT /api/v1/events/[id]/guests/[guestId] (update guest)
 * - DELETE /api/v1/events/[id]/guests/[guestId] (delete guest)
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

test.describe("GET /api/v1/events/[id]/guests (List Guests)", () => {
  test.skip(!apiKeysTableExists, "api_keys table not found");

  test("requires authentication", async ({ request }) => {
    const event = await seedEvent(testUserId, { title: "E2E Test Guest List Event" });
    const response = await request.get(`/api/v1/events/${event.id}/guests`);
    expect(response.status()).toBe(401);
    expect((await response.json()).error).toBe("Unauthorized");
  });

  test("works with session auth", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Guest List Session" });
    await seedGuest(event.id, { name: "Test Guest 1", email: "guest1@shindig.test" });
    await seedGuest(event.id, { name: "Test Guest 2", email: "guest2@shindig.test" });

    const response = await page.request.get(`/api/v1/events/${event.id}/guests`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.error).toBeNull();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    expect(body.meta.page).toBe(1);
    expect(body.meta.per_page).toBe(20);
    expect(typeof body.meta.total).toBe("number");
  });

  test("works with API key auth (guests:read scope)", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const event = await seedEvent(testUserId, { title: "E2E Test Guest API Key" });
    await seedGuest(event.id, { name: "API Guest", email: "api-guest@shindig.test" });
    const { key } = await seedApiKey(testUserId, { scopes: ["guests:read"] });

    const response = await request.get(`/api/v1/events/${event.id}/guests`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.error).toBeNull();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("rejects API key without guests:read scope", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const event = await seedEvent(testUserId, { title: "E2E Test Guest Scope" });
    const { key } = await seedApiKey(testUserId, { scopes: ["events:read"] });

    const response = await request.get(`/api/v1/events/${event.id}/guests`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status()).toBe(403);
    expect((await response.json()).error).toContain("scope");
  });

  test("supports pagination", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Guest Paginate" });

    // Seed multiple guests
    for (let i = 0; i < 5; i++) {
      await seedGuest(event.id, { name: `Guest ${i}`, email: `guest${i}@shindig.test` });
    }

    const response = await page.request.get(
      `/api/v1/events/${event.id}/guests?page=1&per_page=2`
    );
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
    const event = await seedEvent(testUserId, { title: "E2E Test Guest Cap" });

    const response = await page.request.get(
      `/api/v1/events/${event.id}/guests?per_page=500`
    );
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.meta.per_page).toBe(100);
  });

  test("filters by rsvp_status", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Guest Filter" });

    await seedGuest(event.id, {
      name: "Going Guest",
      email: "going@shindig.test",
      rsvp_status: "going",
    });
    await seedGuest(event.id, {
      name: "Pending Guest",
      email: "pending@shindig.test",
      rsvp_status: "pending",
    });

    const response = await page.request.get(
      `/api/v1/events/${event.id}/guests?rsvp_status=going`
    );
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    for (const guest of body.data) {
      expect(guest.rsvp_status).toBe("going");
    }
  });

  test("rejects invalid rsvp_status filter", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Guest Invalid Filter" });

    const response = await page.request.get(
      `/api/v1/events/${event.id}/guests?rsvp_status=invalid`
    );
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("rsvp_status");
  });

  test("returns 404 for event owned by another user", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);

    // Try to access guests of non-existent event (simulates other user's event)
    const response = await page.request.get(
      "/api/v1/events/00000000-0000-0000-0000-000000000000/guests"
    );
    expect(response.status()).toBe(404);
  });

  test("returns 400 for invalid event ID format", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);

    const response = await page.request.get("/api/v1/events/not-a-uuid/guests");
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("Invalid");
  });
});

test.describe("POST /api/v1/events/[id]/guests (Add Guest)", () => {
  test.skip(!apiKeysTableExists, "api_keys table not found");

  const validGuestData = {
    name: "New Test Guest",
    email: "newguest@shindig.test",
    phone: "+1 555-123-4567",
  };

  test("requires authentication", async ({ request }) => {
    const event = await seedEvent(testUserId, { title: "E2E Test Add Guest Auth" });
    const response = await request.post(`/api/v1/events/${event.id}/guests`, {
      data: validGuestData,
    });
    expect(response.status()).toBe(401);
  });

  test("creates guest with session auth", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Add Guest Session" });

    const response = await page.request.post(`/api/v1/events/${event.id}/guests`, {
      data: validGuestData,
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.error).toBeNull();
    expect(body.data.name).toBe(validGuestData.name);
    expect(body.data.email).toBe(validGuestData.email);
    expect(body.data.phone).toBe(validGuestData.phone);
    expect(body.data.event_id).toBe(event.id);
    expect(body.data.rsvp_status).toBe("pending");
    expect(body.data.rsvp_token).toBeDefined();
    expect(body.data.id).toBeDefined();
  });

  test("creates guest with API key auth (guests:write scope)", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const event = await seedEvent(testUserId, { title: "E2E Test Add Guest API" });
    const { key } = await seedApiKey(testUserId, { scopes: ["guests:read", "guests:write"] });

    const response = await request.post(`/api/v1/events/${event.id}/guests`, {
      data: { ...validGuestData, name: "API Created Guest" },
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data.name).toBe("API Created Guest");
  });

  test("rejects API key without guests:write scope", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const event = await seedEvent(testUserId, { title: "E2E Test Add Guest Scope" });
    const { key } = await seedApiKey(testUserId, { scopes: ["guests:read"] });

    const response = await request.post(`/api/v1/events/${event.id}/guests`, {
      data: validGuestData,
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status()).toBe(403);
    expect((await response.json()).error).toContain("scope");
  });

  test("validates required fields", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Add Guest Validate" });

    const response = await page.request.post(`/api/v1/events/${event.id}/guests`, {
      data: { email: "missing-name@shindig.test" },
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.errors.name).toBeDefined();
  });

  test("validates email format", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Add Guest Email" });

    const response = await page.request.post(`/api/v1/events/${event.id}/guests`, {
      data: { name: "Invalid Email Guest", email: "not-an-email" },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).errors.email).toContain("email");
  });

  test("validates phone format", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Add Guest Phone" });

    const response = await page.request.post(`/api/v1/events/${event.id}/guests`, {
      data: { name: "Invalid Phone Guest", phone: "123" },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).errors.phone).toContain("phone");
  });

  test("returns 404 for non-existent event", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);

    const response = await page.request.post(
      "/api/v1/events/00000000-0000-0000-0000-000000000000/guests",
      { data: validGuestData }
    );
    expect(response.status()).toBe(404);
  });

  test("creates guest with only name (email/phone optional)", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Add Guest Minimal" });

    const response = await page.request.post(`/api/v1/events/${event.id}/guests`, {
      data: { name: "Minimal Guest" },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data.name).toBe("Minimal Guest");
    expect(body.data.email).toBeNull();
    expect(body.data.phone).toBeNull();
  });
});

test.describe("GET /api/v1/events/[id]/guests/[guestId] (Get Single Guest)", () => {
  test.skip(!apiKeysTableExists, "api_keys table not found");

  test("requires authentication", async ({ request }) => {
    const event = await seedEvent(testUserId, { title: "E2E Test Get Guest Auth" });
    const guest = await seedGuest(event.id, { email: "getguest@shindig.test" });

    const response = await request.get(`/api/v1/events/${event.id}/guests/${guest.id}`);
    expect(response.status()).toBe(401);
  });

  test("returns guest for owner", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Get Guest Owner" });
    const guest = await seedGuest(event.id, {
      name: "Specific Guest",
      email: "specific@shindig.test",
    });

    const response = await page.request.get(`/api/v1/events/${event.id}/guests/${guest.id}`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.error).toBeNull();
    expect(body.data.id).toBe(guest.id);
    expect(body.data.name).toBe("Specific Guest");
    expect(body.data.email).toBe("specific@shindig.test");
  });

  test("works with API key auth", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const event = await seedEvent(testUserId, { title: "E2E Test Get Guest API" });
    const guest = await seedGuest(event.id, { email: "apiget@shindig.test" });
    const { key } = await seedApiKey(testUserId, { scopes: ["guests:read"] });

    const response = await request.get(`/api/v1/events/${event.id}/guests/${guest.id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).data.id).toBe(guest.id);
  });

  test("returns 404 for non-existent guest", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Get Guest 404" });

    const response = await page.request.get(
      `/api/v1/events/${event.id}/guests/00000000-0000-0000-0000-000000000000`
    );
    expect(response.status()).toBe(404);
  });

  test("returns 400 for invalid guest ID format", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Get Guest Invalid" });

    const response = await page.request.get(`/api/v1/events/${event.id}/guests/not-a-uuid`);
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("Invalid");
  });

  test("returns 404 for guest in different event", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event1 = await seedEvent(testUserId, { title: "E2E Test Get Guest Event1" });
    const event2 = await seedEvent(testUserId, { title: "E2E Test Get Guest Event2" });
    const guest = await seedGuest(event1.id, { email: "event1guest@shindig.test" });

    // Try to access guest from event1 using event2's endpoint
    const response = await page.request.get(
      `/api/v1/events/${event2.id}/guests/${guest.id}`
    );
    expect(response.status()).toBe(404);
  });
});

test.describe("PUT /api/v1/events/[id]/guests/[guestId] (Update Guest)", () => {
  test.skip(!apiKeysTableExists, "api_keys table not found");

  const updateData = {
    name: "Updated Guest Name",
    email: "updated@shindig.test",
    phone: "+1 555-999-8888",
  };

  test("requires authentication", async ({ request }) => {
    const event = await seedEvent(testUserId, { title: "E2E Test Update Guest Auth" });
    const guest = await seedGuest(event.id, { email: "updateauth@shindig.test" });

    const response = await request.put(`/api/v1/events/${event.id}/guests/${guest.id}`, {
      data: updateData,
    });
    expect(response.status()).toBe(401);
  });

  test("updates guest for owner", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Update Guest Owner" });
    const guest = await seedGuest(event.id, {
      name: "Original Name",
      email: "original@shindig.test",
    });

    const response = await page.request.put(`/api/v1/events/${event.id}/guests/${guest.id}`, {
      data: updateData,
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.error).toBeNull();
    expect(body.data.name).toBe(updateData.name);
    expect(body.data.email).toBe(updateData.email);
    expect(body.data.phone).toBe(updateData.phone);
  });

  test("works with API key auth (guests:write scope)", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const event = await seedEvent(testUserId, { title: "E2E Test Update Guest API" });
    const guest = await seedGuest(event.id, { email: "apiupdate@shindig.test" });
    const { key } = await seedApiKey(testUserId, { scopes: ["guests:read", "guests:write"] });

    const response = await request.put(`/api/v1/events/${event.id}/guests/${guest.id}`, {
      data: updateData,
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status()).toBe(200);
  });

  test("rejects API key without guests:write scope", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const event = await seedEvent(testUserId, { title: "E2E Test Update Guest Scope" });
    const guest = await seedGuest(event.id, { email: "scopeupdate@shindig.test" });
    const { key } = await seedApiKey(testUserId, { scopes: ["guests:read"] });

    const response = await request.put(`/api/v1/events/${event.id}/guests/${guest.id}`, {
      data: updateData,
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status()).toBe(403);
  });

  test("validates input", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Update Guest Validate" });
    const guest = await seedGuest(event.id, { email: "validateupdate@shindig.test" });

    const response = await page.request.put(`/api/v1/events/${event.id}/guests/${guest.id}`, {
      data: { email: "valid@shindig.test" }, // Missing name
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).errors.name).toBeDefined();
  });

  test("returns 404 for non-existent guest", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Update Guest 404" });

    const response = await page.request.put(
      `/api/v1/events/${event.id}/guests/00000000-0000-0000-0000-000000000000`,
      { data: updateData }
    );
    expect(response.status()).toBe(404);
  });
});

test.describe("DELETE /api/v1/events/[id]/guests/[guestId] (Delete Guest)", () => {
  test.skip(!apiKeysTableExists, "api_keys table not found");

  test("requires authentication", async ({ request }) => {
    const event = await seedEvent(testUserId, { title: "E2E Test Delete Guest Auth" });
    const guest = await seedGuest(event.id, { email: "deleteauth@shindig.test" });

    const response = await request.delete(`/api/v1/events/${event.id}/guests/${guest.id}`);
    expect(response.status()).toBe(401);
  });

  test("deletes guest for owner", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Delete Guest Owner" });
    const guest = await seedGuest(event.id, { email: "deleteowner@shindig.test" });

    const response = await page.request.delete(
      `/api/v1/events/${event.id}/guests/${guest.id}`
    );
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.error).toBeNull();
    expect(body.data.deleted).toBe(true);
    expect(body.data.id).toBe(guest.id);

    // Verify guest is deleted
    const { data } = await adminClient()
      .from("guests")
      .select("*")
      .eq("id", guest.id)
      .single();
    expect(data).toBeNull();
  });

  test("works with API key auth (guests:write scope)", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const event = await seedEvent(testUserId, { title: "E2E Test Delete Guest API" });
    const guest = await seedGuest(event.id, { email: "deleteapi@shindig.test" });
    const { key } = await seedApiKey(testUserId, { scopes: ["guests:write"] });

    const response = await request.delete(`/api/v1/events/${event.id}/guests/${guest.id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status()).toBe(200);
  });

  test("rejects API key without guests:write scope", async ({ request }) => {
    if (!apiKeysTableExists) return;
    const event = await seedEvent(testUserId, { title: "E2E Test Delete Guest Scope" });
    const guest = await seedGuest(event.id, { email: "deletescope@shindig.test" });
    const { key } = await seedApiKey(testUserId, { scopes: ["guests:read"] });

    const response = await request.delete(`/api/v1/events/${event.id}/guests/${guest.id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status()).toBe(403);
  });

  test("returns 404 for non-existent guest", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Delete Guest 404" });

    const response = await page.request.delete(
      `/api/v1/events/${event.id}/guests/00000000-0000-0000-0000-000000000000`
    );
    expect(response.status()).toBe(404);
  });

  test("returns 400 for invalid guest ID format", async ({ page }) => {
    if (!apiKeysTableExists) return;
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Delete Guest Invalid" });

    const response = await page.request.delete(
      `/api/v1/events/${event.id}/guests/not-a-uuid`
    );
    expect(response.status()).toBe(400);
  });
});
