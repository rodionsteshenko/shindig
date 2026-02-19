"use client";

import { useState } from "react";
import EmailPreviewModal from "./EmailPreviewModal";

interface PreviewInvitationButtonProps {
  eventId: string;
  eventTitle: string;
}

export default function PreviewInvitationButton({
  eventId,
  eventTitle,
}: PreviewInvitationButtonProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowPreview(true)}
        className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
      >
        Preview Invitation
      </button>

      <EmailPreviewModal
        isOpen={showPreview}
        eventId={eventId}
        eventTitle={eventTitle}
        onClose={() => setShowPreview(false)}
      />
    </>
  );
}
