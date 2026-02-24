/**
 * Lightweight input validators.
 * Each returns { valid: boolean, errors: Record<string, string>, data?: ... }
 */

import { normalizePhone, type CountryCode, DEFAULT_COUNTRY } from "./phone";

export const MAX_EVENTS_PER_ACCOUNT = 50;
export const MAX_GUESTS_PER_EVENT = 500;

type ValidationResult = { valid: boolean; errors: Record<string, string> };

// Extended result type for guest validation that includes normalized phone
type GuestValidationResult = ValidationResult & {
  normalizedPhone?: string | null;
};

// Extended result type for guests array validation
type GuestsArrayValidationResult = ValidationResult & {
  normalizedGuests?: Array<{ name: string; email: string; phone: string | null }>;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/.+/;
const HTTPS_URL_RE = /^https:\/\/.+/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type { CountryCode };

function ok(): ValidationResult {
  return { valid: true, errors: {} };
}

function fail(errors: Record<string, string>): ValidationResult {
  return { valid: false, errors };
}

export function validateSlug(slug: string): ValidationResult {
  const errors: Record<string, string> = {};

  if (slug.length < 3) {
    errors.slug = "URL must be at least 3 characters";
  } else if (slug.length > 60) {
    errors.slug = "URL must be 60 characters or less";
  } else if (!SLUG_RE.test(slug)) {
    errors.slug = "URL can only contain lowercase letters, numbers, and hyphens";
  }

  return Object.keys(errors).length ? fail(errors) : ok();
}

export function validateEventInput(body: Record<string, unknown>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    errors.title = "Title is required";
  } else if (body.title.length > 200) {
    errors.title = "Title must be 200 characters or less";
  }

  if (body.description != null && typeof body.description === "string" && body.description.length > 5000) {
    errors.description = "Description must be 5000 characters or less";
  }

  if (!body.start_time) {
    errors.start_time = "Start time is required";
  }

  if (!body.timezone || typeof body.timezone !== "string") {
    errors.timezone = "Timezone is required";
  }

  if (body.maps_url != null && typeof body.maps_url === "string" && body.maps_url.trim() && !HTTPS_URL_RE.test(body.maps_url)) {
    errors.maps_url = "Maps link must start with https://";
  }

  if (body.gift_registry_url != null && typeof body.gift_registry_url === "string" && body.gift_registry_url.trim() && !URL_RE.test(body.gift_registry_url)) {
    errors.gift_registry_url = "Invalid URL format";
  }

  if (body.gift_message != null && typeof body.gift_message === "string" && body.gift_message.length > 1000) {
    errors.gift_message = "Gift message must be 1000 characters or less";
  }

  // Validate custom slug if provided
  if (body.slug != null && typeof body.slug === "string" && body.slug.trim()) {
    const slugValidation = validateSlug(body.slug);
    if (!slugValidation.valid) {
      errors.slug = slugValidation.errors.slug;
    }
  }

  return Object.keys(errors).length ? fail(errors) : ok();
}

export function validateGuestInput(
  body: Record<string, unknown>,
  defaultCountry: CountryCode = DEFAULT_COUNTRY
): GuestValidationResult {
  const errors: Record<string, string> = {};
  let normalizedPhone: string | null = null;

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    errors.name = "Name is required";
  }

  if (body.email != null && typeof body.email === "string" && body.email.trim() && !EMAIL_RE.test(body.email)) {
    errors.email = "Invalid email format";
  }

  // Normalize phone to E.164 format if provided
  if (body.phone != null && typeof body.phone === "string" && body.phone.trim()) {
    normalizedPhone = normalizePhone(body.phone, defaultCountry);
    if (normalizedPhone === null) {
      errors.phone = "Invalid phone number. Please enter a valid phone with country code.";
    }
  }

  if (Object.keys(errors).length) {
    return { valid: false, errors };
  }

  return { valid: true, errors: {}, normalizedPhone };
}

