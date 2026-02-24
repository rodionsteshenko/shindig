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

  test("shows reminded indicator for guests with reminded_at set", async ({ page }) => {
    await cleanupTestData();
    const userId = await loginAsTestUser(page);
    const event = await seedEvent(userId);

    // Seed a guest WITH reminded_at set (simulating they were reminded)
    const remindedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
    await seedGuest(event.id, {
      name: "Reminded Guest",
      email: "reminded@shindig.test",
      rsvp_status: "pending",
      reminded_at: remindedAt,
    });

    // Seed a guest WITHOUT reminded_at (never reminded)
    await seedGuest(event.id, {
      name: "Not Reminded Guest",
      email: "notreminded@shindig.test",
      rsvp_status: "pending",
      reminded_at: null,
    });

    await page.goto(`/dashboard/${event.id}`);

    // Filter to Pending guests to see the reminded indicator more clearly
    const pendingButton = page.getByRole("button", { name: /Pending/ });
    await pendingButton.click();

    // Guest list should show both guests
    await expect(page.getByText("Reminded Guest")).toBeVisible();
    await expect(page.getByText("Not Reminded Guest")).toBeVisible();

    // Only the reminded guest should have the reminded indicator
    const remindedRow = page.locator("tr").filter({ hasText: "Reminded Guest" });
    await expect(remindedRow.getByTestId("reminded-indicator")).toBeVisible();
    await expect(remindedRow.getByText(/Reminded \d+d ago/)).toBeVisible();

    // The non-reminded guest should NOT have the indicator
    const notRemindedRow = page.locator("tr").filter({ hasText: "Not Reminded Guest" });
    await expect(notRemindedRow.getByTestId("reminded-indicator")).not.toBeVisible();
  });

  test("reminder button shows pending count and is disabled when no pending guests", async ({ page }) => {
    await cleanupTestData();
    const userId = await loginAsTestUser(page);
    const event = await seedEvent(userId);

    // No guests yet - button should be disabled
    await page.goto(`/dashboard/${event.id}`);
    const reminderBtn = page.getByTestId("send-reminders-button");
    await expect(reminderBtn).toBeVisible();
    await expect(reminderBtn).toHaveText("Send Reminders");
    await expect(reminderBtn).toBeDisabled();
  });

  test("reminder button shows count of pending guests with email", async ({ page }) => {
    await cleanupTestData();
    const userId = await loginAsTestUser(page);
    const event = await seedEvent(userId);

    // Seed 3 pending guests with emails
    await seedGuest(event.id, {
      name: "Guest One",
      email: "guest1@shindig.test",
      rsvp_status: "pending",
    });
    await seedGuest(event.id, {
      name: "Guest Two",
      email: "guest2@shindig.test",
      rsvp_status: "pending",
    });
    await seedGuest(event.id, {
      name: "Guest Three",
      email: "guest3@shindig.test",
      rsvp_status: "pending",
    });

    // Seed a pending guest WITHOUT email - should not be counted
    await seedGuest(event.id, {
      name: "No Email Guest",
      email: null,
      rsvp_status: "pending",
    });

    // Seed a guest who already responded - should not be counted
    await seedGuest(event.id, {
      name: "Responded Guest",
      email: "responded@shindig.test",
      rsvp_status: "going",
    });

    await page.goto(`/dashboard/${event.id}`);
    const reminderBtn = page.getByTestId("send-reminders-button");
    await expect(reminderBtn).toBeVisible();
    await expect(reminderBtn).toHaveText("Send Reminders (3)");
    await expect(reminderBtn).toBeEnabled();
  });

  test("reminder button opens confirmation dialog and shows guest list", async ({ page }) => {
    await cleanupTestData();
    const userId = await loginAsTestUser(page);
    const event = await seedEvent(userId);

    // Seed 2 pending guests with emails
    await seedGuest(event.id, {
      name: "Alice Smith",
      email: "alice@shindig.test",
      rsvp_status: "pending",
    });
    await seedGuest(event.id, {
      name: "Bob Jones",
      email: "bob@shindig.test",
      rsvp_status: "pending",
    });

    await page.goto(`/dashboard/${event.id}`);

    // Click the reminder button
    const reminderBtn = page.getByTestId("send-reminders-button");
    await reminderBtn.click();

    // Confirmation dialog should appear
    const dialog = page.getByTestId("confirm-dialog");
    await expect(dialog).toBeVisible();

    // Dialog should show count in the message
    await expect(dialog.getByText(/Send reminder emails to 2 guests/)).toBeVisible();

    // Dialog should show guest names
    await expect(dialog.getByText(/Alice Smith/)).toBeVisible();
    await expect(dialog.getByText(/Bob Jones/)).toBeVisible();

    // Dialog should have Send and Cancel buttons
    await expect(page.getByTestId("confirm-dialog-confirm")).toHaveText("Send");
    await expect(page.getByTestId("confirm-dialog-cancel")).toHaveText("Cancel");

    // Cancel should close the dialog
    await page.getByTestId("confirm-dialog-cancel").click();
    await expect(dialog).not.toBeVisible();
  });
});
