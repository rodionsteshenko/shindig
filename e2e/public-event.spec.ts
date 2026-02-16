import { test, expect } from "@playwright/test";
import { ensureTestUser, seedEvent, cleanupTestData } from "./helpers";
import type { Event } from "../src/lib/types";

let testEvent: Event;
let eventWithAutoMapsLink: Event;
let eventWithoutLocation: Event;

test.beforeAll(async () => {
  const userId = await ensureTestUser();

  // Event with explicit maps_url
  testEvent = await seedEvent(userId, {
    title: "Public E2E Event",
    description: "This event is visible to everyone",
    location: "Central Park",
    maps_url: "https://maps.google.com/?q=Central+Park",
    cover_image_url: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&h=600&fit=crop",
    gift_registry_url: "https://registry.example.com",
    gift_message: "No gifts needed, just your presence!",
  }) as Event;

  // Event with location but no maps_url (should auto-generate link)
  eventWithAutoMapsLink = await seedEvent(userId, {
    title: "E2E Test Event Auto Maps",
    description: "Event with auto-generated maps link",
    location: "123 Main Street, New York, NY",
    maps_url: null,
  }) as Event;

  // Event without location (location section should not render)
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
  test("renders event details", async ({ page }) => {
    await page.goto(`/e/${testEvent.slug}`);

    await expect(page.getByRole("heading", { name: testEvent.title })).toBeVisible();
    await expect(page.getByText("This event is visible to everyone")).toBeVisible();
  });

  test("shows date and time", async ({ page }) => {
    await page.goto(`/e/${testEvent.slug}`);

    // The date section should be visible (contains calendar emoji)
    await expect(page.getByText("📅", { exact: true })).toBeVisible();
  });

  test("shows location with provided maps link", async ({ page }) => {
    await page.goto(`/e/${testEvent.slug}`);

    const locationLink = page.getByRole("link", { name: "Central Park" });
    await expect(locationLink).toBeVisible();
    await expect(locationLink).toHaveAttribute("href", "https://maps.google.com/?q=Central+Park");
    await expect(locationLink).toHaveAttribute("target", "_blank");
    await expect(locationLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("shows location with auto-generated maps link when no maps_url provided", async ({ page }) => {
    await page.goto(`/e/${eventWithAutoMapsLink.slug}`);

    const locationLink = page.getByRole("link", { name: "123 Main Street, New York, NY" });
    await expect(locationLink).toBeVisible();
    // Should auto-generate Google Maps search link
    await expect(locationLink).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=123%20Main%20Street%2C%20New%20York%2C%20NY"
    );
    await expect(locationLink).toHaveAttribute("target", "_blank");
    await expect(locationLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("shows map pin SVG icon next to location", async ({ page }) => {
    await page.goto(`/e/${testEvent.slug}`);

    // Check that the SVG map pin icon is present
    const locationSection = page.locator("div").filter({ hasText: "Central Park" }).first();
    const svgIcon = locationSection.locator("svg");
    await expect(svgIcon).toBeVisible();
  });

  test("does not show location section when no location set", async ({ page }) => {
    await page.goto(`/e/${eventWithoutLocation.slug}`);

    // The event title should be visible
    await expect(page.getByRole("heading", { name: eventWithoutLocation.title })).toBeVisible();
    // But there should be no map pin icon or location-related links
    const locationLinks = page.getByRole("link").filter({ hasText: /Main Street|Central Park/i });
    await expect(locationLinks).toHaveCount(0);
  });

  test("shows cover image", async ({ page }) => {
    await page.goto(`/e/${testEvent.slug}`);

    const img = page.locator("img").first();
    await expect(img).toBeVisible();
  });

  test("shows gift section", async ({ page }) => {
    await page.goto(`/e/${testEvent.slug}`);

    await expect(page.getByText("No gifts needed, just your presence!")).toBeVisible();
    await expect(page.getByRole("link", { name: /View Gift Registry/i })).toHaveAttribute(
      "href",
      "https://registry.example.com"
    );
  });

  test("shows Add to Calendar button", async ({ page }) => {
    await page.goto(`/e/${testEvent.slug}`);

    const calButton = page.getByRole("link", { name: /Add to Calendar/i });
    await expect(calButton).toBeVisible();
    await expect(calButton).toHaveAttribute("href", `/api/events/${testEvent.slug}/calendar`);
  });

  test("returns 404 for non-existent event slug", async ({ page }) => {
    await page.goto("/e/non-existent-event-slug-12345");
    await expect(page.getByText("404")).toBeVisible();
  });

  test("redirects from event ID (UUID) to slug URL", async ({ page }) => {
    // Navigate to /e/{event-id} (UUID)
    const response = await page.goto(`/e/${testEvent.id}`);

    // Should redirect to /e/{slug}
    await expect(page).toHaveURL(`/e/${testEvent.slug}`);

    // Event page should render correctly after redirect
    await expect(page.getByRole("heading", { name: testEvent.title })).toBeVisible();
  });

  test("returns 404 for non-existent UUID", async ({ page }) => {
    // A valid UUID format but non-existent event
    await page.goto("/e/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText("404")).toBeVisible();
  });
});
