import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Allows only safe formatting tags used by the rich text editor:
 * - Text formatting: strong, em, b, i, u
 * - Headings: h2, h3
 * - Lists: ul, ol, li
 * - Links: a (with href, target, rel attributes)
 * - Paragraphs and line breaks: p, br
 */
export function sanitizeHtml(html: string | null | undefined): string | null {
  if (html == null || html === "") {
    return null;
  }

  // Configure DOMPurify to add hook for links
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    // Force all links to open in new tab with noopener noreferrer
    if (node.tagName === "A" && node.hasAttribute("href")) {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });

  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "h2",
      "h3",
      "ul",
      "ol",
      "li",
      "a",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "class"],
  });

  // Remove the hook to prevent memory leaks and side effects
  DOMPurify.removeHook("afterSanitizeAttributes");

  // Return null if sanitization resulted in empty string
  if (sanitized.trim() === "" || sanitized === "<p></p>") {
    return null;
  }

  return sanitized;
}

/**
 * Checks if HTML content is effectively empty (no text content).
 * Used for form validation - empty editor produces "<p></p>".
 */
export function isHtmlEmpty(html: string | null | undefined): boolean {
  if (html == null || html === "") {
    return true;
  }

  // Strip all HTML tags and check if any text content remains
  const textContent = html.replace(/<[^>]*>/g, "").trim();
  return textContent.length === 0;
}
