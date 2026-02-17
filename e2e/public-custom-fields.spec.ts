import { test, expect } from "@playwright/test";
import { adminClient, ensureTestUser, seedEvent, seedGuest, cleanupTestData } from "./helpers";
import type { Event, Guest } from "../src/lib/types";

/**
 * E2E tests for public event page custom fields display (US-008).
 * Tests that poll results and signup status are visible on public event pages.
 * Text field responses are NOT shown (those are private to the host).
 */

let testUserId: string;
let tablesExist = false;

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
    console.log("\n⚠️  Custom fields tables do not exist yet.");
    console.log("   Apply migration via Supabase SQL Editor:");
    console.log("   File: supabase/migrations/20260217000000_custom_event_fields.sql\n");
    return;
  }
  testUserId = await ensureTestUser();
});

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe("Public Custom Fields API - GET /api/events/[slug]/custom-fields", () => {
  let apiTestEvent: Event;
  let pollFieldId: string;
  let signupFieldId: string;
  let textFieldId: string;
  let apiGuest1: Guest;
  let apiGuest2: Guest;

  test.beforeAll(async () => {
    if (!tablesExist) return;

    const supabase = adminClient();

    // Create an event with custom fields
    apiTestEvent = (await seedEvent(testUserId, {
      title: "E2E Test Public Custom Fields API",
      is_public: true,
    })) as Event;

    // Create a text field (should NOT be returned by API)
    const { data: textField } = await supabase
      .from("event_custom_fields")
      .insert({
        event_id: apiTestEvent.id,
        type: "text",
        label: "Secret Text Field",
        sort_order: 0,
      })
      .select()
      .single();
    textFieldId = textField!.id;

    // Create a poll field
    const { data: pollField } = await supabase
      .from("event_custom_fields")
      .insert({
        event_id: apiTestEvent.id,
        type: "poll",
        label: "Which date?",
        description: "Vote for your preferred date",
        sort_order: 1,
        options: ["Friday", "Saturday", "Sunday"],
        config: { multi_select: false },
      })
      .select()
      .single();
    pollFieldId = pollField!.id;

    // Create a signup field
    const { data: signupField } = await supabase
      .from("event_custom_fields")
      .insert({
        event_id: apiTestEvent.id,
        type: "signup",
        label: "Bring to share",
        description: "Sign up to bring something",
        sort_order: 2,
        options: ["Salad", "Drinks", "Dessert"],
        config: { max_claims_per_item: 2 },
      })
      .select()
      .single();
    signupFieldId = signupField!.id;

    // Create guests with responses
    apiGuest1 = (await seedGuest(apiTestEvent.id, {
      name: "API Guest 1",
      email: "api-guest-1@shindig.test",
      rsvp_status: "going",
    })) as Guest;

    apiGuest2 = (await seedGuest(apiTestEvent.id, {
      name: "API Guest 2",
      email: "api-guest-2@shindig.test",
      rsvp_status: "going",
    })) as Guest;

    // Add text field response (should not appear in API response)
    await supabase.from("custom_field_responses").insert({
      field_id: textFieldId,
      guest_id: apiGuest1.id,
      value: "This is private",
    });

    // Add poll responses
    await supabase.from("custom_field_responses").insert([
      { field_id: pollFieldId, guest_id: apiGuest1.id, value: "Friday" },
      { field_id: pollFieldId, guest_id: apiGuest2.id, value: "Friday" },
    ]);

    // Add signup responses
    await supabase.from("custom_field_responses").insert([
      { field_id: signupFieldId, guest_id: apiGuest1.id, value: "Salad" },
      { field_id: signupFieldId, guest_id: apiGuest2.id, value: "Salad, Drinks" },
    ]);
  });

  test.afterAll(async () => {
    if (!tablesExist) return;
    const supabase = adminClient();

    // Clean up responses
    const guestIds = [apiGuest1?.id, apiGuest2?.id].filter(Boolean);
    if (guestIds.length > 0) {
      await supabase.from("custom_field_responses").delete().in("guest_id", guestIds);
    }

    // Clean up custom fields
    if (apiTestEvent?.id) {
      await supabase.from("event_custom_fields").delete().eq("event_id", apiTestEvent.id);
    }
  });

  test("returns 404 for non-existent event", async ({ request }) => {
    test.skip(!tablesExist, "Migration not applied yet");

    const res = await request.get("/api/events/non-existent-slug/custom-fields");
    expect(res.status()).toBe(404);
  });

  test("returns polls and signups but NOT text fields", async ({ request }) => {
    test.skip(!tablesExist, "Migration not applied yet");

    const res = await request.get(`/api/events/${apiTestEvent.slug}/custom-fields`);
    expect(res.status()).toBe(200);

    const data = await res.json();
    expect(data.polls).toBeDefined();
    expect(data.signups).toBeDefined();

    // Should have 1 poll and 1 signup, NO text fields
    expect(data.polls.length).toBe(1);
    expect(data.signups.length).toBe(1);

    // Verify poll data structure
    const poll = data.polls[0];
    expect(poll.field_id).toBe(pollFieldId);
    expect(poll.label).toBe("Which date?");
    expect(poll.options).toEqual(["Friday", "Saturday", "Sunday"]);
    expect(poll.votes.Friday).toBe(2);
    expect(poll.votes.Saturday).toBe(0);
    expect(poll.total_votes).toBe(2);

    // Verify signup data structure
    const signup = data.signups[0];
    expect(signup.field_id).toBe(signupFieldId);
    expect(signup.label).toBe("Bring to share");
    expect(signup.max_claims_per_item).toBe(2);
    expect(signup.claims.Salad).toBe(2);
    expect(signup.claims.Drinks).toBe(1);
    expect(signup.claims.Dessert).toBe(0);
  });

  test("returns empty arrays for event without custom fields", async ({ request }) => {
    test.skip(!tablesExist, "Migration not applied yet");

    // Create an event without custom fields
    const emptyEvent = (await seedEvent(testUserId, {
      title: "E2E Test No Custom Fields",
      is_public: true,
    })) as Event;

    const res = await request.get(`/api/events/${emptyEvent.slug}/custom-fields`);
    expect(res.status()).toBe(200);

    const data = await res.json();
    expect(data.polls).toEqual([]);
    expect(data.signups).toEqual([]);
  });
});

