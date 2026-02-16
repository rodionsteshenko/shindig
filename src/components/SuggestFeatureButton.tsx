"use client";

import Link from "next/link";

export default function SuggestFeatureButton() {
  return (
    <Link
      href="/features"
      className="fixed bottom-6 right-6 bg-shindig-600 text-white px-4 py-2.5 rounded-full shadow-lg hover:bg-shindig-700 transition-colors text-sm font-medium z-50"
    >
      Suggest a Feature
    </Link>
  );
}
