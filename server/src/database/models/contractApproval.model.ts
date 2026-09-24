import mongoose, { Schema, Document, Types } from "mongoose";

export interface IApprovalHistoryEntry {
  status: "pending" | "approved" | "rejected";
  note?: string;
  respondedAt?: Date;
  createdAt: Date;
}

export interface IApplicantHistoryEntry {
  status: "pending" | "accepted" | "rejected";
  note?: string;
  respondedAt?: Date;
  createdAt: Date;
}

export interface IEmployeeApproval {
  employeeId: Types.ObjectId;
  requireSignature: boolean;
  signatureType?: "typed" | "drawn" | "upload";
  signatureData?: string; // Base64 signature data
  status: "pending" | "approved" | "rejected" | "signed";
  respondedAt?: Date;
  note?: string; // Optional note/comment from the employee (current/latest)
  history?: IApprovalHistoryEntry[]; // Complete chronological history of all actions
}

export interface IContractApproval extends Document {
  templateId: Types.ObjectId;
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  applicantId: Types.ObjectId; // The employee whose contract is being sent for approval
  templateTitle?: string; // Title of the contract template
  employeeApprovals: IEmployeeApproval[]; // Array of employee approvals
  // Employer signature fields for self-sign flow
  employerSignatureData?: string; // Base64 signature data from employer self-sign
  employerSignedAt?: Date; // When employer self-signed
  employerName?: string; // Name of employer who signed
  signedByUserId?: Types.ObjectId; // User ID of who signed
  // Self Sign Required fields - for sender to sign from Contract Approvals page
  selfSignRequired?: boolean; // Whether sender needs to sign
  senderUserId?: Types.ObjectId; // The user who sent the approval (for matching current user)
  senderSignatureData?: string; // The sender's signature (base64)
  senderSignedAt?: Date; // When sender signed
  status?: "pending" | "approved" | "rejected"; // Overall approval status
  sentAt?: Date; // When approval was sent
  sentToApplicantAt?: Date; // Timestamp when contract was sent to applicant
  applicantStatus?: "pending" | "accepted" | "rejected"; // Applicant's response status (current/latest)
  acceptedAt?: Date; // Timestamp when applicant accepted the contract (latest)
  rejectedAt?: Date; // Timestamp when applicant rejected the contract (latest)
  applicantNote?: string; // Note/comment from the applicant (current/latest)
  applicantSignatureData?: string; // Base64 signature data from applicant signing
  applicantSignedAt?: Date; // When applicant signed
  applicantHistory?: IApplicantHistoryEntry[]; // Complete chronological history of all applicant actions
  publicAccessToken?: string; // Token for public access without login
  publicTokenExpiresAt?: Date; // Expiration date for public access token
  otpCode?: string; // OTP code for accepting/rejecting contract
  otpExpiresAt?: Date; // Expiration date for OTP
  createdAt?: Date;
  updatedAt?: Date;
}

const approvalHistoryEntrySchema = new Schema<IApprovalHistoryEntry>(
  {
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "signed"],
      required: true,
    },
    note: {
      type: String,
    },
    respondedAt: {
      type: Date,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: false }
);

const applicantHistoryEntrySchema = new Schema<IApplicantHistoryEntry>(
  {
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      required: true,
    },
    note: {
      type: String,
    },
    respondedAt: {
      type: Date,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: false }
);

const employeeApprovalSchema = new Schema<IEmployeeApproval>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    requireSignature: {
      type: Boolean,
      default: false,
    },
    signatureType: {
      type: String,
      enum: ["typed", "drawn", "upload"],
    },
    signatureData: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "signed"],
      default: "pending",
    },
    respondedAt: {
      type: Date,
    },
    note: {
      type: String,
    },
    history: {
      type: [approvalHistoryEntrySchema],
      default: [],
    },
  },
  { _id: false }
);

const contractApprovalSchema = new Schema<IContractApproval>(
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
    applicantId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    employeeApprovals: {
      type: [employeeApprovalSchema],
      required: true,
      default: [],
    },
    templateTitle: {
      type: String,
    },
    employerSignatureData: {
      type: String,
    },
    employerSignedAt: {
      type: Date,
    },
    employerName: {
      type: String,
    },
    signedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
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
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    sentAt: {
      type: Date,
    },
    sentToApplicantAt: {
      type: Date,
    },
    applicantStatus: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    acceptedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
    applicantNote: {
      type: String,
    },
    applicantSignatureData: {
      type: String,
    },
    applicantSignedAt: {
      type: Date,
    },
    applicantHistory: {
      type: [applicantHistoryEntrySchema],
      default: [],
    },
    publicAccessToken: {
      type: String,
      index: true,
    },
    publicTokenExpiresAt: {
      type: Date,
    },
    otpCode: {
      type: String,
    },
    otpExpiresAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicate approvals for same template+applicant
// This ensures each applicant can only have one approval request per template
contractApprovalSchema.index(
  { templateId: 1, applicantId: 1 },
  { unique: true }
);

// Index for efficient querying by template
contractApprovalSchema.index({ templateId: 1 });

// Index for efficient querying by applicant
contractApprovalSchema.index({ applicantId: 1 });

export const ContractApproval = mongoose.model<IContractApproval>(
  "ContractApproval",
  contractApprovalSchema,
  "contract_approvals"
);