export function validateGuestsArrayInput(
  body: Record<string, unknown>,
  defaultCountry: CountryCode = DEFAULT_COUNTRY
): GuestsArrayValidationResult {
  if (!body.guests || !Array.isArray(body.guests) || body.guests.length === 0) {
    return { valid: false, errors: { guests: "At least one guest is required" } };
  }

  const normalizedGuests: Array<{ name: string; email: string; phone: string | null }> = [];

  for (let i = 0; i < body.guests.length; i++) {
    const guest = body.guests[i] as Record<string, unknown>;
    const result = validateGuestInput(guest, defaultCountry);
    if (!result.valid) {
      const errors: Record<string, string> = {};
      for (const [k, v] of Object.entries(result.errors)) {
        errors[`guests[${i}].${k}`] = v;
      }
      return { valid: false, errors };
    }

    normalizedGuests.push({
      name: (guest.name as string).trim(),
      email: guest.email ? (guest.email as string).trim() : "",
      phone: result.normalizedPhone ?? null,
    });
  }

  return { valid: true, errors: {}, normalizedGuests };
}

const VALID_RSVP_STATUSES = ["going", "maybe", "declined"];

export function validateRSVPInput(body: Record<string, unknown>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!body.rsvp_status || typeof body.rsvp_status !== "string" || !VALID_RSVP_STATUSES.includes(body.rsvp_status)) {
    errors.rsvp_status = "Status must be going, maybe, or declined";
  }

  if (body.plus_one_count != null) {
    const count = Number(body.plus_one_count);
    if (isNaN(count) || count < 0 || count > 10) {
      errors.plus_one_count = "Plus one count must be between 0 and 10";
    }
  }

  if (body.dietary != null && typeof body.dietary === "string" && body.dietary.length > 500) {
    errors.dietary = "Dietary info must be 500 characters or less";
  }

  if (body.message != null && typeof body.message === "string" && body.message.length > 1000) {
    errors.message = "Message must be 1000 characters or less";
  }

  return Object.keys(errors).length ? fail(errors) : ok();
}

export function validateFeatureInput(body: Record<string, unknown>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    errors.title = "Title is required";
  } else if (body.title.length > 200) {
    errors.title = "Title must be 200 characters or less";
  }

  if (body.description != null && typeof body.description === "string" && body.description.length > 2000) {
    errors.description = "Description must be 2000 characters or less";
  }

  if (body.type != null && typeof body.type === "string" && !["feature", "bug"].includes(body.type)) {
    errors.type = "Type must be 'feature' or 'bug'";
  }

  return Object.keys(errors).length ? fail(errors) : ok();
}

// Custom field validation types
export type CustomFieldValidationResult = { valid: boolean; errors: string[] };

export const MAX_CUSTOM_FIELDS_PER_EVENT = 10;
export const MAX_OPTIONS_PER_FIELD = 20;
export const MIN_OPTIONS_PER_FIELD = 2;
export const MAX_LABEL_LENGTH = 200;
export const MAX_TEXT_RESPONSE_LENGTH = 1000;

const VALID_FIELD_TYPES = ["text", "poll", "signup"] as const;
type ValidFieldType = typeof VALID_FIELD_TYPES[number];

interface CustomFieldInput {
  type?: unknown;
  label?: unknown;
  options?: unknown;
}

/**
 * Validates an array of custom field definitions before creating/updating.
 *
 * Rules:
 * - Max 10 fields per event
 * - Label is required (1-200 chars)
 * - Type must be 'text', 'poll', or 'signup'
 * - Poll/signup fields need 2-20 options
 * - No duplicate options within a field
 */
