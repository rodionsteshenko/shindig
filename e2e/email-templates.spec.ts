import { test, expect } from "@playwright/test";
import {
  renderInvitation,
  renderInvitationHtml,
  renderInvitationText,
  getInvitationSubject,
  type InvitationEmailProps,
} from "../src/lib/email-templates";

/**
 * E2E tests for email templates
 *
 * Tests the invitation email template module:
 * - HTML rendering with all props
 * - Plain-text fallback rendering
 * - Subject line generation
 * - Brand color usage
 * - Responsive layout
 */

const baseProps: InvitationEmailProps = {
  eventTitle: "Summer Beach Party",
  eventDate: "Saturday, July 15, 2025",
  eventTime: "3:00 PM",
  eventLocation: "123 Ocean Drive, Miami, FL",
  eventDescription: "Join us for a fun day at the beach with food, games, and great company!",
  coverImageUrl: "https://example.com/cover.jpg",
  rsvpUrl: "https://shindig.app/rsvp/abc123",
  calendarUrl: "https://calendar.google.com/event?id=xyz",
  hostName: "Jane Smith",
  guestName: "John Doe",
};

test.describe("Email Template Module", () => {
  test.describe("renderInvitationHtml", () => {
    test("returns valid HTML document", () => {
      const html = renderInvitationHtml(baseProps);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html");
      expect(html).toContain("</html>");
      expect(html).toContain("<head>");
      expect(html).toContain("<body");
    });

    test("includes event title in HTML", () => {
      const html = renderInvitationHtml(baseProps);
      expect(html).toContain("Summer Beach Party");
    });

    test("includes event date and time", () => {
      const html = renderInvitationHtml(baseProps);
      expect(html).toContain("Saturday, July 15, 2025");
      expect(html).toContain("3:00 PM");
    });

    test("includes event location when provided", () => {
      const html = renderInvitationHtml(baseProps);
      expect(html).toContain("123 Ocean Drive, Miami, FL");
    });

    test("includes event description when provided", () => {
      const html = renderInvitationHtml(baseProps);
      expect(html).toContain("Join us for a fun day at the beach");
    });

    test("includes cover image when provided", () => {
      const html = renderInvitationHtml(baseProps);
      expect(html).toContain('src="https://example.com/cover.jpg"');
    });

    test("excludes cover image when not provided", () => {
      const props = { ...baseProps, coverImageUrl: null };
      const html = renderInvitationHtml(props);
      expect(html).not.toContain("cover.jpg");
    });

    test("includes RSVP button with correct URL", () => {
      const html = renderInvitationHtml(baseProps);
      expect(html).toContain("RSVP Now");
      expect(html).toContain('href="https://shindig.app/rsvp/abc123"');
    });

    test("includes calendar link when provided", () => {
      const html = renderInvitationHtml(baseProps);
      expect(html).toContain("Add to Calendar");
      expect(html).toContain("https://calendar.google.com/event?id=xyz");
    });

    test("excludes calendar link when not provided", () => {
      const props = { ...baseProps, calendarUrl: null };
      const html = renderInvitationHtml(props);
      expect(html).not.toContain("Add to Calendar");
    });

    test("includes host name", () => {
      const html = renderInvitationHtml(baseProps);
      expect(html).toContain("Jane Smith");
    });

    test("includes guest name in greeting", () => {
      const html = renderInvitationHtml(baseProps);
      expect(html).toContain("Hi John Doe,");
    });

    test("uses generic greeting when guest name not provided", () => {
      const props = { ...baseProps, guestName: undefined };
      const html = renderInvitationHtml(props);
      expect(html).toContain("You're invited!");
      expect(html).not.toContain("Hi undefined");
    });

    test("uses Shindig brand color (#7c3aed)", () => {
      const html = renderInvitationHtml(baseProps);
      expect(html).toContain("#7c3aed");
    });

    test("uses inline CSS (no class attributes for styling)", () => {
      const html = renderInvitationHtml(baseProps);
      // The template should use style= attributes, not class=
      expect(html).toContain('style="');
      // Should not have Tailwind classes
      expect(html).not.toMatch(/class="[^"]*bg-/);
      expect(html).not.toMatch(/class="[^"]*text-/);
    });

    test("uses table layout for email compatibility", () => {
      const html = renderInvitationHtml(baseProps);
      expect(html).toContain("<table");
      expect(html).toContain("</table>");
    });

    test("includes max-width for responsive layout", () => {
      const html = renderInvitationHtml(baseProps);
      expect(html).toContain("max-width: 600px");
    });

    test("escapes HTML in user-provided content", () => {
      const props = {
        ...baseProps,
        eventTitle: "<script>alert('xss')</script>",
        eventDescription: "<b>bold</b> & \"quoted\"",
        coverImageUrl: null, // Remove cover image to simplify test
      };
      const html = renderInvitationHtml(props);
      // Script tags should be escaped
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
      // Bold tag in description should be escaped
      expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
      // Ampersand and quotes should be escaped
      expect(html).toContain("&amp;");
      expect(html).toContain("&quot;quoted&quot;");
    });

    test("includes Shindig footer", () => {
      const html = renderInvitationHtml(baseProps);
      expect(html).toContain("Shindig");
      expect(html).toContain("shindig.app");
    });
  });

  test.describe("renderInvitationText", () => {
    test("returns plain text format", () => {
      const text = renderInvitationText(baseProps);
      expect(text).not.toContain("<");
      expect(text).not.toContain(">");
    });

    test("includes event title", () => {
      const text = renderInvitationText(baseProps);
      expect(text).toContain("SUMMER BEACH PARTY");
    });

    test("includes event date and time", () => {
      const text = renderInvitationText(baseProps);
      expect(text).toContain("Date: Saturday, July 15, 2025");
      expect(text).toContain("Time: 3:00 PM");
    });

    test("includes location when provided", () => {
      const text = renderInvitationText(baseProps);
      expect(text).toContain("Location: 123 Ocean Drive, Miami, FL");
    });

    test("excludes location when not provided", () => {
      const props = { ...baseProps, eventLocation: null };
      const text = renderInvitationText(props);
      expect(text).not.toContain("Location:");
    });

    test("includes RSVP URL", () => {
      const text = renderInvitationText(baseProps);
      expect(text).toContain("RSVP Now:");
      expect(text).toContain("https://shindig.app/rsvp/abc123");
    });

    test("includes calendar URL when provided", () => {
      const text = renderInvitationText(baseProps);
      expect(text).toContain("Add to Calendar:");
      expect(text).toContain("https://calendar.google.com/event?id=xyz");
    });

    test("excludes calendar section when not provided", () => {
      const props = { ...baseProps, calendarUrl: null };
      const text = renderInvitationText(props);
      expect(text).not.toContain("Add to Calendar:");
    });

    test("includes guest name greeting", () => {
      const text = renderInvitationText(baseProps);
      expect(text).toContain("Hi John Doe,");
    });

    test("uses generic greeting when guest name not provided", () => {
      const props = { ...baseProps, guestName: undefined };
      const text = renderInvitationText(props);
      expect(text).toContain("You're invited!");
    });

    test("includes Shindig footer", () => {
      const text = renderInvitationText(baseProps);
      expect(text).toContain("Sent via Shindig");
      expect(text).toContain("https://shindig.app");
    });
  });

  test.describe("getInvitationSubject", () => {
    test("generates subject with event title", () => {
      const subject = getInvitationSubject("Summer Beach Party");
      expect(subject).toBe("You're invited to Summer Beach Party!");
    });
  });

  test.describe("renderInvitation", () => {
    test("returns object with subject, html, and text", () => {
      const result = renderInvitation(baseProps);
      expect(result).toHaveProperty("subject");
      expect(result).toHaveProperty("html");
      expect(result).toHaveProperty("text");
    });

    test("subject matches getInvitationSubject", () => {
      const result = renderInvitation(baseProps);
      expect(result.subject).toBe("You're invited to Summer Beach Party!");
    });

    test("html matches renderInvitationHtml", () => {
      const result = renderInvitation(baseProps);
      const html = renderInvitationHtml(baseProps);
      expect(result.html).toBe(html);
    });

    test("text matches renderInvitationText", () => {
      const result = renderInvitation(baseProps);
      const text = renderInvitationText(baseProps);
      expect(result.text).toBe(text);
    });
  });

  test.describe("Edge Cases", () => {
    test("handles long description with truncation", () => {
      const longDesc = "A".repeat(400);
      const props = { ...baseProps, eventDescription: longDesc };
      const html = renderInvitationHtml(props);
      // Description should be truncated to 300 chars
      expect(html).toContain("...");
      expect(html).not.toContain("A".repeat(400));
    });

    test("handles minimal props (only required fields)", () => {
      const minProps: InvitationEmailProps = {
        eventTitle: "Test Event",
        eventDate: "Jan 1, 2025",
        eventTime: "12:00 PM",
        eventLocation: null,
        eventDescription: null,
        rsvpUrl: "https://example.com/rsvp",
        hostName: "Host",
      };
      const html = renderInvitationHtml(minProps);
      expect(html).toContain("Test Event");
      expect(html).toContain("Jan 1, 2025");
      expect(html).toContain("RSVP Now");
    });

    test("handles special characters in event title", () => {
      const props = { ...baseProps, eventTitle: "John's 30th & Mary's B-Day!" };
      const html = renderInvitationHtml(props);
      expect(html).toContain("John&#039;s 30th &amp; Mary&#039;s B-Day!");
    });
  });
});
