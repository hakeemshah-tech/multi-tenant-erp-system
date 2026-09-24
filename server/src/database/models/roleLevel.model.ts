import mongoose, { Schema, Document } from "mongoose";

export interface IRoleLevel extends Document {
  tenantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  level: number; // 1, 2, 3, etc.
  name: string; // "Base Level - Worker", "Officer Level", etc.
  description?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const roleLevelSchema = new Schema<IRoleLevel>(
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
    level: {
      type: Number,
      required: true,
      min: 1,
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

// Indexes
roleLevelSchema.index({ tenantId: 1, branchId: 1 });
// Unique index to prevent duplicate levels within the same tenant and branch
roleLevelSchema.index(
  { tenantId: 1, branchId: 1, level: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false },
  }
);

export const RoleLevel = mongoose.model<IRoleLevel>(
  "RoleLevel",
  roleLevelSchema
);
