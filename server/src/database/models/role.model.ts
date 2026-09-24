import mongoose, { Schema, Document } from "mongoose";

export interface IRole extends Document {
  tenantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  roleId: string; // Unique identifier like "hr_manager", "payroll_officer"
  name: string; // Display name like "HR Manager"
  description?: string;
  color: string; // Color for UI display (purple, blue, green, etc.)
  level: number; // Employee level (1-7) - determines data access level
  isSystemRole: boolean; // true for system_admin, false for custom roles
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const roleSchema = new Schema<IRole>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    roleId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    color: {
      type: String,
      required: true,
      enum: ["purple", "blue", "green", "amber", "red", "pink", "teal", "gray"],
      default: "blue",
    },
    level: {
      type: Number,
      required: true,
      min: 1,
      max: 7,
      default: 1,
    },
    isSystemRole: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes
roleSchema.index({ tenantId: 1, branchId: 1 });
// Unique index to prevent duplicate roleIds within the same tenant and branch
roleSchema.index(
  { tenantId: 1, branchId: 1, roleId: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false },
  }
);

export const Role = mongoose.model<IRole>("Role", roleSchema);
