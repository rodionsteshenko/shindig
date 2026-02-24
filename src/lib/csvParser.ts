import { normalizePhone, type CountryCode, DEFAULT_COUNTRY } from "./phone";

export interface CSVGuest {
  name: string;
  email: string;
  phone?: string; // E.164 normalized phone number
}

export interface CSVParseError {
  row: number;
  line: string;
  reason: string;
}

export interface CSVParseResult {
  guests: CSVGuest[];
  errors: CSVParseError[];
}

/**
 * Parses a CSV text containing guest data.
 * Validates and normalizes phone numbers to E.164 format.
 * Returns both valid guests and any parsing errors.
 *
 * Expected CSV format: name, email, phone (phone is optional)
 *
 * @param text - The CSV text to parse
 * @param defaultCountry - Default country code for phone normalization (default: US)
 * @returns Object containing valid guests array and errors array
 */
export function parseGuestCSV(
  text: string,
  defaultCountry: CountryCode = DEFAULT_COUNTRY
): CSVParseResult {
  const lines = text.trim().split("\n");
  if (lines.length === 0) return { guests: [], errors: [] };

  // Detect if first line is a header
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes("name") || firstLine.includes("email");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const guests: CSVGuest[] = [];
  const errors: CSVParseError[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    const rowNumber = hasHeader ? i + 2 : i + 1; // 1-indexed, accounting for header

    // Skip empty lines
    if (!line.trim()) continue;

    const parts = line.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));

    // Require at least name (email can be empty for phone-only guests)
    if (parts.length < 1 || parts[0].length === 0) {
      errors.push({
        row: rowNumber,
        line: line,
        reason: "Name is required",
      });
      continue;
    }

    const name = parts[0];
    const email = parts[1] || "";
    const rawPhone = parts[2] || "";

    // Validate phone if provided
    let normalizedPhone: string | undefined;
    if (rawPhone.trim()) {
      const normalized = normalizePhone(rawPhone, defaultCountry);
      if (normalized === null) {
        errors.push({
          row: rowNumber,
          line: line,
          reason: `Invalid phone number: "${rawPhone}"`,
        });
        continue;
      }
      normalizedPhone = normalized;
    }

    guests.push({
      name,
      email,
      phone: normalizedPhone,
    });
  }

  return { guests, errors };
}

/**
 * Formats parse errors into a user-friendly message.
 *
 * @param errors - Array of parse errors from parseGuestCSV
 * @returns Formatted error message string
 */
export function formatCSVErrors(errors: CSVParseError[]): string {
  if (errors.length === 0) return "";

  const lines = errors.map(
    (e) => `Row ${e.row}: ${e.reason}`
  );

  if (errors.length === 1) {
    return `1 row skipped: ${lines[0]}`;
  }

  return `${errors.length} rows skipped:\n${lines.slice(0, 5).join("\n")}${
    errors.length > 5 ? `\n... and ${errors.length - 5} more` : ""
  }`;
}
