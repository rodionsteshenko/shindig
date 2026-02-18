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

  test("shows rich text description with HTML formatting", async ({ page }) => {
    await cleanupTestData();
    const userId = await loginAsTestUser(page);
    const htmlDescription = "<p>This is a <strong>bold</strong> description with <em>italic</em> text.</p><ul><li>First item</li><li>Second item</li></ul>";
    const event = await seedEvent(userId, { description: htmlDescription });

    await page.goto(`/dashboard/${event.id}`);

    // Description section should be visible
    await expect(page.getByRole("heading", { name: "Description" })).toBeVisible();

    // Get the description container
    const descriptionSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Description" }) });

    // Should render the HTML content as styled prose
    await expect(descriptionSection.locator("strong")).toHaveText("bold");
    await expect(descriptionSection.locator("em")).toHaveText("italic");

    // Should render the list
    await expect(descriptionSection.locator("li")).toHaveCount(2);
    await expect(descriptionSection.locator("li").first()).toHaveText("First item");
    await expect(descriptionSection.locator("li").last()).toHaveText("Second item");
  });

  test("does not show description section when no description", async ({ page }) => {
    await cleanupTestData();
    const userId = await loginAsTestUser(page);
    const event = await seedEvent(userId, { description: null });

    await page.goto(`/dashboard/${event.id}`);

    // Description section should NOT be visible
    await expect(page.getByRole("heading", { name: "Description" })).not.toBeVisible();

    // But other sections should be visible
    await expect(page.getByRole("heading", { name: "RSVP Summary" })).toBeVisible();
  });

  test("renders plain text description correctly (legacy fallback)", async ({ page }) => {
    await cleanupTestData();
    const userId = await loginAsTestUser(page);
    const plainDescription = "This is a plain text description\nwith multiple lines.";
    const event = await seedEvent(userId, { description: plainDescription });

    await page.goto(`/dashboard/${event.id}`);

    // Description section should be visible
    await expect(page.getByRole("heading", { name: "Description" })).toBeVisible();

    // Plain text should be rendered (without HTML tags)
    await expect(page.getByText("This is a plain text description")).toBeVisible();
  });
});
