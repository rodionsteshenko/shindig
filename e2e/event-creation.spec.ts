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
    await page.getByLabel(/Location \/ Address/i).fill("Test Venue");

    // Submit the form
    await page.getByRole("button", { name: /Create Event/i }).click();

    // Should redirect to dashboard event page
    await page.waitForURL("**/dashboard/**", { timeout: 10000 });
  });

  test("shows validation error for non-https Google Maps link", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/create");

    // Fill in required fields
    await page.getByLabel(/Event Title/i).fill("E2E Test Validation");
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dateStr = tomorrow.toISOString().slice(0, 16);
    await page.getByLabel(/Start Date/i).fill(dateStr);

    // Enter an invalid (http) maps URL
    await page.getByLabel(/Google Maps Link/i).fill("http://maps.google.com/test");
    await page.getByLabel(/Google Maps Link/i).blur();

    // Should show validation error
    await expect(page.getByText("Maps link must start with https://")).toBeVisible();
  });

  test("can submit event with location and Google Maps link", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/create");

    // Fill in required fields
    await page.getByLabel(/Event Title/i).fill("E2E Test Location Event");
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dateStr = tomorrow.toISOString().slice(0, 16);
    await page.getByLabel(/Start Date/i).fill(dateStr);

    // Fill in location fields
    await page.getByLabel(/Location \/ Address/i).fill("123 Test Street, Test City");
    await page.getByLabel(/Google Maps Link/i).fill("https://maps.google.com/test");

    // Submit the form
    await page.getByRole("button", { name: /Create Event/i }).click();

    // Should redirect to dashboard event page
    await page.waitForURL("**/dashboard/**", { timeout: 10000 });
  });

  test("can submit event without location fields (optional)", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/create");

    // Fill in only required fields - no location
    await page.getByLabel(/Event Title/i).fill("E2E Test No Location");
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dateStr = tomorrow.toISOString().slice(0, 16);
    await page.getByLabel(/Start Date/i).fill(dateStr);

    // Submit the form without filling location fields
    await page.getByRole("button", { name: /Create Event/i }).click();

    // Should redirect to dashboard event page
    await page.waitForURL("**/dashboard/**", { timeout: 10000 });
  });

  test("validates custom slug format - too short", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/create");

    // Enter a slug that's too short
    await page.getByLabel(/Custom URL/i).fill("ab");
    await page.getByLabel(/Custom URL/i).blur();

    // Should show validation error
    await expect(page.getByText("URL must be at least 3 characters")).toBeVisible();
  });

  test("validates custom slug format - invalid characters", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/create");

    // Enter a slug with invalid characters (uppercase gets converted to lowercase,
    // but special characters should trigger error)
    await page.getByLabel(/Custom URL/i).fill("my_party!");
    await page.getByLabel(/Custom URL/i).blur();

    // Should show validation error
    await expect(page.getByText("URL can only contain lowercase letters, numbers, and hyphens")).toBeVisible();
  });

  test("shows availability status for valid custom slug", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/create");

    // Generate a unique slug that shouldn't exist
    const uniqueSlug = `e2e-test-${Date.now()}`;
    await page.getByLabel(/Custom URL/i).fill(uniqueSlug);

    // Wait for the availability check (debounced)
    await expect(page.getByText("Checking...")).toBeVisible();
    await expect(page.getByText("Available")).toBeVisible({ timeout: 5000 });
  });

  test("can submit event with custom slug and access via that slug", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/create");

    // Generate a unique slug for this test
    const customSlug = `e2e-custom-slug-${Date.now()}`;

    // Fill in required fields
    await page.getByLabel(/Event Title/i).fill("E2E Test Custom Slug Event");
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dateStr = tomorrow.toISOString().slice(0, 16);
    await page.getByLabel(/Start Date/i).fill(dateStr);

    // Enter custom slug
    await page.getByLabel(/Custom URL/i).fill(customSlug);

    // Wait for availability check to complete
    await expect(page.getByText("Available")).toBeVisible({ timeout: 5000 });

    // Submit the form
    await page.getByRole("button", { name: /Create Event/i }).click();

    // Should redirect to dashboard event page
    await page.waitForURL("**/dashboard/**", { timeout: 10000 });

    // Now navigate to the public event page using the custom slug
    await page.goto(`/e/${customSlug}`);

    // Verify we can access the event via the custom slug
    await expect(page.getByRole("heading", { name: "E2E Test Custom Slug Event" })).toBeVisible();
  });

  test("shows error when custom slug is already taken", async ({ page }) => {
    await loginAsTestUser(page);

    // First, create an event with a specific slug
    const duplicateSlug = `e2e-duplicate-${Date.now()}`;

    await page.goto("/create");
    await page.getByLabel(/Event Title/i).fill("E2E Test First Event");
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dateStr = tomorrow.toISOString().slice(0, 16);
    await page.getByLabel(/Start Date/i).fill(dateStr);
    await page.getByLabel(/Custom URL/i).fill(duplicateSlug);
    await expect(page.getByText("Available")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /Create Event/i }).click();
    await page.waitForURL("**/dashboard/**", { timeout: 10000 });

    // Now try to create another event with the same slug
    await page.goto("/create");
    await page.getByLabel(/Event Title/i).fill("E2E Test Second Event");
    await page.getByLabel(/Start Date/i).fill(dateStr);
    await page.getByLabel(/Custom URL/i).fill(duplicateSlug);

    // Should show that the slug is already taken
    await expect(page.getByText("This URL is already taken")).toBeVisible({ timeout: 5000 });
  });

  test("auto-generates a valid slug from event title when no custom slug is provided", async ({ page }) => {
    await loginAsTestUser(page);

    // Create event via the API without providing a custom slug
    const eventTitle = "E2E Test Auto Slug Generation";
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Use page.request to inherit authenticated session cookies
    const response = await page.request.post("/api/events", {
      data: {
        title: eventTitle,
        description: "Testing automatic slug generation",
        start_time: tomorrow.toISOString(),
        timezone: "America/New_York",
      },
    });

    expect(response.status()).toBe(201);

    const data = await response.json();

    // Verify the slug is present in the response
    expect(data.slug).toBeDefined();
    expect(typeof data.slug).toBe("string");

    // Verify the slug follows the expected format:
    // - lowercase
    // - contains base from title (e2e-test-auto-slug-generation or similar)
    // - ends with random suffix
    expect(data.slug).toMatch(/^[a-z0-9-]+$/); // Only lowercase letters, numbers, hyphens
    expect(data.slug).toContain("e2e-test-auto-slug"); // Contains base from title
    expect(data.slug.length).toBeGreaterThan(10); // Has some length (base + suffix)
    expect(data.slug.length).toBeLessThanOrEqual(45); // Within reasonable bounds (40 base + 1 hyphen + 4 suffix)

    // Verify the event can be accessed via the generated slug
    await page.goto(`/e/${data.slug}`);
    await expect(page.getByRole("heading", { name: eventTitle })).toBeVisible();
  });
});
