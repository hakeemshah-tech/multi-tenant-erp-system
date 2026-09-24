import mongoose, { Schema, Document } from "mongoose";

export interface IDesignation extends Document {
  tenantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  departmentIds: mongoose.Types.ObjectId[]; // ➕ Multiple departments
  roleIds: string[]; // ➕ Multiple roles (roleId strings, not ObjectIds)
  name: string;
  description?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const designationSchema = new Schema<IDesignation>(
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
    departmentIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Department",
        required: true,
      },
    ],
    roleIds: {
      type: [String],
      default: [],
      required: false,
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

// 🔹 Indexes for fast lookup
designationSchema.index({ tenantId: 1, branchId: 1 });
// Unique index to prevent duplicate job title names within the same tenant and branch (case-insensitive)
designationSchema.index(
  { tenantId: 1, branchId: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false },
  }
);

export const Designation = mongoose.model<IDesignation>(
  "Designation",
  designationSchema
);
