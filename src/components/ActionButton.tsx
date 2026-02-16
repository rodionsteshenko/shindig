"use client";

import { useState } from "react";

interface ActionButtonProps {
  label: string;
  endpoint: string;
  method?: string;
  disabled?: boolean;
  confirmMessage: string;
  variant?: "default" | "danger";
  redirectTo?: string;
}

export default function ActionButton({
  label,
  endpoint,
  method = "POST",
  disabled = false,
  confirmMessage,
  variant = "default",
  redirectTo,
}: ActionButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!confirm(confirmMessage)) return;

    setLoading(true);
    const res = await fetch(endpoint, { method });
    setLoading(false);

    if (res.ok) {
      if (redirectTo) {
        window.location.href = redirectTo;
      } else {
        const data = await res.json();
        alert(data.sent !== undefined ? `Sent: ${data.sent}, Failed: ${data.failed}` : "Done!");
      }
    } else {
      const data = await res.json();
      alert(data.error || "Something went wrong");
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
        variant === "danger"
          ? "border border-red-300 text-red-600 hover:bg-red-50"
          : "border border-gray-300 text-gray-700 hover:bg-gray-50"
      }`}
    >
      {loading ? "..." : label}
    </button>
  );
}
