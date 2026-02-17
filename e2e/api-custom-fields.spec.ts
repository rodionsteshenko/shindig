import { test, expect } from "@playwright/test";
import { ensureTestUser, seedEvent, loginAsTestUser, cleanupTestData, adminClient } from "./helpers";
import type { Event } from "../src/lib/types";

let testUserId: string;
let testEvent: Event;
let tablesExist: boolean;

/**
 * Check if the custom fields tables exist.
 * Migration must be applied via Supabase SQL Editor first.
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
    console.log("   File: supabase/migrations/20260217000000_custom_event_fields.sql");
    console.log("   URL: https://supabase.com/dashboard/project/jppvvoyvsxuqwluxacfu/sql/new\n");
    return;
  }
  testUserId = await ensureTestUser();
});

test.beforeEach(async () => {
  if (!tablesExist) return;
  // Create a fresh event for each test
  testEvent = await seedEvent(testUserId, {
    title: "E2E Test Event with Custom Fields",
    is_public: true,
  }) as Event;
});

test.afterAll(async () => {
  if (!tablesExist) return;
  await cleanupTestData();
});

test.describe("Custom Fields API - Event Creation", () => {
  test("POST /api/events accepts custom_fields array", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await loginAsTestUser(page);

    const response = await page.request.post("/api/events", {
      data: {
        title: "E2E Test Event with Fields",
        start_time: new Date(Date.now() + 86400000).toISOString(),
        timezone: "America/New_York",
        custom_fields: [
          { type: "text", label: "Dietary restrictions?" },
          { type: "poll", label: "Which day?", options: ["Saturday", "Sunday"] },
        ],
      },
    });

    expect(response.status()).toBe(201);
    const event = await response.json();
    expect(event.id).toBeDefined();

    // Verify fields were inserted
    const supabase = adminClient();
    const { data: fields } = await supabase
      .from("event_custom_fields")
      .select("*")
      .eq("event_id", event.id)
      .order("sort_order");

    expect(fields).toHaveLength(2);
    expect(fields?.[0].type).toBe("text");
    expect(fields?.[0].label).toBe("Dietary restrictions?");
    expect(fields?.[1].type).toBe("poll");
    expect(fields?.[1].label).toBe("Which day?");
    expect(fields?.[1].options).toEqual(["Saturday", "Sunday"]);

    // Cleanup
    await supabase.from("events").delete().eq("id", event.id);
  });

  test("POST /api/events rejects invalid custom_fields", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await loginAsTestUser(page);

    const response = await page.request.post("/api/events", {
      data: {
        title: "E2E Test Invalid Fields",
        start_time: new Date(Date.now() + 86400000).toISOString(),
        timezone: "America/New_York",
        custom_fields: [
          { type: "invalid", label: "Bad type" }, // invalid type
        ],
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.errors.custom_fields).toBeDefined();
  });

  test("POST /api/events rejects poll without options", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await loginAsTestUser(page);

    const response = await page.request.post("/api/events", {
      data: {
        title: "E2E Test Poll No Options",
        start_time: new Date(Date.now() + 86400000).toISOString(),
        timezone: "America/New_York",
        custom_fields: [
          { type: "poll", label: "Missing options" },
        ],
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.errors.custom_fields).toBeDefined();
  });

  test("POST /api/events works without custom_fields", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await loginAsTestUser(page);

    const response = await page.request.post("/api/events", {
      data: {
        title: "E2E Test No Custom Fields",
        start_time: new Date(Date.now() + 86400000).toISOString(),
        timezone: "America/New_York",
      },
    });

    expect(response.status()).toBe(201);
    const event = await response.json();

    // Cleanup
    const supabase = adminClient();
    await supabase.from("events").delete().eq("id", event.id);
  });
});

test.describe("Custom Fields API - Event Update", () => {
  test("PUT /api/events/manage/[id] adds new custom fields", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await loginAsTestUser(page);

    const response = await page.request.put(`/api/events/manage/${testEvent.id}`, {
      data: {
        title: testEvent.title,
        start_time: testEvent.start_time,
        timezone: testEvent.timezone,
        custom_fields: [
          { type: "text", label: "New text field" },
        ],
      },
    });

    expect(response.status()).toBe(200);

    // Verify field was inserted
    const supabase = adminClient();
    const { data: fields } = await supabase
      .from("event_custom_fields")
      .select("*")
      .eq("event_id", testEvent.id);

    expect(fields).toHaveLength(1);
    expect(fields?.[0].label).toBe("New text field");
  });

  test("PUT /api/events/manage/[id] updates existing fields", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await loginAsTestUser(page);

    // First add a field
    const supabase = adminClient();
    const { data: inserted } = await supabase
      .from("event_custom_fields")
      .insert({
        event_id: testEvent.id,
        type: "text",
        label: "Original label",
        sort_order: 0,
      })
      .select()
      .single();

    // Update via API
    const response = await page.request.put(`/api/events/manage/${testEvent.id}`, {
      data: {
        title: testEvent.title,
        start_time: testEvent.start_time,
        timezone: testEvent.timezone,
        custom_fields: [
          { id: inserted!.id, type: "text", label: "Updated label" },
        ],
      },
    });

    expect(response.status()).toBe(200);

    // Verify field was updated
    const { data: fields } = await supabase
      .from("event_custom_fields")
      .select("*")
      .eq("event_id", testEvent.id);

    expect(fields).toHaveLength(1);
    expect(fields?.[0].label).toBe("Updated label");
    expect(fields?.[0].id).toBe(inserted!.id);
  });

  test("PUT /api/events/manage/[id] deletes removed fields", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await loginAsTestUser(page);

    // Add two fields
    const supabase = adminClient();
    const { data: field1 } = await supabase
      .from("event_custom_fields")
      .insert({
        event_id: testEvent.id,
        type: "text",
        label: "Field to keep",
        sort_order: 0,
      })
      .select()
      .single();

    await supabase
      .from("event_custom_fields")
      .insert({
        event_id: testEvent.id,
        type: "text",
        label: "Field to delete",
        sort_order: 1,
      });

    // Update with only one field
    const response = await page.request.put(`/api/events/manage/${testEvent.id}`, {
      data: {
        title: testEvent.title,
        start_time: testEvent.start_time,
        timezone: testEvent.timezone,
        custom_fields: [
          { id: field1!.id, type: "text", label: "Field to keep" },
        ],
      },
    });

    expect(response.status()).toBe(200);

    // Verify only one field remains
    const { data: fields } = await supabase
      .from("event_custom_fields")
      .select("*")
      .eq("event_id", testEvent.id);

    expect(fields).toHaveLength(1);
    expect(fields?.[0].label).toBe("Field to keep");
  });

  test("PUT /api/events/manage/[id] rejects invalid fields", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await loginAsTestUser(page);

    const response = await page.request.put(`/api/events/manage/${testEvent.id}`, {
      data: {
        title: testEvent.title,
        start_time: testEvent.start_time,
        timezone: testEvent.timezone,
        custom_fields: [
          { type: "poll", label: "No options" }, // invalid - poll needs options
        ],
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.errors.custom_fields).toBeDefined();
  });

  test("PUT /api/events/manage/[id] preserves fields when not in request", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await loginAsTestUser(page);

    // Add a field first
    const supabase = adminClient();
    await supabase
      .from("event_custom_fields")
      .insert({
        event_id: testEvent.id,
        type: "text",
        label: "Should persist",
        sort_order: 0,
      });

    // Update event without custom_fields in body
    const response = await page.request.put(`/api/events/manage/${testEvent.id}`, {
      data: {
        title: "Updated Title",
        start_time: testEvent.start_time,
        timezone: testEvent.timezone,
        // No custom_fields key at all
      },
    });

    expect(response.status()).toBe(200);

    // Field should still exist
    const { data: fields } = await supabase
      .from("event_custom_fields")
      .select("*")
      .eq("event_id", testEvent.id);

    expect(fields).toHaveLength(1);
    expect(fields?.[0].label).toBe("Should persist");
  });
});

test.describe("Custom Fields API - Event Read", () => {
  test("GET /api/events/manage/[id] returns event with custom_fields", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await loginAsTestUser(page);

    // Add some fields
    const supabase = adminClient();
    await supabase.from("event_custom_fields").insert([
      {
        event_id: testEvent.id,
        type: "text",
        label: "Question 1",
        required: true,
        sort_order: 0,
      },
      {
        event_id: testEvent.id,
        type: "poll",
        label: "Poll 1",
        options: ["Option A", "Option B"],
        sort_order: 1,
      },
    ]);

    const response = await page.request.get(`/api/events/manage/${testEvent.id}`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.id).toBe(testEvent.id);
    expect(data.custom_fields).toHaveLength(2);
    expect(data.custom_fields[0].label).toBe("Question 1");
    expect(data.custom_fields[0].required).toBe(true);
    expect(data.custom_fields[1].label).toBe("Poll 1");
    expect(data.custom_fields[1].options).toEqual(["Option A", "Option B"]);
  });

  test("GET /api/events/manage/[id] returns empty array when no fields", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await loginAsTestUser(page);

    const response = await page.request.get(`/api/events/manage/${testEvent.id}`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.custom_fields).toEqual([]);
  });

  test("GET /api/events/manage/[id] requires authentication", async ({ request }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    const response = await request.get(`/api/events/manage/${testEvent?.id || "dummy"}`);
    expect(response.status()).toBe(401);
  });

  test("GET /api/events/manage/[id] returns fields in sort_order", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await loginAsTestUser(page);

    // Add fields in reverse order
    const supabase = adminClient();
    await supabase.from("event_custom_fields").insert([
      { event_id: testEvent.id, type: "text", label: "Third", sort_order: 2 },
      { event_id: testEvent.id, type: "text", label: "First", sort_order: 0 },
      { event_id: testEvent.id, type: "text", label: "Second", sort_order: 1 },
    ]);

    const response = await page.request.get(`/api/events/manage/${testEvent.id}`);
    const data = await response.json();

    expect(data.custom_fields[0].label).toBe("First");
    expect(data.custom_fields[1].label).toBe("Second");
    expect(data.custom_fields[2].label).toBe("Third");
  });
});

test.describe("Custom Fields API - Field Properties", () => {
  test("POST /api/events saves all field properties", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await loginAsTestUser(page);

    const response = await page.request.post("/api/events", {
      data: {
        title: "E2E Test Full Field Properties",
        start_time: new Date(Date.now() + 86400000).toISOString(),
        timezone: "America/New_York",
        custom_fields: [
          {
            type: "signup",
            label: "Bring something",
            description: "Sign up to contribute",
            required: true,
            sort_order: 5,
            options: ["Food", "Drinks", "Dessert"],
            config: { max_claims_per_item: 3 },
          },
        ],
      },
    });

    expect(response.status()).toBe(201);
    const event = await response.json();

    const supabase = adminClient();
    const { data: fields } = await supabase
      .from("event_custom_fields")
      .select("*")
      .eq("event_id", event.id);

    expect(fields).toHaveLength(1);
    expect(fields?.[0].type).toBe("signup");
    expect(fields?.[0].label).toBe("Bring something");
    expect(fields?.[0].description).toBe("Sign up to contribute");
    expect(fields?.[0].required).toBe(true);
    expect(fields?.[0].sort_order).toBe(5);
    expect(fields?.[0].options).toEqual(["Food", "Drinks", "Dessert"]);
    expect(fields?.[0].config).toEqual({ max_claims_per_item: 3 });

    // Cleanup
    await supabase.from("events").delete().eq("id", event.id);
  });

  test("default values are applied for optional properties", async ({ page }) => {
    test.skip(!tablesExist, "Migration not applied yet");
    await loginAsTestUser(page);

    const response = await page.request.post("/api/events", {
      data: {
        title: "E2E Test Default Values",
        start_time: new Date(Date.now() + 86400000).toISOString(),
        timezone: "America/New_York",
        custom_fields: [
          { type: "text", label: "Minimal field" },
        ],
      },
    });

    expect(response.status()).toBe(201);
    const event = await response.json();

    const supabase = adminClient();
    const { data: fields } = await supabase
      .from("event_custom_fields")
      .select("*")
      .eq("event_id", event.id);

    expect(fields?.[0].required).toBe(false);
    expect(fields?.[0].sort_order).toBe(0);
    expect(fields?.[0].description).toBeNull();
    expect(fields?.[0].options).toBeNull();
    expect(fields?.[0].config).toEqual({});

    // Cleanup
    await supabase.from("events").delete().eq("id", event.id);
  });
});
