"use client";

import { useState } from "react";
import type { CustomFieldType, CustomFieldConfig } from "@/lib/types";

// Local state type for custom field builder (matches API shape but uses local IDs for new fields)
export interface CustomFieldBuilderItem {
  id?: string; // Only set for existing fields being edited
  localId: string; // Client-side ID for React keys
  type: CustomFieldType;
  label: string;
  description: string;
  required: boolean;
  options: string[];
  config: CustomFieldConfig;
}

interface CustomFieldBuilderProps {
  fields: CustomFieldBuilderItem[];
  onChange: (fields: CustomFieldBuilderItem[]) => void;
  maxFields?: number;
}

const MAX_FIELDS_DEFAULT = 10;

type FieldTypeOption = {
  type: CustomFieldType;
  label: string;
  description: string;
  icon: string;
};

const FIELD_TYPES: FieldTypeOption[] = [
  {
    type: "text",
    label: "Text Question",
    description: "Free-form text response",
    icon: "📝",
  },
  {
    type: "poll",
    label: "Poll",
    description: "Single or multi-choice options",
    icon: "📊",
  },
  {
    type: "signup",
    label: "Signup List",
    description: "Items guests can claim",
    icon: "✋",
  },
];

function generateLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createNewField(type: CustomFieldType): CustomFieldBuilderItem {
  return {
    localId: generateLocalId(),
    type,
    label: "",
    description: "",
    required: false,
    options: type === "text" ? [] : ["Option 1", "Option 2"],
    config: type === "poll" ? { multi_select: false } : type === "signup" ? { max_claims_per_item: 1 } : {},
  };
}

