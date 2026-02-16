"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <h1 className="text-6xl font-bold text-gray-200 mb-4">Oops</h1>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
      <p className="text-gray-600 mb-6">An unexpected error occurred.</p>
      <button
        onClick={reset}
        className="bg-shindig-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-shindig-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