test.describe("Public Event Page - Custom Fields UI", () => {
  let uiTestEvent: Event;
  let pollFieldId: string;
  let signupFieldId: string;
  let uiGuest1: Guest;
  let uiGuest2: Guest;

  test.beforeAll(async () => {
    if (!tablesExist) return;

    const supabase = adminClient();

    // Create an event with custom fields
    uiTestEvent = (await seedEvent(testUserId, {
      title: "E2E Test Public Custom Fields UI",
      description: "Event with poll and signup fields",
      is_public: true,
    })) as Event;

    // Create a poll field
    const { data: pollField } = await supabase
      .from("event_custom_fields")
      .insert({
        event_id: uiTestEvent.id,
        type: "poll",
        label: "Preferred time",
        description: "What time works best?",
        sort_order: 0,
        options: ["Morning", "Afternoon", "Evening"],
        config: { multi_select: false },
      })
      .select()
      .single();
    pollFieldId = pollField!.id;

    // Create a signup field
    const { data: signupField } = await supabase
      .from("event_custom_fields")
      .insert({
        event_id: uiTestEvent.id,
        type: "signup",
        label: "Volunteer tasks",
        description: "Help out!",
        sort_order: 1,
        options: ["Setup", "Cleanup", "Greeting"],
        config: { max_claims_per_item: 3 },
      })
      .select()
      .single();
    signupFieldId = signupField!.id;

    // Create guests with responses
    uiGuest1 = (await seedGuest(uiTestEvent.id, {
      name: "UI Guest 1",
      email: "ui-guest-1@shindig.test",
      rsvp_status: "going",
    })) as Guest;

    uiGuest2 = (await seedGuest(uiTestEvent.id, {
      name: "UI Guest 2",
      email: "ui-guest-2@shindig.test",
      rsvp_status: "going",
    })) as Guest;

    // Add poll responses (2 for Morning, 1 for Afternoon)
    await supabase.from("custom_field_responses").insert([
      { field_id: pollFieldId, guest_id: uiGuest1.id, value: "Morning" },
      { field_id: pollFieldId, guest_id: uiGuest2.id, value: "Afternoon" },
    ]);

    // Add signup responses
    await supabase.from("custom_field_responses").insert([
      { field_id: signupFieldId, guest_id: uiGuest1.id, value: "Setup" },
      { field_id: signupFieldId, guest_id: uiGuest2.id, value: "Setup, Cleanup" },
    ]);
  });

  test.afterAll(async () => {
    if (!tablesExist) return;
    const supabase = adminClient();

    // Clean up responses
    const guestIds = [uiGuest1?.id, uiGuest2?.id].filter(Boolean);
    if (guestIds.length > 0) {
      await supabase.from("custom_field_responses").delete().in("guest_id", guestIds);
    }

    // Clean up custom fields
    if (uiTestEvent?.id) {
      await supabase.from("event_custom_fields").delete().eq("event_id", uiTestEvent.id);
    }
  });

  test("shows poll results with progress bars", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");

    await page.goto(`/e/${uiTestEvent.slug}`);

    // Wait for custom fields section to load
    await expect(page.getByTestId("public-custom-fields")).toBeVisible();

    // Poll label should be visible
    await expect(page.getByText("Preferred time")).toBeVisible();

    // Poll options should show vote counts
    await expect(page.getByText("Morning")).toBeVisible();
    await expect(page.getByText("Afternoon")).toBeVisible();
    await expect(page.getByText("Evening")).toBeVisible();

    // Vote counts should be visible
    await expect(page.getByText(/1 vote/)).toBeVisible();

    // Progress bars should be rendered
    const progressBars = page.locator('[role="progressbar"]');
    await expect(progressBars).toHaveCount(3);
  });

  test("shows signup status with availability", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");

    await page.goto(`/e/${uiTestEvent.slug}`);

    // Wait for custom fields section to load
    await expect(page.getByTestId("public-custom-fields")).toBeVisible();

    // Signup label should be visible
    await expect(page.getByText("Volunteer tasks")).toBeVisible();

    // Signup options should show availability
    await expect(page.getByText("Setup")).toBeVisible();
    await expect(page.getByText("Cleanup")).toBeVisible();
    await expect(page.getByText("Greeting")).toBeVisible();

    // Should show availability counts
    // Setup: 2 claimed out of 3 = 1 available
    await expect(page.getByText("1 of 3 available")).toBeVisible();
    // Cleanup: 1 claimed out of 3 = 2 available
    await expect(page.getByText("2 of 3 available")).toBeVisible();
    // Greeting: 0 claimed out of 3 = 3 available
    await expect(page.getByText("3 of 3 available")).toBeVisible();
  });

  test("does not show text field responses", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");

    // Add a text field to the event
    const supabase = adminClient();
    await supabase.from("event_custom_fields").insert({
      event_id: uiTestEvent.id,
      type: "text",
      label: "Private text field",
      sort_order: 10,
    });

    await page.goto(`/e/${uiTestEvent.slug}`);
    await expect(page.getByTestId("public-custom-fields")).toBeVisible();

    // Text field label should NOT be visible
    await expect(page.getByText("Private text field")).not.toBeVisible();
  });
});

