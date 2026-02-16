import { test, expect } from "@playwright/test";
import { ensureTestUser, seedEvent, seedGuest, cleanupTestData } from "./helpers";
import type { Event, Guest } from "../src/lib/types";

let testEvent: Event;
let testGuest: Guest;
let testEventWithMapsLink: Event;
let testGuestWithMapsLink: Guest;

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

  // Create event with explicit maps_url for location link testing
  testEventWithMapsLink = await seedEvent(userId, {
    title: "RSVP Location Test Event",
    description: "Test location link on RSVP page",
    location: "456 Maps Test Ave",
    maps_url: "https://maps.google.com/test-location",
  }) as Event;
  testGuestWithMapsLink = await seedGuest(testEventWithMapsLink.id, {
    name: "Maps Test Guest",
    email: "maps-guest@shindig.test",
  }) as Guest;
});

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe("RSVP Page", () => {
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

  test("returns 404 for invalid RSVP token", async ({ page }) => {
    await page.goto("/rsvp/invalid-token-12345");
    await expect(page.getByText("404")).toBeVisible();
  });

  test("displays location with clickable maps link", async ({ page }) => {
    await page.goto(`/rsvp/${testGuestWithMapsLink.rsvp_token}`);

    // Location should be visible
    await expect(page.getByText("456 Maps Test Ave")).toBeVisible();

    // Location should be a link with the custom maps_url
    const locationLink = page.getByRole("link", { name: "456 Maps Test Ave" });
    await expect(locationLink).toBeVisible();
    await expect(locationLink).toHaveAttribute("href", "https://maps.google.com/test-location");
    await expect(locationLink).toHaveAttribute("target", "_blank");
  });

  test("displays location with auto-generated Google Maps link when no maps_url", async ({ page }) => {
    await page.goto(`/rsvp/${testGuest.rsvp_token}`);

    // Location should be visible and be a link
    const locationLink = page.getByRole("link", { name: "RSVP Venue" });
    await expect(locationLink).toBeVisible();
    // Should have auto-generated Google Maps search URL
    await expect(locationLink).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=RSVP%20Venue"
    );
    await expect(locationLink).toHaveAttribute("target", "_blank");
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
