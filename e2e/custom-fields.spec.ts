import { test, expect } from "@playwright/test";
import {
  adminClient, ensureTestUser, seedEvent, seedGuest, seedCustomField,
  seedCustomFieldResponse, cleanupTestData, loginAsTestUser,
} from "./helpers";
import type { Event, Guest } from "../src/lib/types";

/**
 * Comprehensive E2E tests for custom event fields feature (US-009).
 * Tests: creation, RSVP display, guest responses, claim limits, dashboard, public page, editing.
 */

let testUserId: string;
let tablesExist = false;

async function customFieldsTablesExist(): Promise<boolean> {
  const supabase = adminClient();
  const { error } = await supabase.from("event_custom_fields").select("*").limit(0);
  return !error;
}

test.beforeAll(async () => {
  tablesExist = await customFieldsTablesExist();
  if (!tablesExist) {
    console.log("\n⚠️  Custom fields tables do not exist. Apply migration first.\n");
    return;
  }
  testUserId = await ensureTestUser();
});

test.afterAll(async () => { await cleanupTestData(); });

// Host can add text, poll, and signup fields during event creation
test.describe("Event Creation with Custom Fields", () => {
  test("host can add all field types and they are saved", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await loginAsTestUser(page);
    await page.goto("/create");

    const uniqueTitle = `E2E Test All Custom Fields ${Date.now()}`;
    await page.getByLabel(/Event Title/i).fill(uniqueTitle);
    await page.getByLabel(/Start Date/i).fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    await page.getByRole("button", { name: /Custom Questions/i }).click();

    // Add TEXT field
    await page.getByRole("button", { name: /Add a question/i }).click();
    await page.getByRole("button", { name: /Text Question/i }).click();
    const qInputs = page.locator('input[placeholder="e.g., What\'s your t-shirt size?"]');
    await qInputs.first().fill("Dietary restrictions?");

    // Add POLL field
    await page.getByRole("button", { name: /Add a question/i }).click();
    await page.getByRole("button", { name: /Poll/i }).click();
    await qInputs.nth(1).fill("Which date?");
    const optInputs = page.locator('input[placeholder^="Option"]');
    await optInputs.nth(0).fill("Friday");
    await optInputs.nth(1).fill("Saturday");

    // Add SIGNUP field
    await page.getByRole("button", { name: /Add a question/i }).click();
    await page.getByRole("button", { name: /Signup List/i }).click();
    await qInputs.nth(2).fill("Bring?");
    const itemInputs = page.locator('input[placeholder^="Item"]');
    await itemInputs.nth(0).fill("Salad");
    await itemInputs.nth(1).fill("Drinks");

    await page.getByRole("button", { name: /Create Event/i }).click();
    await page.waitForURL("**/dashboard/**", { timeout: 15000 });

    const supabase = adminClient();
    const { data: event } = await supabase.from("events").select("id").eq("title", uniqueTitle).single();
    const { data: fields } = await supabase.from("event_custom_fields").select("*").eq("event_id", event!.id).order("sort_order");
    expect(fields).toHaveLength(3);
    expect(fields!.map(f => f.type)).toEqual(["text", "poll", "signup"]);
  });
});

// Custom fields appear on RSVP form for going/maybe status
test.describe("RSVP Form Display", () => {
  let testEvent: Event, testGuest: Guest;

  test.beforeAll(async () => {
    if (!tablesExist) return;
    testEvent = (await seedEvent(testUserId, { title: "E2E RSVP Display", is_public: true })) as Event;
    await seedCustomField(testEvent.id, { type: "text", label: "Dietary", sort_order: 0 });
    await seedCustomField(testEvent.id, { type: "poll", label: "Date", options: ["Fri", "Sat"], sort_order: 1 });
    await seedCustomField(testEvent.id, { type: "signup", label: "Bring", options: ["A", "B"], config: { max_claims_per_item: 2 }, sort_order: 2 });
    testGuest = (await seedGuest(testEvent.id, { name: "Guest", email: "rsvp-d@shindig.test" })) as Guest;
  });

  test("fields appear when Going selected", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await page.goto(`/rsvp/${testGuest.rsvp_token}`);
    await expect(page.getByText("Dietary")).not.toBeVisible();
    await page.getByRole("button", { name: /Going/i }).click();
    await expect(page.getByText("Dietary")).toBeVisible();
    await expect(page.getByText("Date")).toBeVisible();
    await expect(page.getByText("Bring")).toBeVisible();
  });

  test("fields appear when Maybe selected", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await page.goto(`/rsvp/${testGuest.rsvp_token}`);
    await page.getByRole("button", { name: /Maybe/i }).click();
    await expect(page.getByText("Date")).toBeVisible();
  });

  test("fields hide when Can't selected", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await page.goto(`/rsvp/${testGuest.rsvp_token}`);
    await page.getByRole("button", { name: /Going/i }).click();
    await expect(page.getByText("Date")).toBeVisible();
    await page.getByRole("button", { name: /Can't/i }).click();
    await expect(page.getByText("Date")).not.toBeVisible();
  });
});

