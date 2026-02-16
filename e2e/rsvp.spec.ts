import { test, expect } from "@playwright/test";
import { ensureTestUser, seedEvent, seedGuest, cleanupTestData } from "./helpers";
import type { Event, Guest } from "../src/lib/types";

let testEvent: Event;
let testGuest: Guest;

test.beforeAll(async () => {
  const userId = await ensureTestUser();
  testEvent = await seedEvent(userId, {
    title: "RSVP Test Party",
    description: "Test the RSVP flow",
    location: "RSVP Venue",
    cover_image_url: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&h=600&fit=crop",
  }) as Event;
  testGuest = await seedGuest(testEvent.id, {
    name: "RSVP Test Guest",
    email: "rsvp-guest@shindig.test",
  }) as Guest;
});

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe("RSVP Page", () => {
  test("renders event info and RSVP form", async ({ page }) => {
    await page.goto(`/rsvp/${testGuest.rsvp_token}`);

    await expect(page.getByRole("heading", { name: testEvent.title })).toBeVisible();
    await expect(page.getByText("RSVP Venue")).toBeVisible();

    // Should show guest name
    await expect(page.getByText("RSVP Test Guest")).toBeVisible();

    // Should show 3 RSVP options
    await expect(page.getByRole("button", { name: /Going/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Maybe/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Can't/i })).toBeVisible();
  });

  test("shows plus-one selector when Going is selected", async ({ page }) => {
    await page.goto(`/rsvp/${testGuest.rsvp_token}`);

    await page.getByRole("button", { name: /Going/i }).click();

    // Plus-one dropdown and dietary field should appear
    await expect(page.getByText(/Bringing anyone/i)).toBeVisible();
    await expect(page.getByText(/Dietary restrictions/i)).toBeVisible();
  });

  test("shows dietary field when Maybe is selected", async ({ page }) => {
    await page.goto(`/rsvp/${testGuest.rsvp_token}`);

    await page.getByRole("button", { name: /Maybe/i }).click();

    await expect(page.getByText(/Dietary restrictions/i)).toBeVisible();
  });

  test("hides plus-one and dietary when Can't is selected", async ({ page }) => {
    await page.goto(`/rsvp/${testGuest.rsvp_token}`);

    // First select Going to show fields
    await page.getByRole("button", { name: /Going/i }).click();
    await expect(page.getByText(/Bringing anyone/i)).toBeVisible();

    // Now select Can't — fields should hide
    await page.getByRole("button", { name: /Can't/i }).click();
    await expect(page.getByText(/Bringing anyone/i)).not.toBeVisible();
    await expect(page.getByText(/Dietary restrictions/i)).not.toBeVisible();
  });

  test("always shows message field", async ({ page }) => {
    await page.goto(`/rsvp/${testGuest.rsvp_token}`);

    await expect(page.getByText(/Message for the host/i)).toBeVisible();
  });

  test("returns 404 for invalid RSVP token", async ({ page }) => {
    const response = await page.goto("/rsvp/invalid-token-12345");
    expect(response?.status()).toBe(404);
  });
});

test.describe("RSVP API", () => {
  let apiGuest: Guest;

  test.beforeAll(async () => {
    // Create a separate guest for API tests to avoid state conflict
    apiGuest = await seedGuest(testEvent.id, {
      name: "API RSVP Guest",
      email: "api-rsvp@shindig.test",
    }) as Guest;
  });

  test("GET /api/rsvp/[token] returns guest and event data", async ({ request }) => {
    const res = await request.get(`/api/rsvp/${apiGuest.rsvp_token}`);
    expect(res.status()).toBe(200);

    const data = await res.json();
    expect(data.name).toBe("API RSVP Guest");
    expect(data.events).toBeDefined();
    expect(data.events.title).toBe("RSVP Test Party");
  });

  test("GET /api/rsvp/[token] returns 404 for invalid token", async ({ request }) => {
    const res = await request.get("/api/rsvp/nonexistent-token");
    expect(res.status()).toBe(404);
  });

  test("POST /api/rsvp/[token] updates RSVP status", async ({ request }) => {
    const res = await request.post(`/api/rsvp/${apiGuest.rsvp_token}`, {
      data: {
        rsvp_status: "going",
        plus_one_count: 1,
        dietary: "Vegetarian",
        message: "Looking forward to it!",
      },
    });

    expect(res.status()).toBe(200);

    const data = await res.json();
    expect(data.rsvp_status).toBe("going");
    expect(data.plus_one_count).toBe(1);
    expect(data.dietary).toBe("Vegetarian");
    expect(data.message).toBe("Looking forward to it!");
    expect(data.responded_at).toBeTruthy();
  });
});
