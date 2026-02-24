/**
 * Email Templates
 *
 * This module exports all email templates for clean imports.
 *
 * Usage:
 *   import { renderInvitation, renderInvitationHtml } from '@/lib/email-templates';
 *   import { renderReminder, renderReminderHtml } from '@/lib/email-templates';
 */

// Invitation template
export {
  renderInvitation,
  renderInvitationHtml,
  renderInvitationText,
  getInvitationSubject,
  type InvitationEmailProps,
} from "./invitation";

// Reminder template
export {
  renderReminder,
  renderReminderHtml,
  renderReminderText,
  getReminderSubject,
  type ReminderEmailProps,
} from "./reminder";
