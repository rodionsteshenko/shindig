"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useCallback, useEffect, useState } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something...",
  className = "",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-shindig-600 underline hover:text-shindig-700",
        },
      }),
    ],
    content: value,
    immediatelyRender: false, // Required for SSR compatibility
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[120px] px-4 py-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync external value changes (e.g., form reset)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        className={`border border-gray-300 rounded-lg bg-gray-50 min-h-[168px] ${className}`}
      />
    );
  }

  return (
    <div
      className={`border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-shindig-500 focus-within:border-transparent ${className}`}
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      {editor.isEmpty && (
        <div className="absolute pointer-events-none text-gray-400 px-4 py-3 top-[44px]">
          {placeholder}
        </div>
      )}
    </div>
  );
}

interface ToolbarProps {
  editor: ReturnType<typeof useEditor>;
}

function Toolbar({ editor }: ToolbarProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);

  const setLink = useCallback(() => {
    if (!editor || !linkUrl.trim()) {
      setShowLinkInput(false);
      setLinkUrl("");
      return;
    }

    // Add https:// if no protocol specified
    const url = linkUrl.match(/^https?:\/\//) ? linkUrl : `https://${linkUrl}`;

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();

    setShowLinkInput(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  const removeLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
  }, [editor]);

  const toggleLink = useCallback(() => {
    if (!editor) return;

    if (editor.isActive("link")) {
      removeLink();
    } else {
      // Get the currently selected text's URL if any
      const attrs = editor.getAttributes("link");
      if (attrs.href) {
        setLinkUrl(attrs.href);
      }
      setShowLinkInput(true);
    }
  }, [editor, removeLink]);

  if (!editor) return null;

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-200 bg-gray-50 flex-wrap">
      {/* Bold */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold"
        aria-label="Toggle bold"
      >
        <BoldIcon />
      </ToolbarButton>

      {/* Italic */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic"
        aria-label="Toggle italic"
      >
        <ItalicIcon />
      </ToolbarButton>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Heading 2 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
        aria-label="Toggle heading 2"
      >
        <H2Icon />
      </ToolbarButton>

      {/* Heading 3 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
        aria-label="Toggle heading 3"
      >
        <H3Icon />
      </ToolbarButton>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Bullet List */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Bullet list"
        aria-label="Toggle bullet list"
      >
        <BulletListIcon />
      </ToolbarButton>

      {/* Ordered List */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Numbered list"
        aria-label="Toggle numbered list"
      >
        <OrderedListIcon />
      </ToolbarButton>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Link */}
      <ToolbarButton
        onClick={toggleLink}
        isActive={editor.isActive("link")}
        title="Link"
        aria-label="Toggle link"
      >
        <LinkIcon />
      </ToolbarButton>

      {/* Link URL Input */}
      {showLinkInput && (
        <div className="flex items-center gap-1 ml-1">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setLink();
              } else if (e.key === "Escape") {
                setShowLinkInput(false);
                setLinkUrl("");
              }
            }}
            placeholder="https://..."
            className="px-2 py-0.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-shindig-500 focus:border-transparent outline-none w-40"
            autoFocus
          />
          <button
            type="button"
            onClick={setLink}
            className="px-2 py-0.5 text-xs font-medium text-white bg-shindig-600 rounded hover:bg-shindig-700"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setShowLinkInput(false);
              setLinkUrl("");
            }}
            className="px-2 py-0.5 text-xs font-medium text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive: boolean;
  title: string;
  children: React.ReactNode;
  "aria-label": string;
}

function ToolbarButton({
  onClick,
  isActive,
  title,
  children,
  "aria-label": ariaLabel,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={`p-1.5 rounded transition-colors ${
        isActive
          ? "bg-shindig-100 text-shindig-700"
          : "text-gray-600 hover:bg-gray-200 hover:text-gray-800"
      }`}
    >
      {children}
    </button>
  );
}

// SVG Icons

function BoldIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 4h8a4 4 0 0 1 0 8H6V4z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 12h9a4 4 0 0 1 0 8H6v-8z"
      />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h6m-3 0l-4 16m0 0h6" />
    </svg>
  );
}

function H2Icon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <text x="2" y="17" fontSize="14" fontWeight="bold">
        H2
      </text>
    </svg>
  );
}

function H3Icon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <text x="2" y="17" fontSize="14" fontWeight="bold">
        H3
      </text>
    </svg>
  );
}

function BulletListIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6h.01M8 6h12M4 12h.01M8 12h12M4 18h.01M8 18h12"
      />
    </svg>
  );
}

function OrderedListIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M4 5V4h1v3H4V5zm1 8V9H3v1h1v1H3v1h3v-1H5v-1h1v-1H5zm-1 5v2H3v1h3v-1H4v-1h1v-1H3v1h1z" />
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 6h11M9 12h11M9 18h11"
      />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  );
}
