"use client";

import type { CustomField, CustomFieldConfig } from "@/lib/types";

// SignupClaims maps field_id -> option -> claim count
export type SignupClaims = Record<string, Record<string, number>>;

interface CustomFieldInputProps {
  field: CustomField;
  value: string;
  onChange: (value: string) => void;
  signupClaims?: SignupClaims;
  disabled?: boolean;
}

/**
 * Renders the appropriate input for a custom field type.
 * - text: text input or textarea
 * - poll (single-select): radio buttons
 * - poll (multi-select): checkboxes
 * - signup: checkboxes with claim counts, disabled when fully claimed
 */
export default function CustomFieldInput({
  field,
  value,
  onChange,
  signupClaims,
  disabled = false,
}: CustomFieldInputProps) {
  const isRequired = field.required;
  const config = field.config as CustomFieldConfig;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {field.label}
        {isRequired && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {field.description && (
        <p className="text-sm text-gray-500">{field.description}</p>
      )}

      {field.type === "text" && (
        <TextFieldInput
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={isRequired}
        />
      )}

      {field.type === "poll" && (
        <PollFieldInput
          options={field.options || []}
          value={value}
          onChange={onChange}
          multiSelect={config.multi_select ?? false}
          disabled={disabled}
          required={isRequired}
        />
      )}

      {field.type === "signup" && (
        <SignupFieldInput
          fieldId={field.id}
          options={field.options || []}
          value={value}
          onChange={onChange}
          maxClaimsPerItem={config.max_claims_per_item ?? 1}
          signupClaims={signupClaims}
          disabled={disabled}
        />
      )}
    </div>
  );
}

interface TextFieldInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
}

function TextFieldInput({ value, onChange, disabled, required }: TextFieldInputProps) {
  // Use textarea for longer answers (if value is already long or we expect longer input)
  const isLongAnswer = value.length > 100;

  if (isLongAnswer) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        rows={3}
        maxLength={1000}
        placeholder="Your answer..."
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none resize-y disabled:bg-gray-100 disabled:cursor-not-allowed"
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required={required}
      maxLength={1000}
      placeholder="Your answer..."
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shindig-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
    />
  );
}

interface PollFieldInputProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  multiSelect: boolean;
  disabled?: boolean;
  required?: boolean;
}

function PollFieldInput({
  options,
  value,
  onChange,
  multiSelect,
  disabled,
  required,
}: PollFieldInputProps) {
  // Parse comma-separated values for multi-select
  const selectedValues = value ? value.split(",").map((v) => v.trim()).filter(Boolean) : [];

  function handleSingleChange(option: string) {
    onChange(option);
  }

  function handleMultiChange(option: string, checked: boolean) {
    let newValues: string[];
    if (checked) {
      newValues = [...selectedValues, option];
    } else {
      newValues = selectedValues.filter((v) => v !== option);
    }
    onChange(newValues.join(", "));
  }

  if (multiSelect) {
    return (
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option}
            className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
              selectedValues.includes(option)
                ? "border-shindig-500 bg-shindig-50"
                : "border-gray-200 hover:border-gray-300"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <input
              type="checkbox"
              checked={selectedValues.includes(option)}
              onChange={(e) => handleMultiChange(option, e.target.checked)}
              disabled={disabled}
              className="rounded border-gray-300 text-shindig-600 focus:ring-shindig-500"
            />
            <span className="text-gray-700">{option}</span>
          </label>
        ))}
        {required && selectedValues.length === 0 && (
          <input type="text" required className="sr-only" tabIndex={-1} />
        )}
      </div>
    );
  }

  // Single-select: radio buttons
  return (
    <div className="space-y-2">
      {options.map((option) => (
        <label
          key={option}
          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
            value === option
              ? "border-shindig-500 bg-shindig-50"
              : "border-gray-200 hover:border-gray-300"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input
            type="radio"
            name={`poll-${option}`}
            checked={value === option}
            onChange={() => handleSingleChange(option)}
            disabled={disabled}
            required={required}
            className="border-gray-300 text-shindig-600 focus:ring-shindig-500"
          />
          <span className="text-gray-700">{option}</span>
        </label>
      ))}
    </div>
  );
}

interface SignupFieldInputProps {
  fieldId: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  maxClaimsPerItem: number;
  signupClaims?: SignupClaims;
  disabled?: boolean;
}

function SignupFieldInput({
  fieldId,
  options,
  value,
  onChange,
  maxClaimsPerItem,
  signupClaims,
  disabled,
}: SignupFieldInputProps) {
  // Parse comma-separated values for current selection
  const selectedValues = value ? value.split(",").map((v) => v.trim()).filter(Boolean) : [];
  const fieldClaims = signupClaims?.[fieldId] || {};

  function handleChange(option: string, checked: boolean) {
    let newValues: string[];
    if (checked) {
      newValues = [...selectedValues, option];
    } else {
      newValues = selectedValues.filter((v) => v !== option);
    }
    onChange(newValues.join(", "));
  }

  return (
    <div className="space-y-2">
      {options.map((option) => {
        const currentClaims = fieldClaims[option] || 0;
        // If this guest has already claimed this option, don't count them in the display
        const isCurrentlySelected = selectedValues.includes(option);
        const displayClaims = isCurrentlySelected ? currentClaims : currentClaims;
        const isFullyClaimed = currentClaims >= maxClaimsPerItem && !isCurrentlySelected;
        const claimsText = `${displayClaims}/${maxClaimsPerItem} claimed`;

        return (
          <label
            key={option}
            className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
              isCurrentlySelected
                ? "border-shindig-500 bg-shindig-50"
                : isFullyClaimed
                ? "border-gray-200 bg-gray-50 opacity-60"
                : "border-gray-200 hover:border-gray-300 cursor-pointer"
            } ${disabled || isFullyClaimed ? "cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isCurrentlySelected}
                onChange={(e) => handleChange(option, e.target.checked)}
                disabled={disabled || isFullyClaimed}
                className="rounded border-gray-300 text-shindig-600 focus:ring-shindig-500 disabled:opacity-50"
              />
              <span className={`${isFullyClaimed ? "text-gray-400" : "text-gray-700"}`}>
                {option}
              </span>
            </div>
            <span
              className={`text-sm ${
                isFullyClaimed ? "text-red-500" : "text-gray-500"
              }`}
            >
              {claimsText}
            </span>
          </label>
        );
      })}
    </div>
  );
}
