"use client";

import { useState } from "react";
import ConfirmDialog from "./ConfirmDialog";
import { ToastContainer, useToast } from "./Toast";
import type { Guest } from "@/lib/types";

interface ReminderButtonProps {
  eventId: string;
  guests: Guest[];
}

export default function ReminderButton({ eventId, guests }: ReminderButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toasts, addToast, dismissToast } = useToast();

  // Filter to pending guests with email addresses
  const pendingGuestsWithEmail = guests.filter(
    (g) => g.rsvp_status === "pending" && g.email
  );
  const pendingCount = pendingGuestsWithEmail.length;
  const isDisabled = pendingCount === 0;

  async function handleSend() {
    setLoading(true);

    try {
      const res = await fetch(`/api/events/manage/${eventId}/remind`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        if (data.failed > 0) {
          addToast("error", `Sent ${data.sent}, ${data.failed} failed`);
        } else {
          addToast("success", `Sent ${data.sent} reminder${data.sent !== 1 ? "s" : ""}`);
        }
        // Refresh the page to update the guest list with reminded_at timestamps
        window.location.reload();
      } else {
        addToast("error", data.error || "Failed to send reminders");
      }
    } catch {
      addToast("error", "Failed to send reminders");
    } finally {
      setLoading(false);
      setShowDialog(false);
    }
  }

  // Build guest summary for the dialog
  const guestSummary =
    pendingCount > 0 ? (
      <div className="max-h-32 overflow-y-auto border rounded-lg p-3 bg-gray-50">
        <ul className="space-y-1">
          {pendingGuestsWithEmail.slice(0, 10).map((guest) => (
            <li key={guest.id} className="flex items-center gap-2">
              <span className="w-2 h-2 bg-shindig-400 rounded-full" />
              <span className="truncate">
                {guest.name} ({guest.email})
              </span>
            </li>
          ))}
          {pendingCount > 10 && (
            <li className="text-gray-500 italic pl-4">
              ...and {pendingCount - 10} more
            </li>
          )}
        </ul>
      </div>
    ) : null;

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        disabled={isDisabled || loading}
        className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
        data-testid="send-reminders-button"
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        Send Reminders{pendingCount > 0 ? ` (${pendingCount})` : ""}
      </button>

      <ConfirmDialog
        isOpen={showDialog}
        title="Send Reminders"
        message={
          pendingCount > 0
            ? `Send reminder emails to ${pendingCount} guest${pendingCount !== 1 ? "s" : ""} who haven't responded?`
            : "No pending guests with email addresses to remind."
        }
        details={guestSummary}
        confirmLabel="Send"
        cancelLabel="Cancel"
        loading={loading}
        onConfirm={handleSend}
        onCancel={() => setShowDialog(false)}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
