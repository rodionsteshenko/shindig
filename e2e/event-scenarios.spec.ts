import { test, expect } from "@playwright/test";
import { loginAsTestUser, cleanupTestData } from "./helpers";

/**
 * Comprehensive event creation scenarios.
 * Tests different types of events a real user would create,
 * and verifies the public event page displays them correctly.
 */
test.describe("Event Creation Scenarios", () => {
  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("create a minimal event — title and date only", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/create");

    await page.getByLabel(/Event Title/i).fill("E2E Test Minimal Event");
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await page.getByLabel(/Start Date/i).fill(tomorrow.toISOString().slice(0, 16));

    // Timezone should be auto-detected (select dropdown, not empty)
    const timezoneSelect = page.getByLabel(/Timezone/i);
    await expect(timezoneSelect).toBeVisible();
    const tzValue = await timezoneSelect.inputValue();
    expect(tzValue).toBeTruthy(); // Should have a default value

    await page.getByRole("button", { name: /Create Event/i }).click();
    await page.waitForURL("**/dashboard/**", { timeout: 10000 });

    // Grab the event ID from the URL to visit the public page
    const dashUrl = page.url();
    const eventId = dashUrl.split("/dashboard/")[1]?.split(/[?#/]/)[0];
    expect(eventId).toBeTruthy();

    // Visit public page and verify it shows the event
    await page.goto(`/e/${eventId}`);
    // If UUID redirects to slug, that's fine — just check the title shows
    await expect(page.getByRole("heading", { name: "E2E Test Minimal Event" })).toBeVisible();

    // Minimal event should NOT show gift section
    await expect(page.getByText("Gifts")).not.toBeVisible();

    // Should NOT show location
    await expect(page.getByText("📍")).not.toBeVisible();
  });

  test("create event with start and end date", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/create");

    await page.getByLabel(/Event Title/i).fill("E2E Test Timed Event");

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const endDate = new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000); // 3 hours later

    await page.getByLabel(/Start Date/i).fill(tomorrow.toISOString().slice(0, 16));
    await page.getByLabel(/End Date/i).fill(endDate.toISOString().slice(0, 16));

    await page.getByRole("button", { name: /Create Event/i }).click();
    await page.waitForURL("**/dashboard/**", { timeout: 10000 });

    // Visit the public page
    const dashUrl = page.url();
    const eventId = dashUrl.split("/dashboard/")[1]?.split(/[?#/]/)[0];
    await page.goto(`/e/${eventId}`);
    await expect(page.getByRole("heading", { name: "E2E Test Timed Event" })).toBeVisible();

    // Should show the end time (the date section includes both start and end times)
    const dateSection = page.locator("div").filter({ hasText: /at .+ — .+/ }).first();
    await expect(dateSection).toBeVisible();
  });

  test("create event with gift registry and message", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/create");

    await page.getByLabel(/Event Title/i).fill("E2E Test Gift Event");
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await page.getByLabel(/Start Date/i).fill(tomorrow.toISOString().slice(0, 16));

    // Fill in gift fields
    await page.getByLabel(/Gift Registry URL/i).fill("https://registry.example.com/our-wedding");
    await page.getByLabel(/Gift Message/i).fill("Your presence is the best gift!");

    await page.getByRole("button", { name: /Create Event/i }).click();
    await page.waitForURL("**/dashboard/**", { timeout: 10000 });

    // Visit public page and verify gifts section appears
    const dashUrl = page.url();
    const eventId = dashUrl.split("/dashboard/")[1]?.split(/[?#/]/)[0];
    await page.goto(`/e/${eventId}`);

    await expect(page.getByText("Gifts")).toBeVisible();
    await expect(page.getByText("Your presence is the best gift!")).toBeVisible();
    await expect(page.getByText("View Gift Registry")).toBeVisible();
  });

  test("create event with location and maps link", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/create");

    await page.getByLabel(/Event Title/i).fill("E2E Test Location Event Full");
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await page.getByLabel(/Start Date/i).fill(tomorrow.toISOString().slice(0, 16));

    await page.getByLabel(/Location \/ Address/i).fill("Central Park, New York, NY");
    await page.getByLabel(/Google Maps Link/i).fill("https://maps.google.com/?q=central+park");

    await page.getByRole("button", { name: /Create Event/i }).click();
    await page.waitForURL("**/dashboard/**", { timeout: 10000 });

    // Visit public page and verify location shows
    const dashUrl = page.url();
    const eventId = dashUrl.split("/dashboard/")[1]?.split(/[?#/]/)[0];
    await page.goto(`/e/${eventId}`);

    await expect(page.getByText("Central Park, New York, NY")).toBeVisible();
  });

  test("create event with description and cover image", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/create");

    await page.getByLabel(/Event Title/i).fill("E2E Test Full Description Event");
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await page.getByLabel(/Start Date/i).fill(tomorrow.toISOString().slice(0, 16));
    await page.getByLabel(/Description/i).fill(
      "Join us for an amazing party with food, drinks, and music! Everyone is welcome."
    );

    // Select a cover image preset (click the "Party" button)
    await page.getByRole("button", { name: /Party/i }).click();

    await page.getByRole("button", { name: /Create Event/i }).click();
    await page.waitForURL("**/dashboard/**", { timeout: 10000 });

    // Visit public page and verify
    const dashUrl = page.url();
    const eventId = dashUrl.split("/dashboard/")[1]?.split(/[?#/]/)[0];
    await page.goto(`/e/${eventId}`);

    await expect(page.getByText("Join us for an amazing party")).toBeVisible();
    // Cover image should be present
    await expect(page.locator("img[alt='E2E Test Full Description Event']")).toBeVisible();
  });

  test("create event with plus-ones disabled", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/create");

    await page.getByLabel(/Event Title/i).fill("E2E Test No Plus Ones");
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await page.getByLabel(/Start Date/i).fill(tomorrow.toISOString().slice(0, 16));

    // Uncheck "Allow plus-ones"
    const plusOnesCheckbox = page.getByText("Allow plus-ones");
    await plusOnesCheckbox.click();

    await page.getByRole("button", { name: /Create Event/i }).click();
    await page.waitForURL("**/dashboard/**", { timeout: 10000 });
  });

  test("create private event — should not be visible on public page", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/create");

    const privateSlug = `e2e-private-${Date.now()}`;

    await page.getByLabel(/Event Title/i).fill("E2E Test Private Event");
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await page.getByLabel(/Start Date/i).fill(tomorrow.toISOString().slice(0, 16));
    await page.getByLabel(/Custom URL/i).fill(privateSlug);
    await expect(page.getByText("Available")).toBeVisible({ timeout: 5000 });

    // Uncheck "Public event page"
    await page.getByText("Public event page").click();

    await page.getByRole("button", { name: /Create Event/i }).click();
    await page.waitForURL("**/dashboard/**", { timeout: 10000 });

    // Try visiting the public page — should show not found
    await page.goto(`/e/${privateSlug}`);
    await expect(page.getByText(/not found/i)).toBeVisible({ timeout: 5000 });
  });

  test("create fully loaded event — all fields filled", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/create");

    const fullSlug = `e2e-full-event-${Date.now()}`;
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const endDate = new Date(tomorrow.getTime() + 4 * 60 * 60 * 1000);

    // Fill every field
    await page.getByLabel(/Event Title/i).fill("E2E Test Full Event");
    await page.getByLabel(/Custom URL/i).fill(fullSlug);
    await expect(page.getByText("Available")).toBeVisible({ timeout: 5000 });
    await page.getByLabel(/Description/i).fill("This event has everything — location, gifts, custom URL, cover image, the works.");
    await page.getByLabel(/Start Date/i).fill(tomorrow.toISOString().slice(0, 16));
    await page.getByLabel(/End Date/i).fill(endDate.toISOString().slice(0, 16));
    await page.getByLabel(/Location \/ Address/i).fill("The Grand Ballroom, 456 Oak Ave");
    await page.getByLabel(/Google Maps Link/i).fill("https://maps.google.com/?q=grand+ballroom");
    await page.getByRole("button", { name: /Wedding/i }).click(); // Cover image preset
    await page.getByLabel(/Gift Registry URL/i).fill("https://registry.example.com/full-event");
    await page.getByLabel(/Gift Message/i).fill("Check our registry for ideas!");

    await page.getByRole("button", { name: /Create Event/i }).click();
    await page.waitForURL("**/dashboard/**", { timeout: 10000 });

    // Verify everything on the public page
    await page.goto(`/e/${fullSlug}`);

    await expect(page.getByRole("heading", { name: "E2E Test Full Event" })).toBeVisible();
    await expect(page.getByText("This event has everything")).toBeVisible();
    await expect(page.getByText("The Grand Ballroom")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Gifts/i })).toBeVisible();
    await expect(page.getByText("Check our registry for ideas!")).toBeVisible();
    await expect(page.getByText("View Gift Registry")).toBeVisible();
    await expect(page.locator("img[alt='E2E Test Full Event']")).toBeVisible();
    await expect(page.getByText("Add to Calendar")).toBeVisible();
  });

  test("timezone dropdown has correct default and can be changed", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/create");

    const timezoneSelect = page.getByLabel(/Timezone/i);
    await expect(timezoneSelect).toBeVisible();

    // Should be a <select> element, not a text input
    const tagName = await timezoneSelect.evaluate((el) => el.tagName.toLowerCase());
    expect(tagName).toBe("select");

    // Should have a default value (browser's timezone)
    const defaultTz = await timezoneSelect.inputValue();
    expect(defaultTz).toBeTruthy();
    expect(defaultTz).toContain("/"); // IANA format like "America/New_York"

    // Should have many options (there are 400+ IANA timezones)
    const optionCount = await timezoneSelect.locator("option").count();
    expect(optionCount).toBeGreaterThan(100);

    // Can change timezone
    await timezoneSelect.selectOption("Europe/London");
    expect(await timezoneSelect.inputValue()).toBe("Europe/London");
  });

  test("server validation errors display per-field messages", async ({ page }) => {
    await loginAsTestUser(page);

    // Submit via API with invalid data to trigger server validation
    const response = await page.request.post("/api/events", {
      data: {
        // Missing title, start_time, timezone
        description: "This should fail validation",
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Validation failed");
    expect(data.errors).toBeDefined();
    expect(data.errors.title).toBe("Title is required");
    expect(data.errors.start_time).toBe("Start time is required");
    expect(data.errors.timezone).toBe("Timezone is required");
  });

  test("form shows validation errors when server rejects submission", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/create");

    // Clear the timezone (simulate the bug the user hit)
    const timezoneSelect = page.getByLabel(/Timezone/i);
    // Select an empty option won't work on a select, but we can test
    // that the form handles server errors properly by submitting with
    // a very long title that exceeds the 200 char limit
    const longTitle = "A".repeat(201);
    await page.getByLabel(/Event Title/i).fill(longTitle);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await page.getByLabel(/Start Date/i).fill(tomorrow.toISOString().slice(0, 16));

    await page.getByRole("button", { name: /Create Event/i }).click();

    // Should show the error box with field-specific message
    await expect(page.getByText("Validation failed")).toBeVisible({ timeout: 5000 });
    // Error appears both inline and in the summary — check the summary list item
    await expect(page.getByRole("listitem").filter({ hasText: "Title must be 200 characters or less" })).toBeVisible();
  });
});
