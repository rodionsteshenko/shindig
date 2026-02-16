import { test, expect } from "@playwright/test";
import { loginAsTestUser, cleanupTestData } from "./helpers";

test.describe("Event Creation", () => {
  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("redirects to login if not authenticated", async ({ page }) => {
    await page.goto("/create");
    await page.waitForURL("**/login**");
  });

  test("renders event form when authenticated", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/create");

    await expect(page.getByRole("heading", { name: /Create an Event/i })).toBeVisible();
    await expect(page.getByLabel(/Event Title/i)).toBeVisible();
    await expect(page.getByLabel(/Description/i)).toBeVisible();
    await expect(page.getByLabel(/Start Date/i)).toBeVisible();
    await expect(page.getByLabel(/End Date/i)).toBeVisible();
    await expect(page.getByLabel(/Location/i)).toBeVisible();
    await expect(page.getByLabel(/Maps Link/i)).toBeVisible();
    await expect(page.getByText(/Cover Image/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Create Event/i })).toBeVisible();
  });

  test("shows 8 cover image presets", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/create");

    // Each preset has a label text overlay
    await expect(page.getByText("Party")).toBeVisible();
    await expect(page.getByText("Dinner")).toBeVisible();
    await expect(page.getByText("Outdoor")).toBeVisible();
    await expect(page.getByText("Birthday")).toBeVisible();
    await expect(page.getByText("Wedding")).toBeVisible();
    await expect(page.getByText("Corporate")).toBeVisible();
    await expect(page.getByText("Beach")).toBeVisible();
    await expect(page.getByText("Concert")).toBeVisible();
  });

  test("shows checkboxes for public and plus-ones", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/create");

    await expect(page.getByText("Public event page")).toBeVisible();
    await expect(page.getByText("Allow plus-ones")).toBeVisible();
  });

  test("can submit event form and redirect to dashboard", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/create");

    // Fill in required fields
    await page.getByLabel(/Event Title/i).fill("E2E Test Party");

    // Set start time (tomorrow)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dateStr = tomorrow.toISOString().slice(0, 16);
    await page.getByLabel(/Start Date/i).fill(dateStr);

    await page.getByLabel(/Description/i).fill("A test event created by E2E tests");
    await page.getByLabel(/Location/i).fill("Test Venue");

    // Submit the form
    await page.getByRole("button", { name: /Create Event/i }).click();

    // Should redirect to dashboard event page
    await page.waitForURL("**/dashboard/**", { timeout: 10000 });
  });
});
