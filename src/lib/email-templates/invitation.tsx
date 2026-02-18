/**
 * Invitation Email Template
 *
 * A beautiful, branded HTML email template for event invitations.
 * Uses inline CSS for maximum email client compatibility.
 */

export interface InvitationEmailProps {
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string | null;
  eventDescription: string | null; // Plain text excerpt
  coverImageUrl?: string | null;
  rsvpUrl: string;
  calendarUrl?: string | null;
  hostName: string;
  guestName?: string;
}

// Shindig brand color: #7c3aed (purple-600)
const BRAND_COLOR = "#7c3aed";
const BRAND_COLOR_LIGHT = "#f5f3ff"; // purple-50

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Truncate text to a maximum length, adding ellipsis if needed
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trim() + "...";
}

/**
 * Generate the HTML email template for event invitations.
 * Uses inline CSS for maximum email client compatibility.
 */
export function renderInvitationHtml(props: InvitationEmailProps): string {
  const {
    eventTitle,
    eventDate,
    eventTime,
    eventLocation,
    eventDescription,
    coverImageUrl,
    rsvpUrl,
    calendarUrl,
    hostName,
    guestName,
  } = props;

  const safeTitle = escapeHtml(eventTitle);
  const safeHostName = escapeHtml(hostName);
  const safeGuestName = guestName ? escapeHtml(guestName) : null;
  const safeLocation = eventLocation ? escapeHtml(eventLocation) : null;
  const safeDescription = eventDescription
    ? escapeHtml(truncateText(eventDescription, 300))
    : null;

  const greeting = safeGuestName ? `Hi ${safeGuestName},` : "You're invited!";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>You're invited to ${safeTitle}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <!-- Outer wrapper table for centering -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        <!-- Main content container -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">

          <!-- Header with brand color -->
          <tr>
            <td style="background-color: ${BRAND_COLOR}; padding: 24px 20px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                You're Invited!
              </h1>
            </td>
          </tr>

          ${
            coverImageUrl
              ? `
          <!-- Cover image -->
          <tr>
            <td style="padding: 0;">
              <img src="${escapeHtml(coverImageUrl)}" alt="${safeTitle}" width="600" style="width: 100%; max-width: 600px; height: auto; display: block; border: 0;">
            </td>
          </tr>
          `
              : ""
          }

          <!-- Main content -->
          <tr>
            <td style="padding: 32px 24px;">
              <!-- Greeting -->
              <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.5;">
                ${greeting}
              </p>

              <!-- Host invitation text -->
              <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.5;">
                <strong style="color: ${BRAND_COLOR};">${safeHostName}</strong> has invited you to:
              </p>

              <!-- Event title -->
              <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 24px; font-weight: 700; line-height: 1.3;">
                ${safeTitle}
              </h2>

              <!-- Event details box -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${BRAND_COLOR_LIGHT}; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <!-- Date -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td width="24" valign="top" style="padding-right: 12px;">
                          <span style="font-size: 18px;">&#128197;</span>
                        </td>
                        <td style="color: #374151; font-size: 16px; line-height: 1.5;">
                          <strong>${escapeHtml(eventDate)}</strong> at ${escapeHtml(eventTime)}
                        </td>
                      </tr>
                    </table>

                    ${
                      safeLocation
                        ? `
                    <!-- Location -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 12px;">
                      <tr>
                        <td width="24" valign="top" style="padding-right: 12px;">
                          <span style="font-size: 18px;">&#128205;</span>
                        </td>
                        <td style="color: #374151; font-size: 16px; line-height: 1.5;">
                          ${safeLocation}
                        </td>
                      </tr>
                    </table>
                    `
                        : ""
                    }
                  </td>
                </tr>
              </table>

              ${
                safeDescription
                  ? `
              <!-- Event description -->
              <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 15px; line-height: 1.6;">
                ${safeDescription}
              </p>
              `
                  : ""
              }

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding: 8px 0 24px 0;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(rsvpUrl)}" style="height:48px;v-text-anchor:middle;width:200px;" arcsize="50%" strokecolor="${BRAND_COLOR}" fillcolor="${BRAND_COLOR}">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:bold;">RSVP Now</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${escapeHtml(rsvpUrl)}" target="_blank" style="display: inline-block; background-color: ${BRAND_COLOR}; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 9999px; text-align: center; mso-hide: all;">
                      RSVP Now
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              ${
                calendarUrl
                  ? `
              <!-- Add to Calendar link -->
              <p style="margin: 0 0 16px 0; text-align: center;">
                <a href="${escapeHtml(calendarUrl)}" target="_blank" style="color: ${BRAND_COLOR}; font-size: 14px; text-decoration: underline;">
                  Add to Calendar
                </a>
              </p>
              `
                  : ""
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 24px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 13px; text-align: center; line-height: 1.5;">
                Sent via <a href="https://shindig.app" target="_blank" style="color: ${BRAND_COLOR}; text-decoration: none;">Shindig</a> &mdash; Beautiful event invitations
              </p>
            </td>
          </tr>

        </table>

        <!-- Email footer with unsubscribe hint -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px;">
          <tr>
            <td style="padding: 20px; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                You received this email because you were invited to an event on Shindig.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generate a plain-text version of the invitation email.
 * Used as a fallback for email clients that don't support HTML.
 */
export function renderInvitationText(props: InvitationEmailProps): string {
  const {
    eventTitle,
    eventDate,
    eventTime,
    eventLocation,
    eventDescription,
    rsvpUrl,
    calendarUrl,
    hostName,
    guestName,
  } = props;

  const lines: string[] = [];

  // Greeting
  if (guestName) {
    lines.push(`Hi ${guestName},`);
  } else {
    lines.push("You're invited!");
  }
  lines.push("");

  // Invitation text
  lines.push(`${hostName} has invited you to:`);
  lines.push("");
  lines.push(eventTitle.toUpperCase());
  lines.push("=".repeat(Math.min(eventTitle.length, 50)));
  lines.push("");

  // Event details
  lines.push(`Date: ${eventDate}`);
  lines.push(`Time: ${eventTime}`);
  if (eventLocation) {
    lines.push(`Location: ${eventLocation}`);
  }
  lines.push("");

  // Description
  if (eventDescription) {
    lines.push(truncateText(eventDescription, 300));
    lines.push("");
  }

  // RSVP link
  lines.push("---");
  lines.push("");
  lines.push("RSVP Now:");
  lines.push(rsvpUrl);
  lines.push("");

  // Calendar link
  if (calendarUrl) {
    lines.push("Add to Calendar:");
    lines.push(calendarUrl);
    lines.push("");
  }

  // Footer
  lines.push("---");
  lines.push("Sent via Shindig - https://shindig.app");

  return lines.join("\n");
}

/**
 * Generate the email subject line for invitations.
 */
export function getInvitationSubject(eventTitle: string): string {
  return `You're invited to ${eventTitle}!`;
}

/**
 * Convenience function that returns both HTML and plain-text versions.
 */
export function renderInvitation(props: InvitationEmailProps): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: getInvitationSubject(props.eventTitle),
    html: renderInvitationHtml(props),
    text: renderInvitationText(props),
  };
}
