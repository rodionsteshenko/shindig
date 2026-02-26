import { describe, it, expect } from "vitest";
import { parseGuestCSV, formatCSVErrors } from "../csvParser";

describe("parseGuestCSV", () => {
  it("parses simple CSV without header", () => {
    const result = parseGuestCSV("John Doe,john@example.com\nJane Smith,jane@example.com");
    expect(result.guests).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.guests[0].name).toBe("John Doe");
    expect(result.guests[0].email).toBe("john@example.com");
  });

  it("skips header row when detected", () => {
    const csv = "name,email,phone\nJohn,john@test.com,";
    const result = parseGuestCSV(csv);
    expect(result.guests).toHaveLength(1);
    expect(result.guests[0].name).toBe("John");
  });

  it("handles quoted fields with commas", () => {
    const csv = '"Smith, John",john@example.com';
    const result = parseGuestCSV(csv);
    expect(result.guests).toHaveLength(1);
    expect(result.guests[0].name).toBe("Smith, John");
    expect(result.guests[0].email).toBe("john@example.com");
  });

  it("handles doubled quotes as escape", () => {
    const csv = '"He said ""hello""",test@test.com';
    const result = parseGuestCSV(csv);
    expect(result.guests).toHaveLength(1);
    expect(result.guests[0].name).toBe('He said "hello"');
  });

  it("handles empty lines", () => {
    const csv = "John,john@test.com\n\nJane,jane@test.com";
    const result = parseGuestCSV(csv);
    expect(result.guests).toHaveLength(2);
  });

  it("errors on missing name", () => {
    const csv = ",john@test.com";
    const result = parseGuestCSV(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toContain("Name is required");
  });

  it("handles name-only rows (no email)", () => {
    const csv = "John Doe";
    const result = parseGuestCSV(csv);
    expect(result.guests).toHaveLength(1);
    expect(result.guests[0].name).toBe("John Doe");
    expect(result.guests[0].email).toBe("");
  });

  it("handles phone numbers with valid US format", () => {
    const csv = "John,john@test.com,+12025551234";
    const result = parseGuestCSV(csv);
    expect(result.guests).toHaveLength(1);
    expect(result.guests[0].phone).toBe("+12025551234");
  });

  it("errors on invalid phone numbers", () => {
    const csv = "John,john@test.com,invalidphone";
    const result = parseGuestCSV(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toContain("Invalid phone");
  });

  it("handles mixed valid and invalid rows", () => {
    const csv = "John,john@test.com\n,\nJane,jane@test.com";
    const result = parseGuestCSV(csv);
    expect(result.guests).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
  });

  it("handles empty input", () => {
    const result = parseGuestCSV("");
    expect(result.guests).toHaveLength(0);
  });

  it("handles quoted fields with commas in multi-row CSV", () => {
    const csv = '"Last, First",first@test.com\n"Another, Person",person@test.com';
    const result = parseGuestCSV(csv);
    expect(result.guests).toHaveLength(2);
    expect(result.guests[0].name).toBe("Last, First");
    expect(result.guests[1].name).toBe("Another, Person");
  });
});

describe("formatCSVErrors", () => {
  it("returns empty string for no errors", () => {
    expect(formatCSVErrors([])).toBe("");
  });

  it("formats single error", () => {
    const msg = formatCSVErrors([{ row: 2, line: "bad", reason: "Name is required" }]);
    expect(msg).toContain("1 row skipped");
    expect(msg).toContain("Row 2");
  });

  it("truncates after 5 errors", () => {
    const errors = Array.from({ length: 7 }, (_, i) => ({
      row: i + 1,
      line: "bad",
      reason: "error",
    }));
    const msg = formatCSVErrors(errors);
    expect(msg).toContain("7 rows skipped");
    expect(msg).toContain("and 2 more");
  });
});
