import mongoose, { Schema, Document } from "mongoose";

export interface IOTP extends Document {
  email: string;
  code: string;
  purpose: "email_verification" | "password_reset" | "other";
  expiresAt: Date;
  attempts: number;
  verified: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const OTPSchema = new Schema<IOTP>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ["email_verification", "password_reset", "other"],
      default: "email_verification",
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // Auto-delete expired documents
    },
    attempts: {
      type: Number,
      default: 0,
    },
    verified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Compound index for efficient lookups
OTPSchema.index({ email: 1, purpose: 1, verified: 1 });
OTPSchema.index({ email: 1, code: 1 });

export default mongoose.models.OTP || mongoose.model<IOTP>("OTP", OTPSchema);
