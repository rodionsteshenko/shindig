import { test, expect } from "@playwright/test";
import { ensureTestUser, seedEvent, cleanupTestData } from "./helpers";
import type { Event } from "../src/lib/types";

let testEvent: Event;

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

  test("shows location with maps link", async ({ page }) => {
    await page.goto(`/e/${testEvent.slug}`);

    const locationLink = page.getByRole("link", { name: "Central Park" });
    await expect(locationLink).toBeVisible();
    await expect(locationLink).toHaveAttribute("href", "https://maps.google.com/?q=Central+Park");
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
    const response = await page.goto("/e/non-existent-event-slug-12345");
    expect(response?.status()).toBe(404);
  });
});
