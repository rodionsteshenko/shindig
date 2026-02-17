import { test, expect } from "@playwright/test";
import { loginAsTestUser, cleanupTestData, seedEvent, adminClient } from "./helpers";

/**
 * Check if the custom fields tables exist.
 * Migration must be applied via Supabase SQL Editor first.
 */
async function customFieldsTablesExist(): Promise<boolean> {
  const supabase = adminClient();
  const { error } = await supabase.from("event_custom_fields").select("*").limit(0);
  return !error;
}

test.describe("CustomFieldBuilder Component", () => {
  let tablesExist: boolean;

  test.beforeAll(async () => {
    tablesExist = await customFieldsTablesExist();
    if (!tablesExist) {
      console.log("\n⚠️  Custom fields tables do not exist yet.");
      console.log("   Apply migration via Supabase SQL Editor:");
      console.log("   File: supabase/migrations/20260217000000_custom_event_fields.sql\n");
    }
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test.describe("Event Creation", () => {
    test("renders Custom Questions section collapsed by default", async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto("/create");

      // Custom Questions section should exist
      const customQuestionsButton = page.getByRole("button", { name: /Custom Questions/i });
      await expect(customQuestionsButton).toBeVisible();

      // Section should be collapsed - "Add a question" button should not be visible
      await expect(page.getByRole("button", { name: /Add a question/i })).not.toBeVisible();
    });

    test("can expand Custom Questions section", async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto("/create");

      // Click to expand
      await page.getByRole("button", { name: /Custom Questions/i }).click();

      // Add button should now be visible
      await expect(page.getByRole("button", { name: /Add a question/i })).toBeVisible();
    });

    test("can open type picker and see all three options", async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto("/create");

      // Expand and click Add
      await page.getByRole("button", { name: /Custom Questions/i }).click();
      await page.getByRole("button", { name: /Add a question/i }).click();

      // Should see all three field types
      await expect(page.getByRole("button", { name: /Text Question/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Poll/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Signup List/i })).toBeVisible();
    });

    test("can add a text question field", async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto("/create");

      // Expand, add, and select text
      await page.getByRole("button", { name: /Custom Questions/i }).click();
      await page.getByRole("button", { name: /Add a question/i }).click();
      await page.getByRole("button", { name: /Text Question/i }).click();

      // Field card should appear
      await expect(page.getByPlaceholder(/What's your t-shirt size/i)).toBeVisible();

      // Fill in the question
      await page.getByPlaceholder(/What's your t-shirt size/i).fill("Dietary restrictions?");

      // Field count badge should show 1
      await expect(page.getByText("1", { exact: true })).toBeVisible();
    });

    test("can add a poll field with options and multi-select toggle", async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto("/create");

      // Expand, add, and select poll
      await page.getByRole("button", { name: /Custom Questions/i }).click();
      await page.getByRole("button", { name: /Add a question/i }).click();
      await page.getByRole("button", { name: /Poll/i }).click();

      // Poll-specific elements should be visible
      await expect(page.getByText("Options")).toBeVisible();
      await expect(page.getByPlaceholder("Option 1")).toBeVisible();
      await expect(page.getByPlaceholder("Option 2")).toBeVisible();
      await expect(page.getByText("Allow multiple selections")).toBeVisible();

      // Fill in the poll question
      await page.getByPlaceholder(/What's your t-shirt size/i).fill("Which date works best?");

      // Edit options
      await page.getByPlaceholder("Option 1").clear();
      await page.getByPlaceholder("Option 1").fill("Saturday");
      await page.getByPlaceholder("Option 2").clear();
      await page.getByPlaceholder("Option 2").fill("Sunday");

      // Add a third option
      await page.getByRole("button", { name: /Add option/i }).click();
      // Check that third option input exists
      const optionInputs = page.locator('input[placeholder^="Option"]');
      await expect(optionInputs).toHaveCount(3);
    });

    test("can add a signup field with items and max claims", async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto("/create");

      // Expand, add, and select signup
      await page.getByRole("button", { name: /Custom Questions/i }).click();
      await page.getByRole("button", { name: /Add a question/i }).click();
      await page.getByRole("button", { name: /Signup List/i }).click();

      // Signup-specific elements should be visible
      await expect(page.getByText("Signup Items")).toBeVisible();
      await expect(page.getByText("Max signups per item:")).toBeVisible();

      // Fill in the question
      await page.getByPlaceholder(/What's your t-shirt size/i).fill("What will you bring?");

      // Edit items
      const itemInputs = page.locator('input[placeholder^="Item"]');
      await expect(itemInputs).toHaveCount(2);
    });

    test("can toggle required checkbox", async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto("/create");

      // Add a text field
      await page.getByRole("button", { name: /Custom Questions/i }).click();
      await page.getByRole("button", { name: /Add a question/i }).click();
      await page.getByRole("button", { name: /Text Question/i }).click();

      // Find the required checkbox
      const requiredCheckbox = page.getByLabel("Required");
      await expect(requiredCheckbox).not.toBeChecked();

      // Toggle it
      await requiredCheckbox.check();
      await expect(requiredCheckbox).toBeChecked();
    });

    test("can delete a field", async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto("/create");

      // Add a text field
      await page.getByRole("button", { name: /Custom Questions/i }).click();
      await page.getByRole("button", { name: /Add a question/i }).click();
      await page.getByRole("button", { name: /Text Question/i }).click();

      // Field should be visible
      await expect(page.getByPlaceholder(/What's your t-shirt size/i)).toBeVisible();

      // Delete it
      await page.getByRole("button", { name: /Remove question/i }).click();

      // Field should be gone
      await expect(page.getByPlaceholder(/What's your t-shirt size/i)).not.toBeVisible();
    });

    test("can reorder fields with up/down arrows", async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto("/create");

      // Add two text fields
      await page.getByRole("button", { name: /Custom Questions/i }).click();
      await page.getByRole("button", { name: /Add a question/i }).click();
      await page.getByRole("button", { name: /Text Question/i }).click();
      await page.getByPlaceholder(/What's your t-shirt size/i).fill("First Question");

      await page.getByRole("button", { name: /Add a question/i }).click();
      await page.getByRole("button", { name: /Text Question/i }).click();
      // There are now two question inputs
      const questionInputs = page.locator('input[placeholder="e.g., What\'s your t-shirt size?"]');
      await questionInputs.last().fill("Second Question");

      // Verify order - First should be first
      const firstInput = questionInputs.first();
      await expect(firstInput).toHaveValue("First Question");

      // Click move down on first field
      const moveDownButtons = page.getByTitle("Move down");
      await moveDownButtons.first().click();

      // Now Second Question should be first
      await expect(questionInputs.first()).toHaveValue("Second Question");
    });

    test("enforces maximum 10 fields limit", async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto("/create");

      await page.getByRole("button", { name: /Custom Questions/i }).click();

      // Add 10 fields
      for (let i = 0; i < 10; i++) {
        await page.getByRole("button", { name: /Add a question/i }).click();
        await page.getByRole("button", { name: /Text Question/i }).click();
      }

      // Add button should be disabled now
      const addButton = page.getByRole("button", { name: /Maximum 10 questions reached/i });
      await expect(addButton).toBeVisible();
      await expect(addButton).toBeDisabled();
    });

    test("can submit event with custom fields", async ({ page }) => {
      test.skip(!tablesExist, "Migration not applied yet");

      await loginAsTestUser(page);
      await page.goto("/create");

      // Fill in required event fields with unique title
      const uniqueTitle = `E2E Test Event With Custom Fields ${Date.now()}`;
      await page.getByLabel(/Event Title/i).fill(uniqueTitle);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dateStr = tomorrow.toISOString().slice(0, 16);
      await page.getByLabel(/Start Date/i).fill(dateStr);

      // Add a text question
      await page.getByRole("button", { name: /Custom Questions/i }).click();
      await page.getByRole("button", { name: /Add a question/i }).click();
      await page.getByRole("button", { name: /Text Question/i }).click();
      await page.getByPlaceholder(/What's your t-shirt size/i).fill("Dietary restrictions?");

      // Submit the form
      await page.getByRole("button", { name: /Create Event/i }).click();

      // Should redirect to dashboard
      await page.waitForURL("**/dashboard/**", { timeout: 15000 });

      // Verify custom field was saved by checking the database
      const supabase = adminClient();
      const { data: events } = await supabase
        .from("events")
        .select("id")
        .eq("title", uniqueTitle)
        .single();

      expect(events).toBeTruthy();

      const { data: customFields } = await supabase
        .from("event_custom_fields")
        .select("*")
        .eq("event_id", events!.id);

      expect(customFields).toHaveLength(1);
      expect(customFields![0].type).toBe("text");
      expect(customFields![0].label).toBe("Dietary restrictions?");
    });
  });

  test.describe("Event Editing", () => {
    test("loads existing custom fields in edit mode", async ({ page }) => {
      test.skip(!tablesExist, "Migration not applied yet");

      const userId = await loginAsTestUser(page);
      const event = await seedEvent(userId, {
        title: "E2E Test Event With Existing Fields",
      });

      // Add a custom field to the event
      const supabase = adminClient();
      await supabase.from("event_custom_fields").insert({
        event_id: event.id,
        type: "text",
        label: "Existing Text Question",
        description: "This is a pre-existing question",
        required: true,
        sort_order: 0,
        config: {},
      });

      // Navigate to edit page
      await page.goto(`/dashboard/${event.id}/edit`);

      // Custom Questions section should be expanded (has fields)
      // and the existing field should be visible
      const questionInput = page.locator('input[placeholder="e.g., What\'s your t-shirt size?"]');
      await expect(questionInput).toHaveValue("Existing Text Question");

      const descriptionInput = page.locator('input[placeholder="Add helpful context for your guests"]');
      await expect(descriptionInput).toHaveValue("This is a pre-existing question");

      // Required checkbox should be checked
      const requiredCheckbox = page.getByLabel("Required");
      await expect(requiredCheckbox).toBeChecked();
    });

    test("can modify existing custom fields", async ({ page }) => {
      test.skip(!tablesExist, "Migration not applied yet");

      const userId = await loginAsTestUser(page);
      const event = await seedEvent(userId, {
        title: "E2E Test Event For Field Modification",
      });

      // Add a custom field
      const supabase = adminClient();
      const { data: field } = await supabase.from("event_custom_fields").insert({
        event_id: event.id,
        type: "text",
        label: "Original Question",
        required: false,
        sort_order: 0,
        config: {},
      }).select().single();

      // Navigate to edit page
      await page.goto(`/dashboard/${event.id}/edit`);

      // Modify the question
      const questionInput = page.locator('input[placeholder="e.g., What\'s your t-shirt size?"]');
      await questionInput.clear();
      await questionInput.fill("Modified Question");

      // Submit changes
      await page.getByRole("button", { name: /Update Event/i }).click();
      await page.waitForURL(`**/dashboard/${event.id}`, { timeout: 15000 });

      // Verify the change in database
      const { data: updatedField } = await supabase
        .from("event_custom_fields")
        .select("*")
        .eq("id", field!.id)
        .single();

      expect(updatedField!.label).toBe("Modified Question");
    });

    test("can add new fields to existing event", async ({ page }) => {
      test.skip(!tablesExist, "Migration not applied yet");

      const userId = await loginAsTestUser(page);
      const event = await seedEvent(userId, {
        title: "E2E Test Event For Adding Fields",
      });

      // Navigate to edit page
      await page.goto(`/dashboard/${event.id}/edit`);

      // Expand custom questions section
      await page.getByRole("button", { name: /Custom Questions/i }).click();

      // Add a new poll field
      await page.getByRole("button", { name: /Add a question/i }).click();
      await page.getByRole("button", { name: /Poll/i }).click();
      await page.getByPlaceholder(/What's your t-shirt size/i).fill("New Poll Question");

      // Submit changes
      await page.getByRole("button", { name: /Update Event/i }).click();
      await page.waitForURL(`**/dashboard/${event.id}`, { timeout: 15000 });

      // Verify the field was added
      const supabase = adminClient();
      const { data: customFields } = await supabase
        .from("event_custom_fields")
        .select("*")
        .eq("event_id", event.id);

      expect(customFields).toBeTruthy();
      expect(customFields!.length).toBe(1);
      expect(customFields![0].type).toBe("poll");
      expect(customFields![0].label).toBe("New Poll Question");
    });

    test("can delete existing custom fields", async ({ page }) => {
      test.skip(!tablesExist, "Migration not applied yet");

      const userId = await loginAsTestUser(page);
      const event = await seedEvent(userId, {
        title: "E2E Test Event For Deleting Fields",
      });

      // Add a custom field
      const supabase = adminClient();
      await supabase.from("event_custom_fields").insert({
        event_id: event.id,
        type: "text",
        label: "Field To Delete",
        sort_order: 0,
        config: {},
      });

      // Navigate to edit page
      await page.goto(`/dashboard/${event.id}/edit`);

      // Field should be visible
      const questionInput = page.locator('input[placeholder="e.g., What\'s your t-shirt size?"]');
      await expect(questionInput).toHaveValue("Field To Delete");

      // Delete it
      await page.getByRole("button", { name: /Remove question/i }).click();

      // Submit changes
      await page.getByRole("button", { name: /Update Event/i }).click();
      await page.waitForURL(`**/dashboard/${event.id}`, { timeout: 15000 });

      // Verify the field was deleted
      const { data: customFields } = await supabase
        .from("event_custom_fields")
        .select("*")
        .eq("event_id", event.id);

      expect(customFields).toHaveLength(0);
    });

    test("preserves field order after editing", async ({ page }) => {
      test.skip(!tablesExist, "Migration not applied yet");

      const userId = await loginAsTestUser(page);
      const event = await seedEvent(userId, {
        title: "E2E Test Event For Field Order",
      });

      // Add multiple custom fields
      const supabase = adminClient();
      await supabase.from("event_custom_fields").insert([
        {
          event_id: event.id,
          type: "text",
          label: "First Field",
          sort_order: 0,
          config: {},
        },
        {
          event_id: event.id,
          type: "text",
          label: "Second Field",
          sort_order: 1,
          config: {},
        },
        {
          event_id: event.id,
          type: "text",
          label: "Third Field",
          sort_order: 2,
          config: {},
        },
      ]);

      // Navigate to edit page
      await page.goto(`/dashboard/${event.id}/edit`);

      // Verify fields are loaded
      const questionInputs = page.locator('input[placeholder="e.g., What\'s your t-shirt size?"]');
      await expect(questionInputs).toHaveCount(3);

      // Get all move down buttons and click the second one (to move "Second Field" down)
      const moveDownButtons = page.getByTitle("Move down");
      await moveDownButtons.nth(1).click();

      // Submit changes
      await page.getByRole("button", { name: /Update Event/i }).click();
      await page.waitForURL(`**/dashboard/${event.id}`, { timeout: 15000 });

      // Verify new order
      const { data: customFields } = await supabase
        .from("event_custom_fields")
        .select("*")
        .eq("event_id", event.id)
        .order("sort_order");

      expect(customFields![0].label).toBe("First Field");
      expect(customFields![1].label).toBe("Third Field");
      expect(customFields![2].label).toBe("Second Field");
    });
  });
});
