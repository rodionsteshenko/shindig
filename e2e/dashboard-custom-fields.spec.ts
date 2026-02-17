import { test, expect } from "@playwright/test";
import { adminClient, ensureTestUser, seedEvent, seedGuest, cleanupTestData, loginAsTestUser } from "./helpers";
import type { Event, Guest } from "../src/lib/types";

/**
 * E2E tests for dashboard custom field results display (US-007).
 * Tests that hosts can see aggregated results for text, poll, and signup fields.
 */

let testUserId: string;
let testEvent: Event;
let tablesExist = false;
let textFieldId: string;
let pollFieldId: string;
let signupFieldId: string;

/**
 * Check if the custom fields tables exist.
 */
async function customFieldsTablesExist(): Promise<boolean> {
  const supabase = adminClient();
  const { error } = await supabase.from("event_custom_fields").select("*").limit(0);
  return !error;
}

test.beforeAll(async () => {
  tablesExist = await customFieldsTablesExist();
  if (!tablesExist) {
    console.log("\n  Custom fields tables do not exist yet.");
    console.log("   Apply migration via Supabase SQL Editor:");
    console.log("   File: supabase/migrations/20260217000000_custom_event_fields.sql\n");
    return;
  }

  const supabase = adminClient();
  testUserId = await ensureTestUser();

  // Create a test event
  testEvent = (await seedEvent(testUserId, {
    title: "E2E Test Dashboard Custom Fields",
    is_public: true,
  })) as Event;

  // Create custom fields for the event
  const { data: textField } = await supabase
    .from("event_custom_fields")
    .insert({
      event_id: testEvent.id,
      type: "text",
      label: "Dietary restrictions",
      description: "Any food allergies?",
      required: false,
      sort_order: 0,
    })
    .select()
    .single();
  textFieldId = textField!.id;

  const { data: pollField } = await supabase
    .from("event_custom_fields")
    .insert({
      event_id: testEvent.id,
      type: "poll",
      label: "Preferred date",
      description: "Which date works for you?",
      required: true,
      sort_order: 1,
      options: ["Friday", "Saturday", "Sunday"],
      config: { multi_select: false },
    })
    .select()
    .single();
  pollFieldId = pollField!.id;

  const { data: signupField } = await supabase
    .from("event_custom_fields")
    .insert({
      event_id: testEvent.id,
      type: "signup",
      label: "Bring to share",
      description: "Sign up to bring something",
      required: false,
      sort_order: 2,
      options: ["Salad", "Drinks", "Dessert"],
      config: { max_claims_per_item: 2 },
    })
    .select()
    .single();
  signupFieldId = signupField!.id;
});

test.afterAll(async () => {
  if (!tablesExist) return;
  const supabase = adminClient();

  // Clean up custom field responses and fields
  if (testEvent?.id) {
    // Get all field IDs for this event
    const { data: fields } = await supabase
      .from("event_custom_fields")
      .select("id")
      .eq("event_id", testEvent.id);
    const fieldIds = (fields ?? []).map((f) => f.id);

    if (fieldIds.length > 0) {
      await supabase.from("custom_field_responses").delete().in("field_id", fieldIds);
    }
    await supabase.from("event_custom_fields").delete().eq("event_id", testEvent.id);
  }

  await cleanupTestData();
});

test.describe("Dashboard Custom Field Results - No responses", () => {
  test("shows empty placeholders when no responses exist", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");

    await loginAsTestUser(page);
    await page.goto(`/dashboard/${testEvent.id}`);

    // Custom Field Results section should be visible
    await expect(page.getByText("Custom Field Results")).toBeVisible();

    // All field labels should be visible
    await expect(page.getByText("Dietary restrictions")).toBeVisible();
    await expect(page.getByText("Preferred date")).toBeVisible();
    await expect(page.getByText("Bring to share")).toBeVisible();

    // Should show placeholder messages
    await expect(page.getByText("No responses yet")).toBeVisible();
    await expect(page.getByText("No votes yet")).toBeVisible();
    await expect(page.getByText("No signups yet")).toBeVisible();
  });
});

