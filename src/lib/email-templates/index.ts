/**
 * Email Templates
 *
 * This module exports all email templates for clean imports.
 *
 * Usage:
 *   import { renderInvitation, renderInvitationHtml } from '@/lib/email-templates';
 */

// Invitation template
export {
  renderInvitation,
  renderInvitationHtml,
  renderInvitationText,
  getInvitationSubject,
  type InvitationEmailProps,
} from "./invitation";
