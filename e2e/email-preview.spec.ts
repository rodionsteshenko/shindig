import { test, expect } from "@playwright/test";
import { loginAsTestUser, seedEvent, cleanupTestData, ensureTestUser } from "./helpers";
import type { Event } from "@/lib/types";

test.describe("Email Preview Modal", () => {
  let testEvent: Event;

  test.beforeEach(async ({ page }) => {
    await cleanupTestData();
    const userId = await loginAsTestUser(page);
    testEvent = await seedEvent(userId, {
      title: "Email Preview Test Event",
      description: "<p>A <strong>styled</strong> description for the preview.</p>",
      location: "123 Preview Lane",
      cover_image_url: "https://example.com/cover.jpg",
    }) as Event;
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("shows Preview Invitation button on dashboard", async ({ page }) => {
    await page.goto(`/dashboard/${testEvent.id}`);
    await expect(page.getByRole("button", { name: "Preview Invitation" })).toBeVisible();
  });

  test("opens modal when Preview Invitation is clicked", async ({ page }) => {
    await page.goto(`/dashboard/${testEvent.id}`);

    // Click the Preview Invitation button
    await page.getByRole("button", { name: "Preview Invitation" }).click();

    // Modal should appear with event title (in the subtitle)
    await expect(page.getByRole("heading", { name: "Email Preview", exact: true })).toBeVisible();
    // The event title appears in both the page h1 and modal subtitle - check the modal version
    const modalSubtitle = page.locator(".bg-white.rounded-xl").getByText("Email Preview Test Event");
    await expect(modalSubtitle).toBeVisible();
  });

  test("modal shows email content in iframe", async ({ page }) => {
    await page.goto(`/dashboard/${testEvent.id}`);
    await page.getByRole("button", { name: "Preview Invitation" }).click();

    // Wait for preview to load
    await expect(page.getByText("Loading preview...")).not.toBeVisible({ timeout: 10000 });

    // The iframe should exist with the email content
    const iframe = page.locator("iframe[title='Email Preview']");
    await expect(iframe).toBeVisible();
  });

  test("can toggle between mobile and desktop preview", async ({ page }) => {
    await page.goto(`/dashboard/${testEvent.id}`);
    await page.getByRole("button", { name: "Preview Invitation" }).click();

    // Wait for modal to fully load
    await expect(page.getByRole("heading", { name: "Email Preview", exact: true })).toBeVisible();

    // Both toggle buttons should be visible
    const mobileBtn = page.getByRole("button", { name: /Mobile/ });
    const desktopBtn = page.getByRole("button", { name: /Desktop/ });

    await expect(mobileBtn).toBeVisible();
    await expect(desktopBtn).toBeVisible();

    // Desktop should be selected by default (check background color class)
    await expect(desktopBtn).toHaveClass(/bg-shindig-600/);

    // Click mobile button
    await mobileBtn.click();

    // Mobile should now be selected
    await expect(mobileBtn).toHaveClass(/bg-shindig-600/);
    await expect(desktopBtn).not.toHaveClass(/bg-shindig-600/);

    // Click desktop button to switch back
    await desktopBtn.click();

    // Desktop should be selected again
    await expect(desktopBtn).toHaveClass(/bg-shindig-600/);
    await expect(mobileBtn).not.toHaveClass(/bg-shindig-600/);
  });

  test("shows Send Test Email button", async ({ page }) => {
    await page.goto(`/dashboard/${testEvent.id}`);
    await page.getByRole("button", { name: "Preview Invitation" }).click();

    await expect(page.getByRole("button", { name: "Send Test Email" })).toBeVisible();
  });

  test("can close modal by clicking X button", async ({ page }) => {
    await page.goto(`/dashboard/${testEvent.id}`);
    await page.getByRole("button", { name: "Preview Invitation" }).click();

    // Modal should be visible
    await expect(page.getByRole("heading", { name: "Email Preview", exact: true })).toBeVisible();

    // Click the close button
    await page.getByRole("button", { name: "Close" }).click();

    // Modal should close
    await expect(page.getByRole("heading", { name: "Email Preview", exact: true })).not.toBeVisible();
  });

  test("can close modal by clicking outside", async ({ page }) => {
    await page.goto(`/dashboard/${testEvent.id}`);
    await page.getByRole("button", { name: "Preview Invitation" }).click();

    // Modal should be visible
    await expect(page.getByRole("heading", { name: "Email Preview", exact: true })).toBeVisible();

    // Click outside the modal (on the overlay)
    await page.locator(".fixed.inset-0").click({ position: { x: 10, y: 10 } });

    // Modal should close
    await expect(page.getByRole("heading", { name: "Email Preview", exact: true })).not.toBeVisible();
  });
});

test.describe("Preview Email API", () => {
  let testEvent: Event;

  test.beforeAll(async () => {
    const userId = await ensureTestUser();
    testEvent = await seedEvent(userId, {
      title: "API Test Event",
    }) as Event;
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("GET /api/events/manage/[id]/preview-email requires auth", async ({ request }) => {
    const res = await request.get(`/api/events/manage/${testEvent.id}/preview-email`);
    expect(res.status()).toBe(401);
  });

  test("POST /api/events/manage/[id]/preview-email requires auth", async ({ request }) => {
    const res = await request.post(`/api/events/manage/${testEvent.id}/preview-email`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/events/manage/[id]/preview-email returns 200 for authenticated host", async ({ page }) => {
    await loginAsTestUser(page);
    const res = await page.request.get(`/api/events/manage/${testEvent.id}/preview-email`);

    expect(res.status()).toBe(200);

    const data = await res.json();
    expect(data.html).toBeDefined();
    expect(data.html).toContain("You're Invited!");
    expect(data.html).toContain("API Test Event");
  });

  test("POST /api/events/manage/[id]/preview-email returns 200 for authenticated host", async ({ page }) => {
    await loginAsTestUser(page);
    const res = await page.request.post(`/api/events/manage/${testEvent.id}/preview-email`);

    // May return 200 (success) or 503 (email not configured), both are valid
    expect([200, 503]).toContain(res.status());

    if (res.status() === 200) {
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.sentTo).toBeDefined();
    }
  });

  test("GET returns 404 for non-existent event", async ({ page }) => {
    await loginAsTestUser(page);
    const res = await page.request.get("/api/events/manage/00000000-0000-0000-0000-000000000000/preview-email");
    expect(res.status()).toBe(404);
  });

  test("POST returns 404 for non-existent event", async ({ page }) => {
    await loginAsTestUser(page);
    const res = await page.request.post("/api/events/manage/00000000-0000-0000-0000-000000000000/preview-email");
    expect(res.status()).toBe(404);
  });
});
