import { test, expect } from "@playwright/test";
import {
  validateCustomFields,
  validateCustomResponses,
  MAX_CUSTOM_FIELDS_PER_EVENT,
  MAX_OPTIONS_PER_FIELD,
  MIN_OPTIONS_PER_FIELD,
  MAX_LABEL_LENGTH,
  MAX_TEXT_RESPONSE_LENGTH,
} from "../src/lib/validation";

test.describe("validateCustomFields", () => {
  test("accepts valid text field", () => {
    const result = validateCustomFields([
      { type: "text", label: "Dietary restrictions?" },
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("accepts valid poll field with options", () => {
    const result = validateCustomFields([
      {
        type: "poll",
        label: "Which date works for you?",
        options: ["Saturday", "Sunday"],
      },
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("accepts valid signup field with options", () => {
    const result = validateCustomFields([
      {
        type: "signup",
        label: "Sign up to bring:",
        options: ["Salad", "Drinks", "Dessert"],
      },
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("accepts multiple valid fields", () => {
    const result = validateCustomFields([
      { type: "text", label: "Dietary restrictions?" },
      { type: "poll", label: "Which date?", options: ["Sat", "Sun"] },
      { type: "signup", label: "Bring:", options: ["Food", "Drinks"] },
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects more than MAX_CUSTOM_FIELDS_PER_EVENT fields", () => {
    const fields = Array.from({ length: MAX_CUSTOM_FIELDS_PER_EVENT + 1 }, (_, i) => ({
      type: "text" as const,
      label: `Field ${i + 1}`,
    }));
    const result = validateCustomFields(fields);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`Maximum ${MAX_CUSTOM_FIELDS_PER_EVENT} fields per event`);
  });

  test("rejects missing type", () => {
    const result = validateCustomFields([{ label: "Test" }]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Type is required"))).toBe(true);
  });

  test("rejects invalid type", () => {
    const result = validateCustomFields([{ type: "invalid", label: "Test" }]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Type must be 'text', 'poll', or 'signup'"))).toBe(true);
  });

  test("rejects missing label", () => {
    const result = validateCustomFields([{ type: "text" }]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Label is required"))).toBe(true);
  });

  test("rejects empty label", () => {
    const result = validateCustomFields([{ type: "text", label: "   " }]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Label is required"))).toBe(true);
  });

  test("rejects label longer than MAX_LABEL_LENGTH", () => {
    const longLabel = "a".repeat(MAX_LABEL_LENGTH + 1);
    const result = validateCustomFields([{ type: "text", label: longLabel }]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes(`Label must be ${MAX_LABEL_LENGTH} characters or less`))).toBe(true);
  });

  test("rejects poll field without options", () => {
    const result = validateCustomFields([{ type: "poll", label: "Pick one" }]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Options are required for poll fields"))).toBe(true);
  });

  test("rejects signup field without options", () => {
    const result = validateCustomFields([{ type: "signup", label: "Sign up" }]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Options are required for signup fields"))).toBe(true);
  });

  test("rejects poll field with fewer than MIN_OPTIONS_PER_FIELD options", () => {
    const result = validateCustomFields([
      { type: "poll", label: "Pick one", options: ["Only one"] },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes(`At least ${MIN_OPTIONS_PER_FIELD} options are required`))).toBe(true);
  });

  test("rejects poll field with more than MAX_OPTIONS_PER_FIELD options", () => {
    const options = Array.from({ length: MAX_OPTIONS_PER_FIELD + 1 }, (_, i) => `Option ${i + 1}`);
    const result = validateCustomFields([{ type: "poll", label: "Pick one", options }]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes(`Maximum ${MAX_OPTIONS_PER_FIELD} options allowed`))).toBe(true);
  });

  test("rejects duplicate options (case insensitive)", () => {
    const result = validateCustomFields([
      { type: "poll", label: "Pick one", options: ["Option A", "option a", "Option B"] },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Duplicate options are not allowed"))).toBe(true);
  });

  test("rejects empty options", () => {
    const result = validateCustomFields([
      { type: "poll", label: "Pick one", options: ["Valid", ""] },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("All options must be non-empty strings"))).toBe(true);
  });

  test("rejects non-array input", () => {
    const result = validateCustomFields("not an array" as unknown as never[]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Fields must be an array");
  });

  test("accumulates multiple errors across fields", () => {
    const result = validateCustomFields([
      { type: "text" }, // missing label
      { type: "invalid", label: "Test" }, // invalid type
      { type: "poll", label: "Pick", options: ["One"] }, // too few options
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

test.describe("validateCustomResponses", () => {
  const textField = {
    id: "field-1",
    type: "text",
    label: "Dietary restrictions",
    required: false,
    options: null,
  };

  const requiredTextField = {
    id: "field-2",
    type: "text",
    label: "Your name",
    required: true,
    options: null,
  };

  const pollField = {
    id: "field-3",
    type: "poll",
    label: "Preferred day",
    required: false,
    options: ["Saturday", "Sunday"],
  };

  const signupField = {
    id: "field-4",
    type: "signup",
    label: "Bringing",
    required: false,
    options: ["Salad", "Drinks", "Dessert"],
  };

  test("accepts valid text response", () => {
    const result = validateCustomResponses(
      [{ field_id: "field-1", value: "Vegetarian" }],
      [textField]
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("accepts empty optional text response", () => {
    const result = validateCustomResponses(
      [{ field_id: "field-1", value: "" }],
      [textField]
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("accepts null optional text response", () => {
    const result = validateCustomResponses(
      [{ field_id: "field-1", value: null }],
      [textField]
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects empty required text response", () => {
    const result = validateCustomResponses(
      [{ field_id: "field-2", value: "" }],
      [requiredTextField]
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Your name: This field is required"))).toBe(true);
  });

  test("rejects missing required field response", () => {
    const result = validateCustomResponses([], [requiredTextField]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Your name: This field is required"))).toBe(true);
  });

  test("rejects text response longer than MAX_TEXT_RESPONSE_LENGTH", () => {
    const longValue = "a".repeat(MAX_TEXT_RESPONSE_LENGTH + 1);
    const result = validateCustomResponses(
      [{ field_id: "field-1", value: longValue }],
      [textField]
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes(`Response must be ${MAX_TEXT_RESPONSE_LENGTH} characters or less`))).toBe(true);
  });

  test("accepts valid poll response", () => {
    const result = validateCustomResponses(
      [{ field_id: "field-3", value: "Saturday" }],
      [pollField]
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("accepts valid poll response (case insensitive)", () => {
    const result = validateCustomResponses(
      [{ field_id: "field-3", value: "saturday" }],
      [pollField]
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects invalid poll response", () => {
    const result = validateCustomResponses(
      [{ field_id: "field-3", value: "Monday" }],
      [pollField]
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('"Monday" is not a valid option'))).toBe(true);
  });

  test("accepts valid signup response", () => {
    const result = validateCustomResponses(
      [{ field_id: "field-4", value: "Salad" }],
      [signupField]
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("accepts multi-select poll response (comma-separated)", () => {
    const result = validateCustomResponses(
      [{ field_id: "field-3", value: "Saturday, Sunday" }],
      [pollField]
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects partially invalid multi-select response", () => {
    const result = validateCustomResponses(
      [{ field_id: "field-3", value: "Saturday, Invalid" }],
      [pollField]
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('"Invalid" is not a valid option'))).toBe(true);
  });

  test("rejects response for unknown field", () => {
    const result = validateCustomResponses(
      [{ field_id: "unknown-field", value: "Test" }],
      [textField]
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("references unknown field"))).toBe(true);
  });

  test("rejects response without field_id", () => {
    const result = validateCustomResponses(
      [{ value: "Test" }],
      [textField]
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Response missing field_id"))).toBe(true);
  });

  test("rejects non-string value", () => {
    const result = validateCustomResponses(
      [{ field_id: "field-1", value: 123 as unknown as string }],
      [textField]
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Value must be a string"))).toBe(true);
  });

  test("rejects non-array responses input", () => {
    const result = validateCustomResponses(
      "not an array" as unknown as never[],
      [textField]
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Responses must be an array");
  });

  test("rejects non-array fields input", () => {
    const result = validateCustomResponses(
      [{ field_id: "field-1", value: "Test" }],
      "not an array" as unknown as never[]
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Fields must be an array");
  });

  test("validates multiple responses", () => {
    const result = validateCustomResponses(
      [
        { field_id: "field-1", value: "Vegetarian" },
        { field_id: "field-3", value: "Saturday" },
        { field_id: "field-4", value: "Drinks" },
      ],
      [textField, pollField, signupField]
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("accumulates multiple errors", () => {
    const result = validateCustomResponses(
      [
        { field_id: "field-1", value: "a".repeat(MAX_TEXT_RESPONSE_LENGTH + 1) }, // too long
        { field_id: "field-3", value: "Invalid" }, // invalid option
        { field_id: "field-2", value: "" }, // required field empty
      ],
      [textField, requiredTextField, pollField]
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