export default function CustomFieldBuilder({
  fields,
  onChange,
  maxFields = MAX_FIELDS_DEFAULT,
}: CustomFieldBuilderProps) {
  const [isExpanded, setIsExpanded] = useState(fields.length > 0);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const canAddField = fields.length < maxFields;

  function handleAddField(type: CustomFieldType) {
    if (!canAddField) return;
    const newField = createNewField(type);
    onChange([...fields, newField]);
    setShowTypePicker(false);
  }

  function handleRemoveField(localId: string) {
    onChange(fields.filter((f) => f.localId !== localId));
  }

  function handleFieldChange(localId: string, updates: Partial<CustomFieldBuilderItem>) {
    onChange(
      fields.map((f) => (f.localId === localId ? { ...f, ...updates } : f))
    );
  }

  function handleMoveUp(index: number) {
    if (index === 0) return;
    const newFields = [...fields];
    [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
    onChange(newFields);
  }

  function handleMoveDown(index: number) {
    if (index === fields.length - 1) return;
    const newFields = [...fields];
    [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
    onChange(newFields);
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">Custom Questions</span>
          {fields.length > 0 && (
            <span className="bg-shindig-100 text-shindig-700 text-xs px-2 py-0.5 rounded-full">
              {fields.length}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Field List */}
          {fields.map((field, index) => (
            <FieldCard
              key={field.localId}
              field={field}
              index={index}
              totalFields={fields.length}
              onUpdate={(updates) => handleFieldChange(field.localId, updates)}
              onRemove={() => handleRemoveField(field.localId)}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
            />
          ))}

          {/* Empty State */}
          {fields.length === 0 && !showTypePicker && (
            <p className="text-gray-500 text-sm text-center py-4">
              No custom questions yet. Add one to collect extra info from your guests.
            </p>
          )}

          {/* Type Picker */}
          {showTypePicker && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <p className="text-sm font-medium text-gray-700 mb-3">Choose question type:</p>
              <div className="grid grid-cols-3 gap-3">
                {FIELD_TYPES.map((ft) => (
                  <button
                    key={ft.type}
                    type="button"
                    onClick={() => handleAddField(ft.type)}
                    className="flex flex-col items-center p-3 border border-gray-200 rounded-lg bg-white hover:border-shindig-400 hover:bg-shindig-50 transition-colors"
                  >
                    <span className="text-2xl mb-1">{ft.icon}</span>
                    <span className="text-sm font-medium text-gray-700">{ft.label}</span>
                    <span className="text-xs text-gray-500">{ft.description}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowTypePicker(false)}
                className="mt-3 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Add Button */}
          {!showTypePicker && (
            <button
              type="button"
              onClick={() => setShowTypePicker(true)}
              disabled={!canAddField}
              className={`w-full py-2 border-2 border-dashed rounded-lg text-sm font-medium transition-colors ${
                canAddField
                  ? "border-gray-300 text-gray-600 hover:border-shindig-400 hover:text-shindig-600"
                  : "border-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {canAddField
                ? "+ Add a question"
                : `Maximum ${maxFields} questions reached`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface FieldCardProps {
  field: CustomFieldBuilderItem;
  index: number;
  totalFields: number;
  onUpdate: (updates: Partial<CustomFieldBuilderItem>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function FieldCard({
  field,
  index,
  totalFields,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: FieldCardProps) {
  const typeInfo = FIELD_TYPES.find((ft) => ft.type === field.type);

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      {/* Field Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-lg">{typeInfo?.icon}</span>
          <span className="text-sm font-medium text-gray-600">{typeInfo?.label}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Reorder Buttons */}
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move up"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === totalFields - 1}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move down"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {/* Delete Button */}
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-red-500"
            title="Remove question"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Field Body */}
      <div className="p-4 space-y-4">
        {/* Label Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Question *
          </label>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="e.g., What's your t-shirt size?"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Description Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <input
            type="text"
            value={field.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Add helpful context for your guests"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Type-specific fields */}
        {field.type === "poll" && (
          <PollOptions field={field} onUpdate={onUpdate} />
        )}

        {field.type === "signup" && (
          <SignupOptions field={field} onUpdate={onUpdate} />
        )}

        {/* Required Toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onUpdate({ required: e.target.checked })}
            className="rounded border-gray-300 text-shindig-600 focus:ring-shindig-500"
          />
          <span className="text-sm text-gray-700">Required</span>
        </label>
      </div>
    </div>
  );
}

interface OptionEditorProps {
  field: CustomFieldBuilderItem;
  onUpdate: (updates: Partial<CustomFieldBuilderItem>) => void;
}

function PollOptions({ field, onUpdate }: OptionEditorProps) {
  function handleOptionChange(index: number, value: string) {
    const newOptions = [...field.options];
    newOptions[index] = value;
    onUpdate({ options: newOptions });
  }

  function handleAddOption() {
    onUpdate({ options: [...field.options, `Option ${field.options.length + 1}`] });
  }

  function handleRemoveOption(index: number) {
    if (field.options.length <= 2) return; // Minimum 2 options
    onUpdate({ options: field.options.filter((_, i) => i !== index) });
  }

  function handleMultiSelectToggle(checked: boolean) {
    onUpdate({ config: { ...field.config, multi_select: checked } });
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Options
      </label>
      <div className="space-y-2">
        {field.options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={option}
              onChange={(e) => handleOptionChange(index, e.target.value)}
              placeholder={`Option ${index + 1}`}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
            />
            <button
              type="button"
              onClick={() => handleRemoveOption(index)}
              disabled={field.options.length <= 2}
              className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Remove option"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={handleAddOption}
        disabled={field.options.length >= 20}
        className="text-sm text-shindig-600 hover:text-shindig-700 disabled:text-gray-400 disabled:cursor-not-allowed"
      >
        + Add option
      </button>

      {/* Multi-select toggle */}
      <label className="flex items-center gap-2 cursor-pointer mt-2">
        <input
          type="checkbox"
          checked={field.config.multi_select ?? false}
          onChange={(e) => handleMultiSelectToggle(e.target.checked)}
          className="rounded border-gray-300 text-shindig-600 focus:ring-shindig-500"
        />
        <span className="text-sm text-gray-700">Allow multiple selections</span>
      </label>
    </div>
  );
}

function SignupOptions({ field, onUpdate }: OptionEditorProps) {
  function handleOptionChange(index: number, value: string) {
    const newOptions = [...field.options];
    newOptions[index] = value;
    onUpdate({ options: newOptions });
  }

  function handleAddOption() {
    onUpdate({ options: [...field.options, `Item ${field.options.length + 1}`] });
  }

  function handleRemoveOption(index: number) {
    if (field.options.length <= 2) return; // Minimum 2 options
    onUpdate({ options: field.options.filter((_, i) => i !== index) });
  }

  function handleMaxClaimsChange(value: number) {
    onUpdate({ config: { ...field.config, max_claims_per_item: Math.max(1, value) } });
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Signup Items
      </label>
      <div className="space-y-2">
        {field.options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={option}
              onChange={(e) => handleOptionChange(index, e.target.value)}
              placeholder={`Item ${index + 1}`}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
            />
            <button
              type="button"
              onClick={() => handleRemoveOption(index)}
              disabled={field.options.length <= 2}
              className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Remove item"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={handleAddOption}
        disabled={field.options.length >= 20}
        className="text-sm text-shindig-600 hover:text-shindig-700 disabled:text-gray-400 disabled:cursor-not-allowed"
      >
        + Add item
      </button>

      {/* Max signups per item */}
      <div className="flex items-center gap-2 mt-2">
        <label className="text-sm text-gray-700">Max signups per item:</label>
        <input
          type="number"
          min={1}
          max={100}
          value={field.config.max_claims_per_item ?? 1}
          onChange={(e) => handleMaxClaimsChange(parseInt(e.target.value, 10) || 1)}
          className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none"
        />
      </div>
    </div>
  );
}