export function validateCustomFields(fields: CustomFieldInput[]): CustomFieldValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(fields)) {
    return { valid: false, errors: ["Fields must be an array"] };
  }

  if (fields.length > MAX_CUSTOM_FIELDS_PER_EVENT) {
    errors.push(`Maximum ${MAX_CUSTOM_FIELDS_PER_EVENT} fields per event`);
  }

  fields.forEach((field, index) => {
    const prefix = `Field ${index + 1}`;

    // Validate type
    if (!field.type || typeof field.type !== "string") {
      errors.push(`${prefix}: Type is required`);
    } else if (!VALID_FIELD_TYPES.includes(field.type as ValidFieldType)) {
      errors.push(`${prefix}: Type must be 'text', 'poll', or 'signup'`);
    }

    // Validate label
    if (!field.label || typeof field.label !== "string") {
      errors.push(`${prefix}: Label is required`);
    } else if (field.label.trim().length === 0) {
      errors.push(`${prefix}: Label is required`);
    } else if (field.label.length > MAX_LABEL_LENGTH) {
      errors.push(`${prefix}: Label must be ${MAX_LABEL_LENGTH} characters or less`);
    }

    // Validate options for poll/signup fields
    const fieldType = typeof field.type === "string" ? field.type : "";
    if (fieldType === "poll" || fieldType === "signup") {
      if (!field.options || !Array.isArray(field.options)) {
        errors.push(`${prefix}: Options are required for ${fieldType} fields`);
      } else {
        if (field.options.length < MIN_OPTIONS_PER_FIELD) {
          errors.push(`${prefix}: At least ${MIN_OPTIONS_PER_FIELD} options are required`);
        }
        if (field.options.length > MAX_OPTIONS_PER_FIELD) {
          errors.push(`${prefix}: Maximum ${MAX_OPTIONS_PER_FIELD} options allowed`);
        }

        // Check for non-string options
        const invalidOptions = field.options.filter(opt => typeof opt !== "string" || !opt.trim());
        if (invalidOptions.length > 0) {
          errors.push(`${prefix}: All options must be non-empty strings`);
        }

        // Check for duplicate options
        const trimmedOptions = field.options
          .filter((opt): opt is string => typeof opt === "string")
          .map(opt => opt.trim().toLowerCase());
        const uniqueOptions = new Set(trimmedOptions);
        if (uniqueOptions.size !== trimmedOptions.length) {
          errors.push(`${prefix}: Duplicate options are not allowed`);
        }
      }
    }
  });

  return { valid: errors.length === 0, errors };
}

interface CustomFieldDefinition {
  id: string;
  type: string;
  label: string;
  required: boolean;
  options?: string[] | null;
}

interface CustomResponseInput {
  field_id?: unknown;
  value?: unknown;
}

/**
 * Validates custom field responses against their field definitions.
 *
 * Rules:
 * - Required fields must have a non-empty value
 * - Text values max 1000 chars
 * - Poll/signup values must be valid options from the field definition
 */
export function validateCustomResponses(
  responses: CustomResponseInput[],
  fields: CustomFieldDefinition[]
): CustomFieldValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(responses)) {
    return { valid: false, errors: ["Responses must be an array"] };
  }

  if (!Array.isArray(fields)) {
    return { valid: false, errors: ["Fields must be an array"] };
  }

  // Create a lookup map for fields
  const fieldMap = new Map<string, CustomFieldDefinition>();
  for (const field of fields) {
    fieldMap.set(field.id, field);
  }

  // Check that all required fields have responses
  for (const field of fields) {
    if (field.required) {
      const response = responses.find(r => r.field_id === field.id);
      if (!response || !response.value || (typeof response.value === "string" && !response.value.trim())) {
        errors.push(`${field.label}: This field is required`);
      }
    }
  }

  // Validate each response
  for (const response of responses) {
    if (!response.field_id || typeof response.field_id !== "string") {
      errors.push("Response missing field_id");
      continue;
    }

    const field = fieldMap.get(response.field_id);
    if (!field) {
      errors.push(`Response references unknown field: ${response.field_id}`);
      continue;
    }

    const value = response.value;

    // Skip validation for empty non-required fields
    if (!value || (typeof value === "string" && !value.trim())) {
      continue;
    }

    if (typeof value !== "string") {
      errors.push(`${field.label}: Value must be a string`);
      continue;
    }

    // Validate based on field type
    if (field.type === "text") {
      if (value.length > MAX_TEXT_RESPONSE_LENGTH) {
        errors.push(`${field.label}: Response must be ${MAX_TEXT_RESPONSE_LENGTH} characters or less`);
      }
    } else if (field.type === "poll" || field.type === "signup") {
      // For poll/signup, value could be a single option or comma-separated options (for multi-select)
      const selectedOptions = value.split(",").map(v => v.trim()).filter(v => v);
      const validOptions = (field.options || []).map(opt => opt.trim().toLowerCase());

      for (const selected of selectedOptions) {
        if (!validOptions.includes(selected.toLowerCase())) {
          errors.push(`${field.label}: "${selected}" is not a valid option`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
