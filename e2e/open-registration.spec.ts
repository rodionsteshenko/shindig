import { test, expect } from "@playwright/test";
import {
  ensureTestUser,
  seedEvent,
  cleanupTestData,
  adminClient,
} from "./helpers";
import type { Event } from "../src/lib/types";

let userId: string;

test.beforeAll(async () => {
  await cleanupTestData();
  userId = await ensureTestUser();
});

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe("Open Registration API — session endpoint", () => {
  let openEvent: Event;
  let closedEvent: Event;

  test.beforeAll(async () => {
    openEvent = (await seedEvent(userId, {
      title: "E2E Test Open Reg Event",
      allow_open_rsvp: true,
    })) as Event;

    closedEvent = (await seedEvent(userId, {
      title: "E2E Test Closed Reg Event",
      allow_open_rsvp: false,
    })) as Event;
  });

  test("returns 404 for non-existent slug", async ({ request }) => {
    const res = await request.post("/api/events/nonexistent-slug-xyz/register", {
      data: { name: "Test User" },
    });
    expect(res.status()).toBe(404);
  });

  test("returns 403 when allow_open_rsvp is false", async ({ request }) => {
    const res = await request.post(`/api/events/${closedEvent.slug}/register`, {
      data: { name: "Test User" },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("not enabled");
  });

  test("returns 400 when name is missing", async ({ request }) => {
    const res = await request.post(`/api/events/${openEvent.slug}/register`, {
      data: { email: "test@shindig.test" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Name");
  });

  test("creates guest with rsvp_status going and returns rsvp_token", async ({ request }) => {
    const res = await request.post(`/api/events/${openEvent.slug}/register`, {
      data: {
        name: "Open Reg Guest",
        email: "openreg@shindig.test",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.rsvp_token).toBeTruthy();
    expect(body.rsvp_url).toContain("/rsvp/");
    expect(body.name).toBe("Open Reg Guest");

    // Verify in DB
    const supabase = adminClient();
    const { data: guest } = await supabase
      .from("guests")
      .select("*")
      .eq("rsvp_token", body.rsvp_token)
      .single();

    expect(guest).toBeTruthy();
    expect(guest.rsvp_status).toBe("going");
    expect(guest.email).toBe("openreg@shindig.test");
    expect(guest.event_id).toBe(openEvent.id);
  });

  test("returned rsvp_token works for RSVP lookup", async ({ request }) => {
    const regRes = await request.post(`/api/events/${openEvent.slug}/register`, {
      data: { name: "Token Test Guest" },
    });
    const { rsvp_token } = await regRes.json();

    const rsvpRes = await request.get(`/api/rsvp/${rsvp_token}`);
    expect(rsvpRes.ok()).toBe(true);
    const rsvpData = await rsvpRes.json();
    expect(rsvpData.name).toBe("Token Test Guest");
  });
});

test.describe("Open Registration API — v1 endpoint", () => {
  let openEvent: Event;

  test.beforeAll(async () => {
    openEvent = (await seedEvent(userId, {
      title: "E2E Test V1 Open Reg Event",
      allow_open_rsvp: true,
    })) as Event;
  });

  test("returns envelope format with rsvp_token", async ({ request }) => {
    const res = await request.post(
      `/api/v1/events/public/${openEvent.slug}/register`,
      { data: { name: "V1 Reg Guest", email: "v1reg@shindig.test" } }
    );
    expect(res.ok()).toBe(true);
    const body = await res.json();

    // v1 envelope format
    expect(body.data).toBeTruthy();
    expect(body.data.rsvp_token).toBeTruthy();
    expect(body.data.rsvp_url).toContain("/rsvp/");
    expect(body.error).toBeNull();
  });

  test("returns error envelope for missing name", async ({ request }) => {
    const res = await request.post(
      `/api/v1/events/public/${openEvent.slug}/register`,
      { data: {} }
    );
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.data).toBeNull();
    expect(body.error).toContain("Name");
  });
});

test.describe("Public Event Page — Open Registration UI", () => {
  test("registration form NOT shown when allow_open_rsvp is false", async ({ page }) => {
    const event = await seedEvent(userId, {
      title: "E2E Test Closed UI Event",
      allow_open_rsvp: false,
    });

    await page.goto(`/e/${event.slug}`);
    await expect(page.getByRole("heading", { name: "E2E Test Closed UI Event" })).toBeVisible();
    await expect(page.getByText("Register for this Event")).not.toBeVisible();
  });

  test("registration form shown when allow_open_rsvp is true", async ({ page }) => {
    const event = await seedEvent(userId, {
      title: "E2E Test Open UI Event",
      allow_open_rsvp: true,
    });

    await page.goto(`/e/${event.slug}`);
    await expect(page.getByText("Register for this Event")).toBeVisible();
    await expect(page.getByLabel("Your Name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Count Me In!" })).toBeVisible();
  });

  test("can register via the UI form and see confirmation", async ({ page }) => {
    const event = await seedEvent(userId, {
      title: "E2E Test UI Registration Event",
      allow_open_rsvp: true,
    });

    await page.goto(`/e/${event.slug}`);

    // Fill in just the name
    await page.getByLabel("Your Name").fill("UI Test Guest");
    await page.getByRole("button", { name: "Count Me In!" }).click();

    // Should see confirmation
    await expect(page.getByText("You're registered!")).toBeVisible();
    await expect(page.getByRole("link", { name: "View My RSVP" })).toBeVisible();
  });

  test("RSVP link from registration navigates to RSVP page", async ({ page }) => {
    const event = await seedEvent(userId, {
      title: "E2E Test RSVP Link Event",
      allow_open_rsvp: true,
    });

    await page.goto(`/e/${event.slug}`);
    await page.getByLabel("Your Name").fill("Link Test Guest");
    await page.getByRole("button", { name: "Count Me In!" }).click();

    await expect(page.getByText("You're registered!")).toBeVisible();

    // Click the RSVP link
    await page.getByRole("link", { name: "View My RSVP" }).click();

    // Should be on the RSVP page with guest name and event title
    await expect(page.getByText("Link Test Guest")).toBeVisible();
    await expect(page.getByText("E2E Test RSVP Link Event")).toBeVisible();
  });
});
