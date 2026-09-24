import mongoose, { Schema, Document } from "mongoose";

export interface IEmployeeFieldChangeRequest extends Document {
  employeeId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;

  // Field information
  sectionKey: string;
  fieldKey: string;
  fieldLabel: string;
  innerSectionKey?: string;

  // Change details
  oldValue: any;
  newValue: any;

  // Status and approval
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;

  // Metadata
  requestedBy: mongoose.Types.ObjectId; // Employee who made the change
  reviewedBy?: mongoose.Types.ObjectId; // Employer who approved/rejected
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const employeeFieldChangeRequestSchema =
  new Schema<IEmployeeFieldChangeRequest>(
    {
      employeeId: {
        type: Schema.Types.ObjectId,
        ref: "EmployeeProfile",
        required: true,
      },
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
      sectionKey: {
        type: String,
        required: true,
      },
      fieldKey: {
        type: String,
        required: true,
      },
      fieldLabel: {
        type: String,
        required: true,
      },
      innerSectionKey: {
        type: String,
      },
      oldValue: {
        type: Schema.Types.Mixed,
        required: true,
      },
      newValue: {
        type: Schema.Types.Mixed,
        required: true,
      },
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
      rejectionReason: {
        type: String,
      },
      requestedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      reviewedAt: {
        type: Date,
      },
    },
    {
      timestamps: true,
    }
  );

// Indexes for efficient queries
employeeFieldChangeRequestSchema.index({ employeeId: 1, status: 1 });
employeeFieldChangeRequestSchema.index({ tenantId: 1, branchId: 1, status: 1 });
employeeFieldChangeRequestSchema.index({ requestedBy: 1, status: 1 });

export const EmployeeFieldChangeRequest =
  mongoose.model<IEmployeeFieldChangeRequest>(
    "EmployeeFieldChangeRequest",
    employeeFieldChangeRequestSchema
  );
