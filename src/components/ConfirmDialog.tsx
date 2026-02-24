"use client";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  details?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  details,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const confirmButtonClass =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-shindig-600 hover:bg-shindig-700 text-white";

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
      data-testid="confirm-dialog"
    >
      <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
        {/* Header */}
        <div className="p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        </div>

        {/* Content */}
        <div className="p-5">
          <p className="text-gray-600 mb-4">{message}</p>
          {details && <div className="text-sm text-gray-500">{details}</div>}
        </div>

        {/* Actions */}
        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
            data-testid="confirm-dialog-cancel"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 ${confirmButtonClass}`}
            data-testid="confirm-dialog-confirm"
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
            {loading ? "Sending..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
