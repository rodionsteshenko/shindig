interface InviteEmailData {
  guestName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation?: string | null;
  rsvpUrl: string;
}

export function invitationEmail(data: InviteEmailData): { subject: string; html: string } {
  return {
    subject: `You're invited to ${data.eventTitle}!`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="font-size: 24px; margin-bottom: 8px;">🎉 You're Invited!</h1>
  </div>

  <p>Hi ${data.guestName},</p>

  <p>You're invited to <strong>${data.eventTitle}</strong>!</p>

  <div style="background: #fdf4ff; border-radius: 12px; padding: 20px; margin: 20px 0;">
    <p style="margin: 4px 0;">📅 <strong>${data.eventDate}</strong> at ${data.eventTime}</p>
    ${data.eventLocation ? `<p style="margin: 4px 0;">📍 ${data.eventLocation}</p>` : ""}
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${data.rsvpUrl}" style="background: #c026d3; color: white; padding: 12px 32px; border-radius: 999px; text-decoration: none; font-weight: 600; display: inline-block;">
      RSVP Now
    </a>
  </div>

  <p style="color: #666; font-size: 14px; text-align: center;">
    Sent via <a href="https://shindig.app" style="color: #c026d3;">Shindig</a>
  </p>
</body>
</html>`,
  };
}

interface ReminderEmailData {
  guestName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  rsvpUrl: string;
}

export function reminderEmail(data: ReminderEmailData): { subject: string; html: string } {
  return {
    subject: `Reminder: RSVP for ${data.eventTitle}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="font-size: 24px; margin-bottom: 8px;">⏰ RSVP Reminder</h1>
  </div>

  <p>Hi ${data.guestName},</p>

  <p>Just a friendly reminder — <strong>${data.eventTitle}</strong> is coming up and we haven't heard from you yet!</p>

  <div style="background: #fdf4ff; border-radius: 12px; padding: 20px; margin: 20px 0;">
    <p style="margin: 4px 0;">📅 <strong>${data.eventDate}</strong> at ${data.eventTime}</p>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${data.rsvpUrl}" style="background: #c026d3; color: white; padding: 12px 32px; border-radius: 999px; text-decoration: none; font-weight: 600; display: inline-block;">
      RSVP Now
    </a>
  </div>

  <p style="color: #666; font-size: 14px; text-align: center;">
    Sent via <a href="https://shindig.app" style="color: #c026d3;">Shindig</a>
  </p>
</body>
</html>`,
  };
}
