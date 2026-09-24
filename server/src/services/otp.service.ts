import OTPModel from "../database/models/OTP.model";
import { emailService } from "./email.service";

/**
 * Generate a random 6-digit OTP code
 */
function generateOTPCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create and send OTP for email verification
 */
export async function createAndSendOTP(
  email: string,
  purpose:
    "email_verification" | "password_reset" | "other" = "email_verification",
  userName?: string
): Promise<string> {
  // Validate email
  if (!email || typeof email !== "string" || email.trim().length === 0) {
    throw new Error("Email is required and must be a valid string");
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    throw new Error(`Invalid email format: ${email}`);
  }

  // Delete any existing unverified OTPs for this email and purpose
  await OTPModel.deleteMany({
    email: normalizedEmail,
    purpose,
    verified: false,
  });

  // Generate OTP code
  const code = generateOTPCode();

  // Set expiration to 10 minutes from now
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  // Save OTP to database
  await OTPModel.create({
    email: normalizedEmail,
    code,
    purpose,
    expiresAt,
    attempts: 0,
    verified: false,
  });

  // Send OTP via email based on purpose
  if (purpose === "email_verification") {
    await emailService.sendOTPEmail({
      email: normalizedEmail,
      otpCode: code,
      userName,
    });
  } else if (purpose === "password_reset") {
    await emailService.sendPasswordResetOTPEmail({
      email: normalizedEmail,
      otpCode: code,
      userName,
    });
  }

  return code;
}

/**
 * Verify OTP code
 */
export async function verifyOTP(
  email: string,
  code: string,
  purpose:
    "email_verification" | "password_reset" | "other" = "email_verification"
): Promise<{ valid: boolean; message: string }> {
  const normalizedEmail = email.toLowerCase();

  // Find the OTP
  const otp = await OTPModel.findOne({
    email: normalizedEmail,
    code,
    purpose,
    verified: false,
  });

  if (!otp) {
    return {
      valid: false,
      message: "Invalid or expired OTP code",
    };
  }

  // Check if expired
  if (new Date() > otp.expiresAt) {
    await OTPModel.deleteOne({ _id: otp._id });
    return {
      valid: false,
      message: "OTP code has expired. Please request a new one.",
    };
  }

  // Check attempts (max 5 attempts)
  if (otp.attempts >= 5) {
    await OTPModel.deleteOne({ _id: otp._id });
    return {
      valid: false,
      message: "Too many failed attempts. Please request a new OTP.",
    };
  }

  // Mark as verified
  otp.verified = true;
  await otp.save();

  return {
    valid: true,
    message: "OTP verified successfully",
  };
}

/**
 * Increment OTP attempt count (for failed verifications)
 */
export async function incrementOTPAttempts(
  email: string,
  code: string,
  purpose:
    "email_verification" | "password_reset" | "other" = "email_verification"
): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  await OTPModel.updateOne(
    {
      email: normalizedEmail,
      code,
      purpose,
      verified: false,
    },
    {
      $inc: { attempts: 1 },
    }
  );
}

/**
 * Clean up expired OTPs (can be called by a cron job)
 */
export async function cleanupExpiredOTPs(): Promise<number> {
  const result = await OTPModel.deleteMany({
    expiresAt: { $lt: new Date() },
  });
  return result.deletedCount || 0;
}
