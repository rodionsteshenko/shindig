"use client";

import { useState } from "react";
import RichTextEditor from "@/components/RichTextEditor";

// Test page for RichTextEditor component
// This page is used by E2E tests to verify the editor functionality
export default function TestRichTextPage() {
  const [value, setValue] = useState("<p>Initial content</p>");

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Rich Text Editor Test</h1>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Editor
          </label>
          <RichTextEditor
            value={value}
            onChange={setValue}
            placeholder="Type something here..."
          />
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Current HTML Output</h2>
          <pre
            data-testid="html-output"
            className="bg-gray-100 p-4 rounded-lg text-sm overflow-auto max-h-40"
          >
            {value}
          </pre>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Rendered Preview</h2>
          <div
            data-testid="rendered-preview"
            className="prose prose-sm border border-gray-200 rounded-lg p-4"
            dangerouslySetInnerHTML={{ __html: value }}
          />
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setValue("")}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            data-testid="clear-button"
          >
            Clear Content
          </button>
          <button
            type="button"
            onClick={() => setValue("<p>Reset to default content</p>")}
            className="px-4 py-2 bg-shindig-600 text-white rounded hover:bg-shindig-700"
            data-testid="reset-button"
          >
            Reset Content
          </button>
        </div>
      </div>
    </main>
  );
}
