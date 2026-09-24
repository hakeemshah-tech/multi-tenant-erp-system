"use client";

import { useState, forwardRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordInputProps {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
  name?: string;
  showValidation?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      value = "",
      onChange,
      onBlur,
      placeholder = "Enter Password",
      label,
      required = false,
      disabled = false,
      className,
      error,
      name = "password",
      showValidation = false,
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);

    // Password validation rules
    const validations = {
      minLength: value.length >= 8,
      hasUpperCase: /[A-Z]/.test(value),
      hasLowerCase: /[a-z]/.test(value),
      hasNumber: /[0-9]/.test(value),
      hasSymbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value),
    };

    const allValid = Object.values(validations).every((v) => v);

    return (
      <div className={cn("w-full", className)}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            type={showPassword ? "text" : "password"}
            name={name}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "w-full border border-gray-200 bg-white rounded-xl px-4 py-3 pr-12 text-sm placeholder-gray-400 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
              error && "border-red-500 focus:ring-red-500",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
            tabIndex={-1}
            disabled={disabled}
          >
            {showPassword ? (
              <EyeOff size={20} className="cursor-pointer" />
            ) : (
              <Eye size={20} className="cursor-pointer" />
            )}
          </button>
        </div>
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        {showValidation && value && (
          <div className="mt-2 space-y-1">
            <p className="text-xs font-medium text-gray-700 mb-1">
              Password Requirements:
            </p>
            <div className="space-y-0.5 text-xs">
              <div
                className={cn(
                  "flex items-center gap-2",
                  validations.minLength ? "text-green-600" : "text-gray-500"
                )}
              >
                <span>{validations.minLength ? "✓" : "○"}</span>
                <span>At least 8 characters</span>
              </div>
              <div
                className={cn(
                  "flex items-center gap-2",
                  validations.hasUpperCase ? "text-green-600" : "text-gray-500"
                )}
              >
                <span>{validations.hasUpperCase ? "✓" : "○"}</span>
                <span>One uppercase letter (A-Z)</span>
              </div>
              <div
                className={cn(
                  "flex items-center gap-2",
                  validations.hasLowerCase ? "text-green-600" : "text-gray-500"
                )}
              >
                <span>{validations.hasLowerCase ? "✓" : "○"}</span>
                <span>One lowercase letter (a-z)</span>
              </div>
              <div
                className={cn(
                  "flex items-center gap-2",
                  validations.hasNumber ? "text-green-600" : "text-gray-500"
                )}
              >
                <span>{validations.hasNumber ? "✓" : "○"}</span>
                <span>One number (0-9)</span>
              </div>
              <div
                className={cn(
                  "flex items-center gap-2",
                  validations.hasSymbol ? "text-green-600" : "text-gray-500"
                )}
              >
                <span>{validations.hasSymbol ? "✓" : "○"}</span>
                <span>One symbol (!@#$%^&*...)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
