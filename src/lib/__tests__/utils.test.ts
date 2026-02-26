import { describe, it, expect } from "vitest";
import { generateSlug, isUUID, stripHtml, generateICS, formatDate, formatTime } from "../utils";

describe("generateSlug", () => {
  it("generates a slug from a normal title", () => {
    const slug = generateSlug("My Cool Event");
    expect(slug).toMatch(/^my-cool-event-[a-z0-9]{4}$/);
  });

  it("strips special characters", () => {
    const slug = generateSlug("Hello! World? #2024");
    expect(slug).toMatch(/^hello-world-2024-[a-z0-9]{4}$/);
  });

  it("handles title with only special characters", () => {
    const slug = generateSlug("!!!");
    // Should produce a valid fallback, not "-xxxx"
    expect(slug).toMatch(/^event-[a-z0-9]{4}$/);
    expect(slug).not.toMatch(/^-/); // Must not start with hyphen
  });

  it("handles empty string", () => {
    const slug = generateSlug("");
    expect(slug).toMatch(/^event-[a-z0-9]{4}$/);
  });

  it("handles string of only spaces", () => {
    const slug = generateSlug("   ");
    expect(slug).toMatch(/^event-[a-z0-9]{4}$/);
  });

  it("handles unicode-only title (no ascii letters/numbers)", () => {
    const slug = generateSlug("日本語タイトル");
    expect(slug).toMatch(/^event-[a-z0-9]{4}$/);
  });

  it("collapses multiple hyphens", () => {
    const slug = generateSlug("hello   world");
    expect(slug).toMatch(/^hello-world-[a-z0-9]{4}$/);
  });

  it("truncates long titles to 40 chars before suffix", () => {
    const longTitle = "a".repeat(100);
    const slug = generateSlug(longTitle);
    const base = slug.replace(/-[a-z0-9]{4}$/, "");
    expect(base.length).toBeLessThanOrEqual(40);
  });

  it("strips leading hyphens from base", () => {
    const slug = generateSlug("-leading-hyphen");
    expect(slug).toMatch(/^leading-hyphen-[a-z0-9]{4}$/);
  });
});

describe("isUUID", () => {
  it("accepts valid UUID", () => {
    expect(isUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("rejects non-UUID strings", () => {
    expect(isUUID("not-a-uuid")).toBe(false);
    expect(isUUID("")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isUUID("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });
});

describe("stripHtml", () => {
  it("strips simple tags", () => {
    expect(stripHtml("<p>Hello</p>")).toBe("Hello");
  });

  it("converts br to newline", () => {
    expect(stripHtml("line1<br>line2")).toBe("line1\nline2");
  });

  it("converts list items", () => {
    expect(stripHtml("<ul><li>one</li><li>two</li></ul>")).toBe("• one\n• two");
  });

  it("decodes common entities", () => {
    expect(stripHtml("&amp; &lt; &gt; &quot; &#039;")).toBe('& < > " \'');
  });

  it("handles empty string", () => {
    expect(stripHtml("")).toBe("");
  });
});

describe("generateICS", () => {
  it("generates valid ICS with required fields", () => {
    const ics = generateICS({
      title: "Test Event",
      start_time: "2024-06-15T18:00:00Z",
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("SUMMARY:Test Event");
    expect(ics).toContain("DTSTART:");
  });

  it("includes end time when provided", () => {
    const ics = generateICS({
      title: "Test",
      start_time: "2024-06-15T18:00:00Z",
      end_time: "2024-06-15T20:00:00Z",
    });
    expect(ics).toContain("DTEND:");
  });

  it("escapes special characters in title", () => {
    const ics = generateICS({
      title: "Hello, World; Test\\n",
      start_time: "2024-06-15T18:00:00Z",
    });
    expect(ics).toContain("SUMMARY:Hello\\, World\\; Test\\\\n");
  });
});
