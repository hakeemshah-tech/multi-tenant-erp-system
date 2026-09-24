// src/app/auth/auth.validation.ts
import { z } from "zod";

export const registerTenantSchema = z.object({
  companyName: z
    .string()
    .min(2, "Company name must be at least 2 characters long"),

  companyLocation: z
    .string()
    .min(2, "Company location must be at least 2 characters long"),

  employeeCount: z.string().min(1, "Please select employee count"),

  businessCategory: z
    .string()
    .regex(
      /^[a-f\d]{24}$/i,
      "Invalid business category ID (must be a Mongo ObjectId)"
    ),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const registerUserSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  phone: z
    .string()
    .min(1, "Phone number is required")
    .regex(
      /^\+[1-9]\d{1,14}$/,
      "Invalid phone number format (must be E.164 format)"
    ),
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
      "Password must contain at least one symbol"
    ),
});

export const updateModeSchema = z.object({
  currentMode: z.enum(["nexus-profile", "organization", "newbie"]),
});

export const verifyOTPSchema = z.object({
  email: z.string().email("Invalid email format"),
  code: z
    .string()
    .length(6, "OTP code must be 6 digits")
    .regex(/^\d+$/, "OTP code must contain only numbers"),
});

export const resendOTPSchema = z.object({
  email: z.string().email("Invalid email format"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
  code: z
    .string()
    .length(6, "OTP code must be 6 digits")
    .regex(/^\d+$/, "OTP code must contain only numbers"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
      "Password must contain at least one symbol"
    ),
});

export const switchOrganizationContextSchema = z.object({
  branchId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, "Invalid branch ID (must be a Mongo ObjectId)"),
});
