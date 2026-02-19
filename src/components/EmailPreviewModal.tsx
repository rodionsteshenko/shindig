"use client";

import { useState, useEffect, useCallback } from "react";

interface EmailPreviewModalProps {
  isOpen: boolean;
  eventId: string;
  eventTitle: string;
  onClose: () => void;
}

type ViewportWidth = 320 | 600;

export default function EmailPreviewModal({
  isOpen,
  eventId,
  eventTitle,
  onClose,
}: EmailPreviewModalProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState<ViewportWidth>(600);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/manage/${eventId}/preview-email`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to load preview");
        return;
      }

      setHtml(data.html);
    } catch {
      setError("Failed to load preview");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (isOpen) {
      fetchPreview();
      setSendResult(null);
    }
  }, [isOpen, fetchPreview]);

  async function handleSendTest() {
    setSending(true);
    setSendResult(null);

    try {
      const res = await fetch(`/api/events/manage/${eventId}/preview-email`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setSendResult({
          success: false,
          message: data.error || "Failed to send test email",
        });
        return;
      }

      setSendResult({
        success: true,
        message: "Test email sent! Check your inbox.",
      });
    } catch {
      setSendResult({
        success: false,
        message: "Failed to send test email",
      });
    } finally {
      setSending(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Email Preview</h2>
            <p className="text-sm text-gray-500">{eventTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-3 border-b bg-gray-50 flex items-center justify-between gap-4 flex-wrap">
          {/* Viewport toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Preview:</span>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setViewportWidth(320)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewportWidth === 320
                    ? "bg-shindig-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
                aria-label="Mobile preview (320px)"
              >
                📱 Mobile
              </button>
              <button
                onClick={() => setViewportWidth(600)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewportWidth === 600
                    ? "bg-shindig-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
                aria-label="Desktop preview (600px)"
              >
                🖥️ Desktop
              </button>
            </div>
          </div>

          {/* Send test button */}
          <div className="flex items-center gap-3">
            {sendResult && (
              <span
                className={`text-sm ${
                  sendResult.success ? "text-green-600" : "text-red-600"
                }`}
              >
                {sendResult.message}
              </span>
            )}
            <button
              onClick={handleSendTest}
              disabled={sending || loading}
              className="bg-shindig-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-shindig-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? "Sending..." : "Send Test Email"}
            </button>
          </div>
        </div>

        {/* Preview content */}
        <div className="flex-1 overflow-auto p-4 bg-gray-100 flex justify-center">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading preview...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-red-600">{error}</div>
            </div>
          ) : html ? (
            <div
              className="bg-white shadow-lg transition-all duration-300"
              style={{ width: viewportWidth }}
            >
              <iframe
                srcDoc={html}
                title="Email Preview"
                className="w-full border-0"
                style={{ minHeight: 600, height: "auto" }}
                sandbox="allow-same-origin"
                onLoad={(e) => {
                  // Auto-resize iframe to content height
                  const iframe = e.target as HTMLIFrameElement;
                  if (iframe.contentDocument?.body) {
                    const height = iframe.contentDocument.body.scrollHeight;
                    iframe.style.height = `${height}px`;
                  }
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