test.describe("Dashboard Custom Field Results - With responses", () => {
  let guest1: Guest;
  let guest2: Guest;
  let guest3: Guest;

  test.beforeAll(async () => {
    if (!tablesExist) return;

    const supabase = adminClient();

    // Create guests with responses
    guest1 = (await seedGuest(testEvent.id, {
      name: "Alice Smith",
      email: "alice@shindig.test",
      rsvp_status: "going",
    })) as Guest;

    guest2 = (await seedGuest(testEvent.id, {
      name: "Bob Jones",
      email: "bob@shindig.test",
      rsvp_status: "going",
    })) as Guest;

    guest3 = (await seedGuest(testEvent.id, {
      name: "Carol Davis",
      email: "carol@shindig.test",
      rsvp_status: "going",
    })) as Guest;

    // Add text field responses
    await supabase.from("custom_field_responses").insert([
      { field_id: textFieldId, guest_id: guest1.id, value: "Vegetarian" },
      { field_id: textFieldId, guest_id: guest2.id, value: "No nuts please" },
    ]);

    // Add poll responses (2 for Friday, 1 for Saturday)
    await supabase.from("custom_field_responses").insert([
      { field_id: pollFieldId, guest_id: guest1.id, value: "Friday" },
      { field_id: pollFieldId, guest_id: guest2.id, value: "Friday" },
      { field_id: pollFieldId, guest_id: guest3.id, value: "Saturday" },
    ]);

    // Add signup responses
    await supabase.from("custom_field_responses").insert([
      { field_id: signupFieldId, guest_id: guest1.id, value: "Salad" },
      { field_id: signupFieldId, guest_id: guest2.id, value: "Salad, Drinks" },
    ]);
  });

  test.afterAll(async () => {
    if (!tablesExist) return;
    const supabase = adminClient();

    const guestIds = [guest1?.id, guest2?.id, guest3?.id].filter(Boolean);
    if (guestIds.length > 0) {
      await supabase.from("custom_field_responses").delete().in("guest_id", guestIds);
    }
  });

  test("shows text field results as table", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");

    await loginAsTestUser(page);
    await page.goto(`/dashboard/${testEvent.id}`);

    // Should show text responses in a table
    await expect(page.getByText("Alice Smith")).toBeVisible();
    await expect(page.getByText("Vegetarian")).toBeVisible();
    await expect(page.getByText("Bob Jones")).toBeVisible();
    await expect(page.getByText("No nuts please")).toBeVisible();
  });

  test("shows poll results with progress bars", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");

    await loginAsTestUser(page);
    await page.goto(`/dashboard/${testEvent.id}`);

    // Should show vote counts and percentages
    // Friday: 2 votes (67%), Saturday: 1 vote (33%), Sunday: 0 votes (0%)
    await expect(page.getByText("2 votes (67%)")).toBeVisible();
    await expect(page.getByText("1 vote (33%)")).toBeVisible();
    await expect(page.getByText("Total: 3 responses")).toBeVisible();

    // Check progress bars are rendered
    const progressBars = page.locator('[role="progressbar"]');
    await expect(progressBars).toHaveCount(3);
  });

  test("shows signup field results with claimed by names", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");

    await loginAsTestUser(page);
    await page.goto(`/dashboard/${testEvent.id}`);

    // Should show the signup table with columns
    await expect(page.getByRole("columnheader", { name: "Item" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Claimed By" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Spots Left" })).toBeVisible();

    // Salad: claimed by Alice and Bob (2/2 - Full)
    // Drinks: claimed by Bob (1/2)
    // Dessert: unclaimed
    await expect(page.getByText("Alice Smith, Bob Jones")).toBeVisible();
  });

  test("shows spots left correctly for signup items", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");

    await loginAsTestUser(page);
    await page.goto(`/dashboard/${testEvent.id}`);

    // Salad has 2 claims with max 2 - should show "Full"
    await expect(page.getByText("Full")).toBeVisible();

    // Drinks has 1 claim with max 2 - should show "1 / 2"
    await expect(page.getByText("1 / 2")).toBeVisible();
  });
});

test.describe("Dashboard Custom Field Results - No custom fields", () => {
  let eventWithoutFields: Event;

  test.beforeAll(async () => {
    if (!tablesExist) return;
    eventWithoutFields = (await seedEvent(testUserId, {
      title: "E2E Test Event No Custom Fields",
      is_public: true,
    })) as Event;
  });

  test.afterAll(async () => {
    if (!tablesExist) return;
    // Event will be cleaned up by cleanupTestData
  });

  test("does not show Custom Field Results section when event has no custom fields", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");

    await loginAsTestUser(page);
    await page.goto(`/dashboard/${eventWithoutFields.id}`);

    // Custom Field Results section should NOT be visible
    await expect(page.getByText("Custom Field Results")).not.toBeVisible();

    // Other sections should still be visible
    await expect(page.getByText("RSVP Summary")).toBeVisible();
    await expect(page.getByText("Guest List")).toBeVisible();
  });
});

test.describe("Dashboard Custom Field Results - Multi-select poll", () => {
  let multiPollEvent: Event;
  let multiPollFieldId: string;
  let multiGuest: Guest;

  test.beforeAll(async () => {
    if (!tablesExist) return;

    const supabase = adminClient();

    multiPollEvent = (await seedEvent(testUserId, {
      title: "E2E Test Multi-Select Poll",
      is_public: true,
    })) as Event;

    // Create a multi-select poll
    const { data: multiPollField } = await supabase
      .from("event_custom_fields")
      .insert({
        event_id: multiPollEvent.id,
        type: "poll",
        label: "Which activities interest you?",
        sort_order: 0,
        options: ["Hiking", "Swimming", "BBQ"],
        config: { multi_select: true },
      })
      .select()
      .single();
    multiPollFieldId = multiPollField!.id;

    // Create a guest with multi-select response
    multiGuest = (await seedGuest(multiPollEvent.id, {
      name: "Multi Guest",
      email: "multi@shindig.test",
      rsvp_status: "going",
    })) as Guest;

    // Add multi-select response (comma-separated)
    await supabase.from("custom_field_responses").insert({
      field_id: multiPollFieldId,
      guest_id: multiGuest.id,
      value: "Hiking, Swimming",
    });
  });

  test.afterAll(async () => {
    if (!tablesExist) return;
    const supabase = adminClient();

    if (multiGuest?.id) {
      await supabase.from("custom_field_responses").delete().eq("guest_id", multiGuest.id);
    }
    if (multiPollFieldId) {
      await supabase.from("event_custom_fields").delete().eq("id", multiPollFieldId);
    }
  });

  test("shows multi-select poll results with indicator", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");

    await loginAsTestUser(page);
    await page.goto(`/dashboard/${multiPollEvent.id}`);

    // Should show the multi-select indicator
    await expect(page.getByText("(multi-select)")).toBeVisible();

    // Both Hiking and Swimming should have 1 vote each (50%)
    await expect(page.getByText("Hiking")).toBeVisible();
    await expect(page.getByText("Swimming")).toBeVisible();
  });
});
