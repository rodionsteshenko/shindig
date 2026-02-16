import { test, expect } from "@playwright/test";
import { loginAsTestUser, seedEvent, seedGuest, cleanupTestData, ensureTestUser } from "./helpers";
import type { Event, Guest } from "@/lib/types";

test.describe("Dashboard", () => {
  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("redirects to login if not authenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login");
    expect(page.url()).toContain("/login");
  });

  test("shows empty state when no events", async ({ page }) => {
    await cleanupTestData();
    await loginAsTestUser(page);
    await page.goto("/dashboard");
    await expect(page.getByText("Your Events")).toBeVisible();
    await expect(page.getByText("No events yet")).toBeVisible();
  });

  test("shows event card when events exist", async ({ page }) => {
    await cleanupTestData();
    const userId = await loginAsTestUser(page);
    await seedEvent(userId);
    await page.goto("/dashboard");
    await expect(page.getByText("Test Event")).toBeVisible();
  });

  test("links to create event page", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/dashboard");
    const newEventLink = page.getByRole("link", { name: "+ New Event" });
    await expect(newEventLink).toBeVisible();
    await expect(newEventLink).toHaveAttribute("href", "/create");
  });
});

test.describe("Event Dashboard", () => {
  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("redirects to login if not authenticated", async ({ page }) => {
    await page.goto("/dashboard/00000000-0000-0000-0000-000000000000");
    await page.waitForURL("**/login");
    expect(page.url()).toContain("/login");
  });

  test("returns 404 for non-existent event", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/dashboard/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText("404")).toBeVisible();
  });

  test("shows event management page with all sections", async ({ page }) => {
    await cleanupTestData();
    const userId = await loginAsTestUser(page);
    const event = await seedEvent(userId);
    const guest = await seedGuest(event.id);

    await page.goto(`/dashboard/${event.id}`);

    // Header
    await expect(page.getByRole("heading", { name: event.title })).toBeVisible();
    await expect(page.getByRole("link", { name: "View Public Page" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit Event" })).toBeVisible();

    // RSVP Summary section
    await expect(page.getByText("RSVP Summary")).toBeVisible();

    // Guest List section
    await expect(page.getByText("Guest List")).toBeVisible();
    await expect(page.getByText(guest.name)).toBeVisible();

    // Actions section
    await expect(page.getByText("Send Invitations")).toBeVisible();
    await expect(page.getByText("Send Reminders")).toBeVisible();
    await expect(page.getByText("Delete Event")).toBeVisible();
  });

  test("shows export CSV button when guests exist", async ({ page }) => {
    await cleanupTestData();
    const userId = await loginAsTestUser(page);
    const event = await seedEvent(userId);
    await seedGuest(event.id);

    await page.goto(`/dashboard/${event.id}`);
    await expect(page.getByText("Export CSV")).toBeVisible();
  });

  test("edit page loads with event data", async ({ page }) => {
    await cleanupTestData();
    const userId = await loginAsTestUser(page);
    const event = await seedEvent(userId);

    await page.goto(`/dashboard/${event.id}/edit`);
    await expect(page.getByRole("heading", { name: "Edit Event" })).toBeVisible();

    const titleInput = page.locator("#title");
    await expect(titleInput).toHaveValue(event.title);
  });
});