// Guest can submit responses for all three field types
test.describe("Guest Responses", () => {
  let testEvent: Event, testGuest: Guest, textId: string, pollId: string, signupId: string;

  test.beforeAll(async () => {
    if (!tablesExist) return;
    testEvent = (await seedEvent(testUserId, { title: "E2E Responses", is_public: true })) as Event;
    const tf = await seedCustomField(testEvent.id, { type: "text", label: "Diet", sort_order: 0 });
    textId = tf.id;
    const pf = await seedCustomField(testEvent.id, { type: "poll", label: "Date", options: ["Fri", "Sat"], required: true, sort_order: 1 });
    pollId = pf.id;
    const sf = await seedCustomField(testEvent.id, { type: "signup", label: "Bring", options: ["A", "B"], config: { max_claims_per_item: 2 }, sort_order: 2 });
    signupId = sf.id;
    testGuest = (await seedGuest(testEvent.id, { name: "RespGuest", email: "resp@shindig.test" })) as Guest;
  });

  test("guest submits all field types", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await page.goto(`/rsvp/${testGuest.rsvp_token}`);
    await page.getByRole("button", { name: /Going/i }).click();
    await page.getByPlaceholder("Your answer...").fill("No peanuts");
    await page.getByText("Sat").click();
    await page.getByText("B").click();
    await page.getByRole("button", { name: /Submit RSVP/i }).click();
    await expect(page.getByText(/You're in/i)).toBeVisible();

    const supabase = adminClient();
    const { data: resp } = await supabase.from("custom_field_responses").select("*").eq("guest_id", testGuest.id);
    expect(resp).toHaveLength(3);
    expect(resp!.find(r => r.field_id === textId)?.value).toBe("No peanuts");
    expect(resp!.find(r => r.field_id === pollId)?.value).toBe("Sat");
    expect(resp!.find(r => r.field_id === signupId)?.value).toBe("B");
  });
});

// Signup claim limits are enforced
test.describe("Claim Limits", () => {
  let testEvent: Event, signupId: string, g1: Guest, g2: Guest, g3: Guest;

  test.beforeAll(async () => {
    if (!tablesExist) return;
    testEvent = (await seedEvent(testUserId, { title: "E2E Claims", is_public: true })) as Event;
    const sf = await seedCustomField(testEvent.id, { type: "signup", label: "Items", options: ["A", "B"], config: { max_claims_per_item: 1 }, sort_order: 0 });
    signupId = sf.id;
    g1 = (await seedGuest(testEvent.id, { name: "G1", email: "c1@shindig.test" })) as Guest;
    g2 = (await seedGuest(testEvent.id, { name: "G2", email: "c2@shindig.test" })) as Guest;
    g3 = (await seedGuest(testEvent.id, { name: "G3", email: "c3@shindig.test" })) as Guest;
    await seedCustomFieldResponse(signupId, g1.id, "A");
    await adminClient().from("guests").update({ rsvp_status: "going" }).eq("id", g1.id);
  });

  test("fully claimed items disabled", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await page.goto(`/rsvp/${g2.rsvp_token}`);
    await page.getByRole("button", { name: /Going/i }).click();
    await expect(page.getByText("1/1 claimed")).toBeVisible();
    await expect(page.locator('input[type="checkbox"]').first()).toBeDisabled();
  });

  test("API rejects fully claimed item", async ({ request }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    const res = await request.post(`/api/rsvp/${g2.rsvp_token}`, {
      data: { rsvp_status: "going", custom_responses: [{ field_id: signupId, value: "A" }] },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).errors.custom_responses.some((e: string) => e.includes("fully claimed"))).toBe(true);
  });

  test("available items claimable", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await page.goto(`/rsvp/${g3.rsvp_token}`);
    await page.getByRole("button", { name: /Going/i }).click();
    await page.getByText("B").click();
    await page.getByRole("button", { name: /Submit RSVP/i }).click();
    await expect(page.getByText(/You're in/i)).toBeVisible();
  });
});

// Host sees custom field results on dashboard
test.describe("Dashboard Results", () => {
  let testEvent: Event;

  test.beforeAll(async () => {
    if (!tablesExist) return;
    testEvent = (await seedEvent(testUserId, { title: "E2E Dashboard", is_public: true })) as Event;
    const tf = await seedCustomField(testEvent.id, { type: "text", label: "Diet", sort_order: 0 });
    const pf = await seedCustomField(testEvent.id, { type: "poll", label: "Date", options: ["Fri", "Sat"], sort_order: 1 });
    const sf = await seedCustomField(testEvent.id, { type: "signup", label: "Bring", options: ["A", "B"], config: { max_claims_per_item: 2 }, sort_order: 2 });
    const g1 = (await seedGuest(testEvent.id, { name: "Alice", email: "alice-d@shindig.test", rsvp_status: "going" })) as Guest;
    const g2 = (await seedGuest(testEvent.id, { name: "Bob", email: "bob-d@shindig.test", rsvp_status: "going" })) as Guest;
    await seedCustomFieldResponse(tf.id, g1.id, "Veg");
    await seedCustomFieldResponse(tf.id, g2.id, "No nuts");
    await seedCustomFieldResponse(pf.id, g1.id, "Fri");
    await seedCustomFieldResponse(pf.id, g2.id, "Fri");
    await seedCustomFieldResponse(sf.id, g1.id, "A");
    await seedCustomFieldResponse(sf.id, g2.id, "A, B");
  });

  test("text results shown with names", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await loginAsTestUser(page);
    await page.goto(`/dashboard/${testEvent.id}`);
    await expect(page.getByText("Custom Field Results")).toBeVisible();
    await expect(page.getByText("Alice")).toBeVisible();
    await expect(page.getByText("Veg")).toBeVisible();
  });

  test("poll results with progress bars", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await loginAsTestUser(page);
    await page.goto(`/dashboard/${testEvent.id}`);
    await expect(page.getByText("2 votes (100%)")).toBeVisible();
    await expect(page.locator('[role="progressbar"]')).toHaveCount(2);
  });

  test("signup results with claimed names", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await loginAsTestUser(page);
    await page.goto(`/dashboard/${testEvent.id}`);
    await expect(page.getByRole("columnheader", { name: "Item" })).toBeVisible();
    await expect(page.getByText("Full")).toBeVisible();
  });
});

