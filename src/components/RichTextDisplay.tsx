import { sanitizeHtml } from "@/lib/sanitize";

interface RichTextDisplayProps {
  html: string | null | undefined;
  className?: string;
}

/**
 * Renders rich text HTML content with sanitization and prose styling.
 * Falls back to plain text rendering for legacy content without HTML tags.
 */
export default function RichTextDisplay({
  html,
  className = "",
}: RichTextDisplayProps) {
  if (html == null || html.trim() === "") {
    return null;
  }

  // Check if content contains any HTML tags
  const hasHtmlTags = /<[^>]+>/.test(html);

  if (!hasHtmlTags) {
    // Render plain text with preserved whitespace (legacy fallback)
    return (
      <div className={`prose prose-gray max-w-none ${className}`}>
        <p className="whitespace-pre-wrap">{html}</p>
      </div>
    );
  }

  // Sanitize HTML content
  const sanitized = sanitizeHtml(html);

  if (!sanitized) {
    return null;
  }

  return (
    <div
      className={`prose prose-gray max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
