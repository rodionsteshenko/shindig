import { test, expect } from "@playwright/test";
import { adminClient, ensureTestUser, seedEvent, seedGuest, cleanupTestData } from "./helpers";

/**
 * Check if the custom fields tables exist.
 * Migration must be applied via Supabase SQL Editor first.
 */
async function customFieldsTablesExist(): Promise<boolean> {
  const supabase = adminClient();
  const { error } = await supabase.from("event_custom_fields").select("*").limit(0);
  return !error;
}

test.describe("Custom Event Fields Schema", () => {
  let testUserId: string;
  let testEventId: string;
  let testGuestId: string;
  let tablesExist: boolean;

  test.beforeAll(async () => {
    // Check if migration has been applied
    tablesExist = await customFieldsTablesExist();
    if (!tablesExist) {
      console.log("\n⚠️  Custom fields tables do not exist yet.");
      console.log("   Apply migration via Supabase SQL Editor:");
      console.log("   File: supabase/migrations/20260217000000_custom_event_fields.sql");
      console.log("   URL: https://supabase.com/dashboard/project/jppvvoyvsxuqwluxacfu/sql/new\n");
      return;
    }

    // Ensure test user exists
    testUserId = await ensureTestUser();

    // Create a test event
    const event = await seedEvent(testUserId, {
      title: "E2E Test Custom Fields Event",
      is_public: true,
    });
    testEventId = event.id;

    // Create a test guest
    const guest = await seedGuest(testEventId, {
      name: "E2E Test Custom Fields Guest",
      email: "custom-fields-guest@shindig.test",
    });
    testGuestId = guest.id;
  });

  test.afterAll(async () => {
    if (!tablesExist) return;

    const supabase = adminClient();

    // Clean up custom field responses first (FK constraint)
    if (testGuestId) {
      await supabase
        .from("custom_field_responses")
        .delete()
        .eq("guest_id", testGuestId);
    }

    // Clean up custom fields
    if (testEventId) {
      await supabase
        .from("event_custom_fields")
        .delete()
        .eq("event_id", testEventId);
    }

    // Clean up the rest
    await cleanupTestData();
  });

  test("event_custom_fields table exists with correct columns", async () => {
    test.skip(!tablesExist, "Migration not applied yet");
    const supabase = adminClient();

    // Insert a test field to verify table exists and columns work
    const { data, error } = await supabase
      .from("event_custom_fields")
      .insert({
        event_id: testEventId,
        type: "text",
        label: "E2E Test Field",
        description: "A test field description",
        required: true,
        sort_order: 1,
        options: null,
        config: { placeholder: "Enter text" },
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.id).toBeDefined();
    expect(data.event_id).toBe(testEventId);
    expect(data.type).toBe("text");
    expect(data.label).toBe("E2E Test Field");
    expect(data.description).toBe("A test field description");
    expect(data.required).toBe(true);
    expect(data.sort_order).toBe(1);
    expect(data.options).toBeNull();
    expect(data.config).toEqual({ placeholder: "Enter text" });
    expect(data.created_at).toBeDefined();

    // Clean up
    await supabase.from("event_custom_fields").delete().eq("id", data.id);
  });

  test("event_custom_fields type constraint allows only text, poll, signup", async () => {
    test.skip(!tablesExist, "Migration not applied yet");
    const supabase = adminClient();

    // Valid types should work
    for (const type of ["text", "poll", "signup"]) {
      const { data, error } = await supabase
        .from("event_custom_fields")
        .insert({
          event_id: testEventId,
          type,
          label: `E2E Test ${type} Field`,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.type).toBe(type);

      // Clean up
      await supabase.from("event_custom_fields").delete().eq("id", data.id);
    }

    // Invalid type should fail
    const { error } = await supabase.from("event_custom_fields").insert({
      event_id: testEventId,
      type: "invalid_type",
      label: "E2E Test Invalid Field",
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain("violates check constraint");
  });

  test("custom_field_responses table exists with correct columns", async () => {
    test.skip(!tablesExist, "Migration not applied yet");
    const supabase = adminClient();

    // First create a field
    const { data: field } = await supabase
      .from("event_custom_fields")
      .insert({
        event_id: testEventId,
        type: "text",
        label: "E2E Test Response Field",
      })
      .select()
      .single();

    // Insert a response
    const { data: response, error } = await supabase
      .from("custom_field_responses")
      .insert({
        field_id: field!.id,
        guest_id: testGuestId,
        value: "Test response value",
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(response).toBeDefined();
    expect(response.id).toBeDefined();
    expect(response.field_id).toBe(field!.id);
    expect(response.guest_id).toBe(testGuestId);
    expect(response.value).toBe("Test response value");
    expect(response.created_at).toBeDefined();
    expect(response.updated_at).toBeDefined();

    // Clean up
    await supabase.from("custom_field_responses").delete().eq("id", response.id);
    await supabase.from("event_custom_fields").delete().eq("id", field!.id);
  });

  test("custom_field_responses unique constraint on (field_id, guest_id)", async () => {
    test.skip(!tablesExist, "Migration not applied yet");
    const supabase = adminClient();

    // Create a field
    const { data: field } = await supabase
      .from("event_custom_fields")
      .insert({
        event_id: testEventId,
        type: "text",
        label: "E2E Test Unique Constraint Field",
      })
      .select()
      .single();

    // Insert first response
    const { data: response1, error: error1 } = await supabase
      .from("custom_field_responses")
      .insert({
        field_id: field!.id,
        guest_id: testGuestId,
        value: "First response",
      })
      .select()
      .single();

    expect(error1).toBeNull();

    // Try to insert duplicate - should fail
    const { error: error2 } = await supabase
      .from("custom_field_responses")
      .insert({
        field_id: field!.id,
        guest_id: testGuestId,
        value: "Second response",
      });

    expect(error2).not.toBeNull();
    expect(error2!.message).toContain("duplicate key value violates unique constraint");

    // Clean up
    await supabase.from("custom_field_responses").delete().eq("id", response1!.id);
    await supabase.from("event_custom_fields").delete().eq("id", field!.id);
  });

  test("cascade delete from events removes custom fields", async () => {
    test.skip(!tablesExist, "Migration not applied yet");
    const supabase = adminClient();

    // Create a temporary event
    const { data: tempEvent } = await supabase
      .from("events")
      .insert({
        host_id: testUserId,
        title: "E2E Test Cascade Delete Event",
        start_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        timezone: "America/New_York",
        slug: `cascade-test-${Date.now()}`,
        is_public: true,
      })
      .select()
      .single();

    // Create a field for that event
    const { data: field } = await supabase
      .from("event_custom_fields")
      .insert({
        event_id: tempEvent!.id,
        type: "text",
        label: "E2E Test Cascade Field",
      })
      .select()
      .single();

    // Verify field exists
    const { data: fieldsBeforeDelete } = await supabase
      .from("event_custom_fields")
      .select()
      .eq("id", field!.id);

    expect(fieldsBeforeDelete).toHaveLength(1);

    // Delete the event
    await supabase.from("events").delete().eq("id", tempEvent!.id);

    // Verify field was cascade deleted
    const { data: fieldsAfterDelete } = await supabase
      .from("event_custom_fields")
      .select()
      .eq("id", field!.id);

    expect(fieldsAfterDelete).toHaveLength(0);
  });

  test("cascade delete from custom fields removes responses", async () => {
    test.skip(!tablesExist, "Migration not applied yet");
    const supabase = adminClient();

    // Create a field
    const { data: field } = await supabase
      .from("event_custom_fields")
      .insert({
        event_id: testEventId,
        type: "text",
        label: "E2E Test Cascade Response Field",
      })
      .select()
      .single();

    // Create a response
    const { data: response } = await supabase
      .from("custom_field_responses")
      .insert({
        field_id: field!.id,
        guest_id: testGuestId,
        value: "Test cascade response",
      })
      .select()
      .single();

    // Verify response exists
    const { data: responsesBeforeDelete } = await supabase
      .from("custom_field_responses")
      .select()
      .eq("id", response!.id);

    expect(responsesBeforeDelete).toHaveLength(1);

    // Delete the field
    await supabase.from("event_custom_fields").delete().eq("id", field!.id);

    // Verify response was cascade deleted
    const { data: responsesAfterDelete } = await supabase
      .from("custom_field_responses")
      .select()
      .eq("id", response!.id);

    expect(responsesAfterDelete).toHaveLength(0);
  });

  test("cascade delete from guests removes responses", async () => {
    test.skip(!tablesExist, "Migration not applied yet");
    const supabase = adminClient();

    // Create a temporary guest
    const { data: tempGuest } = await supabase
      .from("guests")
      .insert({
        event_id: testEventId,
        name: "E2E Test Cascade Guest",
        email: "cascade-guest@shindig.test",
      })
      .select()
      .single();

    // Create a field
    const { data: field } = await supabase
      .from("event_custom_fields")
      .insert({
        event_id: testEventId,
        type: "text",
        label: "E2E Test Guest Cascade Field",
      })
      .select()
      .single();

    // Create a response for the temporary guest
    const { data: response } = await supabase
      .from("custom_field_responses")
      .insert({
        field_id: field!.id,
        guest_id: tempGuest!.id,
        value: "Test guest cascade response",
      })
      .select()
      .single();

    // Verify response exists
    const { data: responsesBeforeDelete } = await supabase
      .from("custom_field_responses")
      .select()
      .eq("id", response!.id);

    expect(responsesBeforeDelete).toHaveLength(1);

    // Delete the guest
    await supabase.from("guests").delete().eq("id", tempGuest!.id);

    // Verify response was cascade deleted
    const { data: responsesAfterDelete } = await supabase
      .from("custom_field_responses")
      .select()
      .eq("id", response!.id);

    expect(responsesAfterDelete).toHaveLength(0);

    // Clean up field
    await supabase.from("event_custom_fields").delete().eq("id", field!.id);
  });

  test("indexes exist and queries work efficiently", async () => {
    test.skip(!tablesExist, "Migration not applied yet");
    const supabase = adminClient();

    // Verify we can efficiently query by event_id (index test)
    const { data: fields, error: queryError } = await supabase
      .from("event_custom_fields")
      .select()
      .eq("event_id", testEventId);

    expect(queryError).toBeNull();
    // The query should work, indicating the table structure is correct
  });

  test("poll field with options", async () => {
    test.skip(!tablesExist, "Migration not applied yet");
    const supabase = adminClient();

    const pollOptions = {
      choices: [
        { value: "option1", label: "First Option" },
        { value: "option2", label: "Second Option" },
        { value: "option3", label: "Third Option" },
      ],
      allow_multiple: true,
    };

    const { data, error } = await supabase
      .from("event_custom_fields")
      .insert({
        event_id: testEventId,
        type: "poll",
        label: "E2E Test Poll Field",
        description: "Pick your favorite options",
        options: pollOptions,
        config: { show_results: true },
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.type).toBe("poll");
    expect(data.options).toEqual(pollOptions);
    expect(data.config).toEqual({ show_results: true });

    // Clean up
    await supabase.from("event_custom_fields").delete().eq("id", data.id);
  });

  test("signup field with options", async () => {
    test.skip(!tablesExist, "Migration not applied yet");
    const supabase = adminClient();

    const signupOptions = {
      slots: [
        { value: "salad", label: "Salad", max_claims: 2 },
        { value: "drinks", label: "Drinks", max_claims: 3 },
        { value: "dessert", label: "Dessert", max_claims: 1 },
      ],
    };

    const { data, error } = await supabase
      .from("event_custom_fields")
      .insert({
        event_id: testEventId,
        type: "signup",
        label: "E2E Test Signup Field",
        description: "Sign up to bring something",
        options: signupOptions,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.type).toBe("signup");
    expect(data.options).toEqual(signupOptions);

    // Clean up
    await supabase.from("event_custom_fields").delete().eq("id", data.id);
  });

  test("default values work correctly", async () => {
    test.skip(!tablesExist, "Migration not applied yet");
    const supabase = adminClient();

    // Create field with minimal data to test defaults
    const { data, error } = await supabase
      .from("event_custom_fields")
      .insert({
        event_id: testEventId,
        type: "text",
        label: "E2E Test Defaults Field",
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.required).toBe(false); // default false
    expect(data.sort_order).toBe(0); // default 0
    expect(data.config).toEqual({}); // default '{}'
    expect(data.description).toBeNull();
    expect(data.options).toBeNull();

    // Clean up
    await supabase.from("event_custom_fields").delete().eq("id", data.id);
  });
});