test.describe("Public Event Page - No custom fields", () => {
  let emptyEvent: Event;

  test.beforeAll(async () => {
    if (!tablesExist) return;

    emptyEvent = (await seedEvent(testUserId, {
      title: "E2E Test Event No Fields",
      description: "Event without custom fields",
      is_public: true,
    })) as Event;
  });

  test("does not show custom fields section when no fields exist", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");

    await page.goto(`/e/${emptyEvent.slug}`);

    // Event title should be visible
    await expect(page.getByRole("heading", { name: emptyEvent.title })).toBeVisible();

    // Custom fields section should NOT be visible
    await expect(page.getByTestId("public-custom-fields")).not.toBeVisible();
  });
});

test.describe("Public Event Page - Empty poll results", () => {
  let emptyPollEvent: Event;

  test.beforeAll(async () => {
    if (!tablesExist) return;

    const supabase = adminClient();

    emptyPollEvent = (await seedEvent(testUserId, {
      title: "E2E Test Empty Poll",
      is_public: true,
    })) as Event;

    // Create a poll field with no responses
    await supabase.from("event_custom_fields").insert({
      event_id: emptyPollEvent.id,
      type: "poll",
      label: "Empty poll",
      sort_order: 0,
      options: ["Option A", "Option B"],
      config: { multi_select: false },
    });
  });

  test.afterAll(async () => {
    if (!tablesExist) return;
    const supabase = adminClient();
    if (emptyPollEvent?.id) {
      await supabase.from("event_custom_fields").delete().eq("event_id", emptyPollEvent.id);
    }
  });

  test("shows 'No votes yet' for poll with no responses", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");

    await page.goto(`/e/${emptyPollEvent.slug}`);

    // Custom fields section should be visible (has a poll)
    await expect(page.getByTestId("public-custom-fields")).toBeVisible();

    // Should show "No votes yet"
    await expect(page.getByText("No votes yet")).toBeVisible();
  });
});

