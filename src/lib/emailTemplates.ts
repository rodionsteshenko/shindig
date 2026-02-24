import { renderInvitation, renderReminder } from "@/lib/email-templates";

interface InviteEmailData {
  guestName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation?: string | null;
  eventDescription?: string | null;
  coverImageUrl?: string | null;
  calendarUrl?: string | null;
  hostName?: string;
  rsvpUrl: string;
}

export function invitationEmail(data: InviteEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const result = renderInvitation({
    eventTitle: data.eventTitle,
    eventDate: data.eventDate,
    eventTime: data.eventTime,
    eventLocation: data.eventLocation ?? null,
    eventDescription: data.eventDescription ?? null,
    coverImageUrl: data.coverImageUrl ?? null,
    rsvpUrl: data.rsvpUrl,
    calendarUrl: data.calendarUrl ?? null,
    hostName: data.hostName ?? "The host",
    guestName: data.guestName,
  });

  return {
    subject: result.subject,
    html: result.html,
    text: result.text,
  };
}

interface ReminderEmailData {
  guestName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation?: string | null;
  coverImageUrl?: string | null;
  hostName?: string;
  rsvpUrl: string;
}

export function reminderEmail(data: ReminderEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const result = renderReminder({
    eventTitle: data.eventTitle,
    eventDate: data.eventDate,
    eventTime: data.eventTime,
    eventLocation: data.eventLocation ?? null,
    coverImageUrl: data.coverImageUrl ?? null,
    rsvpUrl: data.rsvpUrl,
    hostName: data.hostName ?? "The host",
    guestName: data.guestName,
  });

  return {
    subject: result.subject,
    html: result.html,
    text: result.text,
  };
}
