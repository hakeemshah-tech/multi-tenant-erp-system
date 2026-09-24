import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * Contract Snapshot Model
 *
 * Stores a complete snapshot of the contract template and applicant data
 * at the time of signing. This preserves the exact state of the contract
 * when the applicant signed, even if the template or employee data changes later.
 */

export interface IContractSnapshot extends Document {
  approvalId: Types.ObjectId; // Reference to the ContractApproval document
  templateId: Types.ObjectId; // Reference to the original ContractTemplate
  applicantId: Types.ObjectId; // Reference to the Employee (applicant)
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;

  // Complete template snapshot at time of signing
  templateSnapshot: {
    title: string;
    description?: string;
    version?: string;
    builder: any; // Complete builder object with all clauses, fields, etc.
    category?: string;
  };

  // Complete applicant data at time of signing
  applicantSnapshot: {
    employeeFields?: any; // All employee field data
    designation?: {
      _id?: string;
      name?: string;
    };
    department?: {
      _id?: string;
      name?: string;
    };
    employmentDetails?: any;
  };

  // Organization data at time of signing
  organizationSnapshot?: {
    tenantName?: string;
    branchName?: string;
    employerName?: string;
    abn?: string;
    address?: string;
  };

  // Signature data
  employerSignatureData?: string; // Employer signature (for self-signed or approved contracts)
  employerSignedAt?: Date;
  employerName?: string;

  applicantSignatureData: string; // Applicant's signature (required - this is created on sign)
  applicantSignedAt: Date;

  // Employee approval signatures (if any)
  employeeApprovals?: Array<{
    employeeId: Types.ObjectId;
    employeeName?: string;
    designation?: string;
    signatureData?: string;
    signedAt?: Date;
    status: string;
  }>;

  // PDF tamper detection and caching
  pdfHash?: string; // SHA-256 hash of generated PDF
  pdfGeneratedAt?: Date; // When PDF was first generated
  pdfData?: Buffer; // Cached PDF binary (for consistent downloads)

  createdAt?: Date;
  updatedAt?: Date;
}

const contractSnapshotSchema = new Schema<IContractSnapshot>(
  {
    approvalId: {
      type: Schema.Types.ObjectId,
      ref: "ContractApproval",
      required: true,
      index: true,
    },
    templateId: {
      type: Schema.Types.ObjectId,
      ref: "ContractTemplate",
      required: true,
      index: true,
    },
    applicantId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
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
    templateSnapshot: {
      type: Schema.Types.Mixed,
      required: true,
    },
    applicantSnapshot: {
      type: Schema.Types.Mixed,
      required: true,
    },
    organizationSnapshot: {
      type: Schema.Types.Mixed,
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
    applicantSignatureData: {
      type: String,
      required: true,
    },
    applicantSignedAt: {
      type: Date,
      required: true,
    },
    employeeApprovals: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    pdfHash: {
      type: String,
    },
    pdfGeneratedAt: {
      type: Date,
    },
    pdfData: {
      type: Buffer,
    },
  },
  { timestamps: true }
);

// Compound index for efficient queries
contractSnapshotSchema.index({ approvalId: 1, applicantId: 1 });
contractSnapshotSchema.index({ tenantId: 1, branchId: 1 });

export const ContractSnapshot = mongoose.model<IContractSnapshot>(
  "ContractSnapshot",
  contractSnapshotSchema,
  "contract_snapshots"
);
