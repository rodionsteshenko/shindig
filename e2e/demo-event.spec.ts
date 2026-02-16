import { test, expect } from "@playwright/test";
import {
  ensureTestUser,
  seedEvent,
  cleanupTestData,
  adminClient,
} from "./helpers";

test.beforeAll(async () => {
  // Remove any existing demo event to avoid slug conflict
  const supabase = adminClient();
  await supabase.from("events").delete().eq("slug", "demo");

  const userId = await ensureTestUser();
  // Seed a demo event with slug "demo" — mirroring the seed-demo script
  await seedEvent(userId, {
    title: "Summer Rooftop Party",
    slug: "demo",
    description: "Join us for an evening of great food, music, and city views!",
    location: "The Rooftop at Pier 17, New York, NY",
    maps_url: "https://maps.google.com/?q=Pier+17+Rooftop+NYC",
    gift_message: "No gifts necessary! Your presence is the best present.",
  });
});

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe("Demo Event Page", () => {
  test("clicking demo link from landing page navigates to /e/demo", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /See a Demo/i }).click();
    await expect(page).toHaveURL(/\/e\/demo/);
    await expect(
      page.getByRole("heading", { name: /Summer Rooftop Party/i })
    ).toBeVisible();
  });

  test("renders demo event details directly", async ({ page }) => {
    await page.goto("/e/demo");
    await expect(
      page.getByRole("heading", { name: /Summer Rooftop Party/i })
    ).toBeVisible();
    await expect(page.getByText(/great food, music/i)).toBeVisible();
  });

  test("shows location", async ({ page }) => {
    await page.goto("/e/demo");
    await expect(page.getByText(/Pier 17/i)).toBeVisible();
  });

  test("shows gift message", async ({ page }) => {
    await page.goto("/e/demo");
    await expect(page.getByText(/No gifts necessary/i)).toBeVisible();
  });
});
