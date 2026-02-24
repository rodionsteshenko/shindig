/**
 * Phone number normalization and formatting utilities using libphonenumber-js.
 * Converts various phone formats to E.164 standard (e.g., +15551234567).
 */

import {
  parsePhoneNumberFromString,
  CountryCode,
  AsYouType,
  getCountries,
  getCountryCallingCode,
} from "libphonenumber-js";

// Re-export CountryCode type for use by other modules
export type { CountryCode };

// Default country code for phone number parsing
export const DEFAULT_COUNTRY: CountryCode = "US";

// Common country options for the UI selector
export interface CountryOption {
  code: CountryCode;
  name: string;
  dialCode: string;
}

// Most common countries first, then sorted alphabetically
const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  NL: "Netherlands",
  BR: "Brazil",
  MX: "Mexico",
  IN: "India",
  JP: "Japan",
  CN: "China",
  KR: "South Korea",
};

/**
 * Get list of supported countries with their dial codes.
 * Returns common countries first, then all others alphabetically.
 */
export function getCountryOptions(): CountryOption[] {
  const allCountries = getCountries();
  const commonCodes = ["US", "CA", "GB", "AU", "DE", "FR", "ES", "IT", "NL", "BR", "MX", "IN", "JP", "CN", "KR"];

  const options: CountryOption[] = [];

  // Add common countries first
  for (const code of commonCodes) {
    if (allCountries.includes(code as CountryCode)) {
      const dialCode = getCountryCallingCode(code as CountryCode);
      options.push({
        code: code as CountryCode,
        name: COUNTRY_NAMES[code] || code,
        dialCode: `+${dialCode}`,
      });
    }
  }

  // Add divider indicator (handled by UI)
  // Then add remaining countries sorted alphabetically by name
  const remainingCountries = allCountries
    .filter(code => !commonCodes.includes(code))
    .map(code => ({
      code,
      name: COUNTRY_NAMES[code] || code,
      dialCode: `+${getCountryCallingCode(code)}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return [...options, ...remainingCountries];
}

/**
 * Normalizes a phone number to E.164 format.
 *
 * @param raw - The raw phone number input (various formats accepted)
 * @param defaultCountry - The default country code if number doesn't have one
 * @returns The E.164 formatted number (e.g., "+15551234567") or null if invalid
 *
 * @example
 * normalizePhone("(555) 123-4567") // "+15551234567" (assumes US)
 * normalizePhone("+1 555-123-4567") // "+15551234567"
 * normalizePhone("555.123.4567", "US") // "+15551234567"
 * normalizePhone("invalid") // null
 */
export function normalizePhone(raw: string, defaultCountry: CountryCode = DEFAULT_COUNTRY): string | null {
  if (!raw || typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const phoneNumber = parsePhoneNumberFromString(trimmed, defaultCountry);

    if (!phoneNumber || !phoneNumber.isValid()) {
      return null;
    }

    return phoneNumber.format("E.164");
  } catch {
    return null;
  }
}

/**
 * Formats a phone number as the user types for display.
 *
 * @param input - The current input value
 * @param defaultCountry - The country code for formatting
 * @returns Formatted number string for display
 *
 * @example
 * formatAsYouType("555", "US") // "(555)"
 * formatAsYouType("5551234567", "US") // "(555) 123-4567"
 */
export function formatAsYouType(input: string, defaultCountry: CountryCode = DEFAULT_COUNTRY): string {
  if (!input) return "";

  const formatter = new AsYouType(defaultCountry);
  return formatter.input(input);
}

/**
 * Checks if a phone number appears valid without normalizing.
 * Useful for quick validation before form submission.
 *
 * @param raw - The raw phone number input
 * @param defaultCountry - The default country code
 * @returns true if the number appears valid
 */
export function isValidPhone(raw: string, defaultCountry: CountryCode = DEFAULT_COUNTRY): boolean {
  return normalizePhone(raw, defaultCountry) !== null;
}

/**
 * Gets the national format of a phone number for display.
 *
 * @param e164 - An E.164 formatted phone number
 * @returns National format (e.g., "(555) 123-4567") or the original if parsing fails
 */
export function formatNational(e164: string): string {
  if (!e164) return "";

  try {
    const phoneNumber = parsePhoneNumberFromString(e164);
    if (phoneNumber) {
      return phoneNumber.formatNational();
    }
  } catch {
    // Fall through to return original
  }

  return e164;
}

/**
 * Gets the international format of a phone number for display.
 *
 * @param e164 - An E.164 formatted phone number
 * @returns International format (e.g., "+1 555 123 4567") or the original if parsing fails
 */
export function formatInternational(e164: string): string {
  if (!e164) return "";

  try {
    const phoneNumber = parsePhoneNumberFromString(e164);
    if (phoneNumber) {
      return phoneNumber.formatInternational();
    }
  } catch {
    // Fall through to return original
  }

  return e164;
}
