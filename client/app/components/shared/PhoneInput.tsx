"use client";

import { forwardRef, useCallback } from "react";
import PhoneInputWithCountry from "react-phone-number-input";
import "react-phone-number-input/style.css";
import type { E164Number } from "react-phone-number-input";
import { cn } from "@/lib/utils";
import { parsePhoneNumber } from "react-phone-number-input";

interface PhoneInputProps {
  value?: string;
  onChange?: (value: E164Number | undefined) => void;
  onBlur?: () => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
  defaultCountry?: "AU" | string;
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      value,
      onChange,
      onBlur,
      placeholder = "Enter phone number",
      label,
      required = false,
      disabled = false,
      className,
      error,
      defaultCountry = "AU",
    },
    ref
  ) => {
    // Prevent deletion of country code
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Prevent backspace/delete if it would remove the country code
        if (e.key === "Backspace" || e.key === "Delete") {
          const input = e.currentTarget;
          const selectionStart = input.selectionStart || 0;
          const selectionEnd = input.selectionEnd || 0;

          // Get the current value as displayed in the input
          const currentValue = input.value || "";

          // If there's a text selection, allow deletion
          if (selectionStart !== selectionEnd) {
            return;
          }

          // Find the country code part (starts with + and digits)
          // The library displays it as "+XX " where XX is the country code
          const countryCodePattern = /^\+[\d\s]+/;
          const match = currentValue.match(countryCodePattern);

          if (match) {
            const countryCodeLength = match[0].length;

            // If cursor is within the country code area, prevent deletion
            // Allow deletion only if cursor is after the country code
            if (selectionStart < countryCodeLength) {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
          } else if (currentValue.startsWith("+")) {
            // If value starts with + but pattern doesn't match, still protect it
            if (selectionStart <= 1) {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
          }
        }
      },
      []
    );

    // Ensure country code is always present in the value
    const handleChange = useCallback(
      (val: E164Number | undefined) => {
        // The library should handle this, but add a safeguard
        // Only pass through valid E.164 format numbers (must start with +)
        if (val && !val.startsWith("+") && val.length > 0) {
          // If somehow we get a value without +, try to add the country code
          const countryCode = defaultCountry === "AU" ? "+61" : "+1";
          const formatted = countryCode + val.replace(/^\+?/, "");
          onChange?.(formatted as E164Number);
          return;
        }

        // Pass through the value (can be undefined for empty)
        onChange?.(val);
      },
      [onChange, defaultCountry]
    );

    return (
      <div className={cn("w-full", className)}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div
          className={cn(
            "relative",
            error && "border-red-500",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <PhoneInputWithCountry
            international
            defaultCountry={defaultCountry as any}
            value={value as E164Number}
            onChange={handleChange}
            onBlur={onBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm placeholder-gray-400 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
              error && "border-red-500 focus:ring-red-500"
            )}
            numberInputProps={{
              className: cn(
                "w-full border-none outline-none bg-transparent",
                disabled && "cursor-not-allowed"
              ),
              onKeyDown: handleKeyDown,
            }}
            countrySelectProps={{
              className:
                "border-none outline-none bg-transparent pr-2 focus:outline-none",
            }}
          />
        </div>
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>
    );
  }
);

PhoneInput.displayName = "PhoneInput";
