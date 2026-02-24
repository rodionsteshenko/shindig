import { test, expect } from "@playwright/test";
import {
  ensureTestUser,
  loginAsTestUser,
  seedEvent,
  seedGuest,
  cleanupTestData,
  adminClient,
} from "./helpers";

/**
 * E2E tests for phone number validation and normalization (US-001)
 *
 * Tests:
 * - Phone numbers are normalized to E.164 format
 * - Invalid phone numbers are rejected
 * - CSV import with mixed valid/invalid phones
 * - Country code selector functionality
 */

let testUserId: string;

test.beforeAll(async () => {
  testUserId = await ensureTestUser();
});

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe("Phone Number Normalization", () => {
  test("normalizes US phone number to E.164 format", async ({ page }) => {
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Phone Normalize US" });

    // Add guest with various US phone formats
    const response = await page.request.post(`/api/events/manage/${event.id}/guests`, {
      data: {
        guests: [{ name: "US Phone Guest", phone: "(555) 123-4567" }],
        defaultCountry: "US",
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBe(1);
    // Phone should be normalized to E.164 format
    expect(body[0].phone).toBe("+15551234567");
  });

  test("normalizes phone with dots to E.164 format", async ({ page }) => {
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Phone Dots" });

    const response = await page.request.post(`/api/events/manage/${event.id}/guests`, {
      data: {
        guests: [{ name: "Dot Phone Guest", phone: "555.123.4567" }],
        defaultCountry: "US",
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body[0].phone).toBe("+15551234567");
  });

  test("normalizes phone with dashes to E.164 format", async ({ page }) => {
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Phone Dashes" });

    const response = await page.request.post(`/api/events/manage/${event.id}/guests`, {
      data: {
        guests: [{ name: "Dash Phone Guest", phone: "555-123-4567" }],
        defaultCountry: "US",
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body[0].phone).toBe("+15551234567");
  });

  test("preserves explicit country code", async ({ page }) => {
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Phone Explicit Country" });

    const response = await page.request.post(`/api/events/manage/${event.id}/guests`, {
      data: {
        guests: [{ name: "Explicit Country Guest", phone: "+44 20 7946 0958" }],
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    // UK phone should be normalized to E.164
    expect(body[0].phone).toBe("+442079460958");
  });

  test("uses provided default country code", async ({ page }) => {
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Phone Default Country" });

    const response = await page.request.post(`/api/events/manage/${event.id}/guests`, {
      data: {
        guests: [{ name: "Canadian Guest", phone: "416-555-1234" }],
        defaultCountry: "CA",
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    // Canadian phone should use +1 country code
    expect(body[0].phone).toBe("+14165551234");
  });
});

test.describe("Invalid Phone Rejection", () => {
  test("rejects phone number that is too short", async ({ page }) => {
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Phone Too Short" });

    const response = await page.request.post(`/api/events/manage/${event.id}/guests`, {
      data: {
        guests: [{ name: "Short Phone Guest", phone: "123" }],
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.errors).toBeDefined();
    expect(body.errors["guests[0].phone"]).toContain("phone");
  });

  test("rejects phone number with invalid characters", async ({ page }) => {
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Phone Invalid Chars" });

    const response = await page.request.post(`/api/events/manage/${event.id}/guests`, {
      data: {
        guests: [{ name: "Invalid Chars Guest", phone: "abc-def-ghij" }],
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.errors).toBeDefined();
    expect(body.errors["guests[0].phone"]).toContain("phone");
  });

  test("rejects obviously invalid phone number", async ({ page }) => {
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Phone Obviously Invalid" });

    const response = await page.request.post(`/api/events/manage/${event.id}/guests`, {
      data: {
        guests: [{ name: "Invalid Guest", phone: "000-000-0000" }],
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.errors).toBeDefined();
    expect(body.errors["guests[0].phone"]).toContain("phone");
  });

  test("allows guest with no phone (optional field)", async ({ page }) => {
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Phone Optional" });

    const response = await page.request.post(`/api/events/manage/${event.id}/guests`, {
      data: {
        guests: [{ name: "No Phone Guest", email: "nophone@shindig.test" }],
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body[0].name).toBe("No Phone Guest");
    expect(body[0].phone).toBeNull();
  });
});

test.describe("CSV Import with Phone Validation", () => {
  test("imports guests with valid phones from dashboard", async ({ page }) => {
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test CSV Import Valid" });

    // Navigate to dashboard
    await page.goto(`/dashboard/${event.id}`);
    await page.waitForLoadState("networkidle");

    // Switch to CSV mode
    await page.getByRole("button", { name: "Import CSV" }).click();

    // Enter valid CSV data
    const csvText = `name, email, phone
Jane Doe, jane@shindig.test, (555) 123-4567
John Smith, john@shindig.test, 555-987-6543`;

    await page.locator("textarea").fill(csvText);
    await page.getByRole("button", { name: "Import Guests" }).click();

    // Wait for import to complete
    await page.waitForResponse((response) =>
      response.url().includes("/guests") && response.status() === 201
    );

    // Verify guests were imported with normalized phones
    const supabase = adminClient();
    const { data: guests } = await supabase
      .from("guests")
      .select("*")
      .eq("event_id", event.id)
      .order("name");

    expect(guests).toBeDefined();
    expect(guests!.length).toBe(2);
    expect(guests![0].phone).toBe("+15551234567");
    expect(guests![1].phone).toBe("+15559876543");
  });

  test("shows warning for invalid phones in CSV", async ({ page }) => {
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test CSV Import Mixed" });

    // Navigate to dashboard
    await page.goto(`/dashboard/${event.id}`);
    await page.waitForLoadState("networkidle");

    // Switch to CSV mode
    await page.getByRole("button", { name: "Import CSV" }).click();

    // Enter CSV with mixed valid/invalid phones
    const csvText = `name, email, phone
Valid Guest, valid@shindig.test, (555) 123-4567
Invalid Guest, invalid@shindig.test, 123
Another Valid, another@shindig.test, 555-999-8888`;

    await page.locator("textarea").fill(csvText);
    await page.getByRole("button", { name: "Import Guests" }).click();

    // Should show warning about skipped row
    await expect(page.locator(".bg-yellow-50")).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".bg-yellow-50")).toContainText("skipped");

    // Wait for import to complete
    await page.waitForResponse((response) =>
      response.url().includes("/guests") && response.status() === 201
    );

    // Verify only valid guests were imported
    const supabase = adminClient();
    const { data: guests } = await supabase
      .from("guests")
      .select("*")
      .eq("event_id", event.id)
      .order("name");

    expect(guests).toBeDefined();
    expect(guests!.length).toBe(2); // Only 2 valid guests
    expect(guests!.find(g => g.name === "Invalid Guest")).toBeUndefined();
  });

  test("imports guests from CSV with international phones", async ({ page }) => {
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test CSV International" });

    // Navigate to dashboard
    await page.goto(`/dashboard/${event.id}`);
    await page.waitForLoadState("networkidle");

    // Switch to CSV mode
    await page.getByRole("button", { name: "Import CSV" }).click();

    // Enter CSV with international phone numbers
    const csvText = `name, email, phone
UK Guest, uk@shindig.test, +44 20 7946 0958
US Guest, us@shindig.test, +1 555-123-4567`;

    await page.locator("textarea").fill(csvText);
    await page.getByRole("button", { name: "Import Guests" }).click();

    // Wait for import
    await page.waitForResponse((response) =>
      response.url().includes("/guests") && response.status() === 201
    );

    // Verify phones are normalized
    const supabase = adminClient();
    const { data: guests } = await supabase
      .from("guests")
      .select("*")
      .eq("event_id", event.id)
      .order("name");

    expect(guests).toBeDefined();
    expect(guests!.length).toBe(2);
    expect(guests!.find(g => g.name === "UK Guest")!.phone).toBe("+442079460958");
    expect(guests!.find(g => g.name === "US Guest")!.phone).toBe("+15551234567");
  });
});

test.describe("Country Code Selector UI", () => {
  test("displays country code selector on guest form", async ({ page }) => {
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Country Selector" });

    await page.goto(`/dashboard/${event.id}`);
    await page.waitForLoadState("networkidle");

    // Check that country code selector is visible
    const countrySelect = page.locator("select[aria-label='Country code']");
    await expect(countrySelect).toBeVisible();

    // Check default value is US
    await expect(countrySelect).toHaveValue("US");

    // Check that it has multiple options
    const options = countrySelect.locator("option");
    expect(await options.count()).toBeGreaterThan(10);
  });

  test("allows changing country code", async ({ page }) => {
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test Change Country" });

    await page.goto(`/dashboard/${event.id}`);
    await page.waitForLoadState("networkidle");

    // Change country code to UK
    const countrySelect = page.locator("select[aria-label='Country code']");
    await countrySelect.selectOption("GB");

    // Enter a UK-format phone number
    await page.locator("input[type='tel']").fill("20 7946 0958");
    await page.locator("input[placeholder='Jane Doe']").fill("UK Test Guest");

    // Submit the form
    await page.getByRole("button", { name: "Add Guest" }).click();

    // Wait for submission
    await page.waitForResponse((response) =>
      response.url().includes("/guests") && response.status() === 201
    );

    // Verify phone was normalized with UK country code
    const supabase = adminClient();
    const { data: guests } = await supabase
      .from("guests")
      .select("*")
      .eq("event_id", event.id);

    expect(guests).toBeDefined();
    expect(guests!.length).toBe(1);
    expect(guests![0].phone).toBe("+442079460958");
  });
});

test.describe("V1 API Phone Normalization", () => {
  test("normalizes phone in V1 API POST", async ({ page }) => {
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test V1 API Phone" });

    const response = await page.request.post(`/api/v1/events/${event.id}/guests`, {
      data: {
        name: "V1 API Guest",
        phone: "(555) 123-4567",
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.phone).toBe("+15551234567");
  });

  test("rejects invalid phone in V1 API POST", async ({ page }) => {
    await loginAsTestUser(page);
    const event = await seedEvent(testUserId, { title: "E2E Test V1 API Invalid Phone" });

    const response = await page.request.post(`/api/v1/events/${event.id}/guests`, {
      data: {
        name: "Invalid V1 Guest",
        phone: "123",
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.errors.phone).toBeDefined();
  });
});
