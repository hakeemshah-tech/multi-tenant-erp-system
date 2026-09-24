import mongoose, { Schema, Document, Types } from "mongoose";

export interface IContractTemplateApproval extends Document {
  templateId: Types.ObjectId;
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  employeeId: Types.ObjectId;
  applicantId?: Types.ObjectId; // The employee whose contract is being sent for approval
  requireSignature: boolean;
  signatureType?: "typed" | "drawn" | "upload";
  status: "pending" | "approved" | "rejected";
  respondedAt?: Date;
  // Self Sign Required fields - enables sender to sign from Contract Approvals
  selfSignRequired?: boolean;
  senderUserId?: Types.ObjectId; // The user who sent the approval
  senderSignatureData?: string; // The sender's signature (base64)
  senderSignedAt?: Date; // When sender signed
  createdAt?: Date;
  updatedAt?: Date;
}

const contractTemplateApprovalSchema = new Schema<IContractTemplateApproval>(
  {
    templateId: {
      type: Schema.Types.ObjectId,
      ref: "ContractTemplate",
      required: true,
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    applicantId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: false,
      index: true,
    },
    requireSignature: {
      type: Boolean,
      default: false,
    },
    signatureType: {
      type: String,
      enum: ["typed", "drawn", "upload"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    respondedAt: {
      type: Date,
    },
    // Self Sign Required fields
    selfSignRequired: {
      type: Boolean,
      default: false,
    },
    senderUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    senderSignatureData: {
      type: String,
    },
    senderSignedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicate approvals for same template+employee+applicant
// This ensures each applicant can only have one pending approval per template+employee combination
contractTemplateApprovalSchema.index(
  { templateId: 1, employeeId: 1, applicantId: 1 },
  { unique: true }
);

// Index for efficient querying by template and status
contractTemplateApprovalSchema.index({ templateId: 1, status: 1 });

export const ContractTemplateApproval =
  mongoose.model<IContractTemplateApproval>(
    "ContractTemplateApproval",
    contractTemplateApprovalSchema,
    "contract_template_approvals"
  );
