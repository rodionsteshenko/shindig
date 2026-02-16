/**
 * Lightweight input validators — no external dependencies.
 * Each returns { valid: boolean, errors: Record<string, string> }
 */

export const MAX_EVENTS_PER_ACCOUNT = 50;
export const MAX_GUESTS_PER_EVENT = 500;

type ValidationResult = { valid: boolean; errors: Record<string, string> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/.+/;
const PHONE_RE = /^[+\d][\d\s\-().]{6,20}$/;

function ok(): ValidationResult {
  return { valid: true, errors: {} };
}

function fail(errors: Record<string, string>): ValidationResult {
  return { valid: false, errors };
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

  if (body.maps_url != null && typeof body.maps_url === "string" && body.maps_url.trim() && !URL_RE.test(body.maps_url)) {
    errors.maps_url = "Invalid URL format";
  }

  if (body.gift_registry_url != null && typeof body.gift_registry_url === "string" && body.gift_registry_url.trim() && !URL_RE.test(body.gift_registry_url)) {
    errors.gift_registry_url = "Invalid URL format";
  }

  if (body.gift_message != null && typeof body.gift_message === "string" && body.gift_message.length > 1000) {
    errors.gift_message = "Gift message must be 1000 characters or less";
  }

  return Object.keys(errors).length ? fail(errors) : ok();
}

export function validateGuestInput(body: Record<string, unknown>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    errors.name = "Name is required";
  }

  if (body.email != null && typeof body.email === "string" && body.email.trim() && !EMAIL_RE.test(body.email)) {
    errors.email = "Invalid email format";
  }

  if (body.phone != null && typeof body.phone === "string" && body.phone.trim() && !PHONE_RE.test(body.phone)) {
    errors.phone = "Invalid phone format";
  }

  return Object.keys(errors).length ? fail(errors) : ok();
}

export function validateGuestsArrayInput(body: Record<string, unknown>): ValidationResult {
  if (!body.guests || !Array.isArray(body.guests) || body.guests.length === 0) {
    return fail({ guests: "At least one guest is required" });
  }

  for (let i = 0; i < body.guests.length; i++) {
    const result = validateGuestInput(body.guests[i]);
    if (!result.valid) {
      const errors: Record<string, string> = {};
      for (const [k, v] of Object.entries(result.errors)) {
        errors[`guests[${i}].${k}`] = v;
      }
      return fail(errors);
    }
  }

  return ok();
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