test.describe("Public Event Page - Empty signup results", () => {
  let emptySignupEvent: Event;

  test.beforeAll(async () => {
    if (!tablesExist) return;

    const supabase = adminClient();

    emptySignupEvent = (await seedEvent(testUserId, {
      title: "E2E Test Empty Signup",
      is_public: true,
    })) as Event;

    // Create a signup field with no responses
    await supabase.from("event_custom_fields").insert({
      event_id: emptySignupEvent.id,
      type: "signup",
      label: "Empty signup",
      sort_order: 0,
      options: ["Task A", "Task B"],
      config: { max_claims_per_item: 2 },
    });
  });

  test.afterAll(async () => {
    if (!tablesExist) return;
    const supabase = adminClient();
    if (emptySignupEvent?.id) {
      await supabase.from("event_custom_fields").delete().eq("event_id", emptySignupEvent.id);
    }
  });

  test("shows 'No signups yet' for signup with no responses", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");

    await page.goto(`/e/${emptySignupEvent.slug}`);

    // Custom fields section should be visible (has a signup)
    await expect(page.getByTestId("public-custom-fields")).toBeVisible();

    // Should show "No signups yet"
    await expect(page.getByText("No signups yet")).toBeVisible();
  });
});

test.describe("Public Event Page - Multi-select poll", () => {
  let multiSelectEvent: Event;
  let multiGuest: Guest;

  test.beforeAll(async () => {
    if (!tablesExist) return;

    const supabase = adminClient();

    multiSelectEvent = (await seedEvent(testUserId, {
      title: "E2E Test Multi-Select Poll",
      is_public: true,
    })) as Event;

    // Create a multi-select poll
    const { data: pollField } = await supabase
      .from("event_custom_fields")
      .insert({
        event_id: multiSelectEvent.id,
        type: "poll",
        label: "Select activities",
        sort_order: 0,
        options: ["Hiking", "Swimming", "BBQ"],
        config: { multi_select: true },
      })
      .select()
      .single();

    // Create guest with multi-select response
    multiGuest = (await seedGuest(multiSelectEvent.id, {
      name: "Multi Guest",
      email: "multi-guest@shindig.test",
      rsvp_status: "going",
    })) as Guest;

    // Add multi-select response (comma-separated)
    await supabase.from("custom_field_responses").insert({
      field_id: pollField!.id,
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
    if (multiSelectEvent?.id) {
      await supabase.from("event_custom_fields").delete().eq("event_id", multiSelectEvent.id);
    }
  });

  test("shows multi-select indicator for multi-select polls", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");

    await page.goto(`/e/${multiSelectEvent.slug}`);

    await expect(page.getByTestId("public-custom-fields")).toBeVisible();

    // Should show the multi-select indicator
    await expect(page.getByText("(multi-select)")).toBeVisible();

    // Both Hiking and Swimming should have 1 vote each
    await expect(page.getByText("Hiking")).toBeVisible();
    await expect(page.getByText("Swimming")).toBeVisible();
  });
});

test.describe("Public Event Page - Full signup item", () => {
  let fullSignupEvent: Event;
  let guest1: Guest;
  let guest2: Guest;

  test.beforeAll(async () => {
    if (!tablesExist) return;

    const supabase = adminClient();

    fullSignupEvent = (await seedEvent(testUserId, {
      title: "E2E Test Full Signup",
      is_public: true,
    })) as Event;

    // Create a signup field with max 2 claims
    const { data: signupField } = await supabase
      .from("event_custom_fields")
      .insert({
        event_id: fullSignupEvent.id,
        type: "signup",
        label: "Limited items",
        sort_order: 0,
        options: ["Limited Item", "Available Item"],
        config: { max_claims_per_item: 2 },
      })
      .select()
      .single();

    // Create 2 guests who both claim the limited item
    guest1 = (await seedGuest(fullSignupEvent.id, {
      name: "Full Guest 1",
      email: "full-guest-1@shindig.test",
    })) as Guest;

    guest2 = (await seedGuest(fullSignupEvent.id, {
      name: "Full Guest 2",
      email: "full-guest-2@shindig.test",
    })) as Guest;

    await supabase.from("custom_field_responses").insert([
      { field_id: signupField!.id, guest_id: guest1.id, value: "Limited Item" },
      { field_id: signupField!.id, guest_id: guest2.id, value: "Limited Item" },
    ]);
  });

  test.afterAll(async () => {
    if (!tablesExist) return;
    const supabase = adminClient();

    const guestIds = [guest1?.id, guest2?.id].filter(Boolean);
    if (guestIds.length > 0) {
      await supabase.from("custom_field_responses").delete().in("guest_id", guestIds);
    }
    if (fullSignupEvent?.id) {
      await supabase.from("event_custom_fields").delete().eq("event_id", fullSignupEvent.id);
    }
  });

  test("shows 'Full' badge for fully claimed items", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");

    await page.goto(`/e/${fullSignupEvent.slug}`);

    await expect(page.getByTestId("public-custom-fields")).toBeVisible();

    // Limited Item should show "Full"
    await expect(page.getByText("Full")).toBeVisible();

    // Available Item should show availability
    await expect(page.getByText("2 of 2 available")).toBeVisible();
  });
});