// Poll/signup visible on public page, text hidden
test.describe("Public Page", () => {
  let testEvent: Event;

  test.beforeAll(async () => {
    if (!tablesExist) return;
    testEvent = (await seedEvent(testUserId, { title: "E2E Public", is_public: true })) as Event;
    const pf = await seedCustomField(testEvent.id, { type: "poll", label: "Time", options: ["AM", "PM"], sort_order: 0 });
    const sf = await seedCustomField(testEvent.id, { type: "signup", label: "Tasks", options: ["X", "Y"], config: { max_claims_per_item: 3 }, sort_order: 1 });
    await seedCustomField(testEvent.id, { type: "text", label: "Private", sort_order: 2 });
    const g1 = (await seedGuest(testEvent.id, { name: "P1", email: "p1@shindig.test", rsvp_status: "going" })) as Guest;
    const g2 = (await seedGuest(testEvent.id, { name: "P2", email: "p2@shindig.test", rsvp_status: "going" })) as Guest;
    await seedCustomFieldResponse(pf.id, g1.id, "AM");
    await seedCustomFieldResponse(pf.id, g2.id, "PM");
    await seedCustomFieldResponse(sf.id, g1.id, "X");
    await seedCustomFieldResponse(sf.id, g2.id, "X, Y");
  });

  test("poll results visible", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await page.goto(`/e/${testEvent.slug}`);
    await expect(page.getByTestId("public-custom-fields")).toBeVisible();
    await expect(page.getByText("Time")).toBeVisible();
    await expect(page.getByText(/1 vote/)).toBeVisible();
  });

  test("signup availability shown", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await page.goto(`/e/${testEvent.slug}`);
    await expect(page.getByText("Tasks")).toBeVisible();
    await expect(page.getByText("1 of 3 available")).toBeVisible();
  });

  test("text field hidden", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await page.goto(`/e/${testEvent.slug}`);
    await expect(page.getByTestId("public-custom-fields")).toBeVisible();
    await expect(page.getByText("Private")).not.toBeVisible();
  });
});

