import { test, expect } from "@playwright/test";
import { ensureTestUser, seedEvent, cleanupTestData } from "./helpers";
import type { Event } from "../src/lib/types";

let testEvent: Event;
let eventWithAutoMapsLink: Event;
let eventWithoutLocation: Event;

test.beforeAll(async () => {
  const userId = await ensureTestUser();

  testEvent = await seedEvent(userId, {
    title: "Public E2E Event",
    description: "This event is visible to everyone",
    location: "Central Park",
    maps_url: "https://maps.google.com/?q=Central+Park",
    cover_image_url: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&h=600&fit=crop",
    gift_registry_url: "https://registry.example.com",
    gift_message: "No gifts needed, just your presence!",
  }) as Event;

  eventWithAutoMapsLink = await seedEvent(userId, {
    title: "E2E Test Event Auto Maps",
    description: "Event with auto-generated maps link",
    location: "123 Main Street, New York, NY",
    maps_url: null,
  }) as Event;

  eventWithoutLocation = await seedEvent(userId, {
    title: "E2E Test Event No Location",
    description: "Event without any location set",
    location: null,
    maps_url: null,
  }) as Event;
});

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe("Public Event Page", () => {
  test("location links to provided Google Maps URL", async ({ page }) => {
    await page.goto(`/e/${testEvent.slug}`);

    const locationLink = page.getByRole("link", { name: "Central Park" });
    await expect(locationLink).toBeVisible();
    await expect(locationLink).toHaveAttribute("href", "https://maps.google.com/?q=Central+Park");
    await expect(locationLink).toHaveAttribute("target", "_blank");
  });

  test("location auto-generates Google Maps link when no maps_url provided", async ({ page }) => {
    await page.goto(`/e/${eventWithAutoMapsLink.slug}`);

    const locationLink = page.getByRole("link", { name: "123 Main Street, New York, NY" });
    await expect(locationLink).toBeVisible();
    await expect(locationLink).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=123%20Main%20Street%2C%20New%20York%2C%20NY"
    );
  });

  test("event without location does not show location section", async ({ page }) => {
    await page.goto(`/e/${eventWithoutLocation.slug}`);

    await expect(page.getByRole("heading", { name: eventWithoutLocation.title })).toBeVisible();
    const locationLinks = page.getByRole("link").filter({ hasText: /Main Street|Central Park/i });
    await expect(locationLinks).toHaveCount(0);
  });

  test("gift section shows registry link and message", async ({ page }) => {
    await page.goto(`/e/${testEvent.slug}`);

    await expect(page.getByText("No gifts needed, just your presence!")).toBeVisible();
    const registryLink = page.getByRole("link", { name: /View Gift Registry/i });
    await expect(registryLink).toHaveAttribute("href", "https://registry.example.com");
  });

  test("Add to Calendar links to .ics download", async ({ page }) => {
    await page.goto(`/e/${testEvent.slug}`);

    const calLink = page.getByRole("link", { name: /Add to Calendar/i });
    await expect(calLink).toHaveAttribute("href", `/api/events/${testEvent.slug}/calendar`);
  });

  test("returns 404 for non-existent event slug", async ({ page }) => {
    await page.goto("/e/non-existent-event-slug-12345");
    await expect(page.getByText("404")).toBeVisible();
  });

  test("redirects from event ID (UUID) to canonical slug URL", async ({ page }) => {
    await page.goto(`/e/${testEvent.id}`);

    await expect(page).toHaveURL(`/e/${testEvent.slug}`);
    await expect(page.getByRole("heading", { name: testEvent.title })).toBeVisible();
  });

  test("returns 404 for non-existent UUID", async ({ page }) => {
    await page.goto("/e/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText("404")).toBeVisible();
  });
});
