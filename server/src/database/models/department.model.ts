import mongoose, { Schema, Document } from "mongoose";

export interface IDepartment extends Document {
  tenantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const departmentSchema = new Schema<IDepartment>(
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

// 🔹 Indexes
departmentSchema.index({ tenantId: 1, branchId: 1 });
// Unique index to prevent duplicate department names within the same tenant and branch (case-insensitive)
departmentSchema.index(
  { tenantId: 1, branchId: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false },
  }
);

export const Department = mongoose.model<IDepartment>(
  "Department",
  departmentSchema
);