// Custom fields editable and removable when editing event
test.describe("Event Editing", () => {
  test("modify existing fields", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    const userId = await loginAsTestUser(page);
    const event = await seedEvent(userId, { title: "E2E Edit" });
    await seedCustomField(event.id, { type: "text", label: "Original", sort_order: 0 });

    await page.goto(`/dashboard/${event.id}/edit`);
    const qInput = page.locator('input[placeholder="e.g., What\'s your t-shirt size?"]');
    await expect(qInput).toHaveValue("Original");
    await qInput.fill("Modified");
    await page.getByRole("button", { name: /Update Event/i }).click();
    await page.waitForURL(`**/dashboard/${event.id}`, { timeout: 15000 });

    const { data: fields } = await adminClient().from("event_custom_fields").select("*").eq("event_id", event.id);
    expect(fields![0].label).toBe("Modified");
  });

  test("delete fields", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    const userId = await loginAsTestUser(page);
    const event = await seedEvent(userId, { title: "E2E Delete" });
    await seedCustomField(event.id, { type: "poll", label: "ToDelete", options: ["A"], sort_order: 0 });

    await page.goto(`/dashboard/${event.id}/edit`);
    await page.getByRole("button", { name: /Remove question/i }).click();
    await page.getByRole("button", { name: /Update Event/i }).click();
    await page.waitForURL(`**/dashboard/${event.id}`, { timeout: 15000 });

    const { data: fields } = await adminClient().from("event_custom_fields").select("*").eq("event_id", event.id);
    expect(fields).toHaveLength(0);
  });

  test("add new fields", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    const userId = await loginAsTestUser(page);
    const event = await seedEvent(userId, { title: "E2E Add" });

    await page.goto(`/dashboard/${event.id}/edit`);
    await page.getByRole("button", { name: /Custom Questions/i }).click();
    await page.getByRole("button", { name: /Add a question/i }).click();
    await page.getByRole("button", { name: /Signup List/i }).click();
    await page.getByPlaceholder(/What's your t-shirt size/i).fill("NewField");
    await page.getByRole("button", { name: /Update Event/i }).click();
    await page.waitForURL(`**/dashboard/${event.id}`, { timeout: 15000 });

    const { data: fields } = await adminClient().from("event_custom_fields").select("*").eq("event_id", event.id);
    expect(fields).toHaveLength(1);
    expect(fields![0].label).toBe("NewField");
  });

  test("reorder fields", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    const userId = await loginAsTestUser(page);
    const event = await seedEvent(userId, { title: "E2E Reorder" });
    await seedCustomField(event.id, { type: "text", label: "First", sort_order: 0 });
    await seedCustomField(event.id, { type: "text", label: "Second", sort_order: 1 });

    await page.goto(`/dashboard/${event.id}/edit`);
    await page.getByTitle("Move down").first().click();
    await page.getByRole("button", { name: /Update Event/i }).click();
    await page.waitForURL(`**/dashboard/${event.id}`, { timeout: 15000 });

    const { data: fields } = await adminClient().from("event_custom_fields").select("*").eq("event_id", event.id).order("sort_order");
    expect(fields![0].label).toBe("Second");
    expect(fields![1].label).toBe("First");
  });
});
