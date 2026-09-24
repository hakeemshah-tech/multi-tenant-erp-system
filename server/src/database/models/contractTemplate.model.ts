import mongoose, { Schema, Document, Types } from "mongoose";

export interface IContractTemplate extends Document {
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  userId: Types.ObjectId;
  contractTypeIds: Types.ObjectId[];
  employmentTypes?: string[];
  designationIds?: Types.ObjectId[];
  title: string;
  description?: string;
  version?: string;
  recommended?: boolean;
  status?: "draft" | "published";
  publishedAt?: Date | null;
  builder?: any; // flexible JSON structure for template builder (body, clauses, fields, schedule, logic, signing)
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const contractTemplateSchema = new Schema<IContractTemplate>(
  {
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
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    contractTypeIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "ContractType" }],
      default: [],
    },
    employmentTypes: { type: [String], default: [] },
    designationIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Designation" }],
      default: [],
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    version: { type: String, default: "v1", trim: true },
    recommended: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      index: true,
    },
    publishedAt: { type: Date, default: null },
    builder: { type: Schema.Types.Mixed, default: {} },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Regular index for efficient queries (no unique constraint)
contractTemplateSchema.index({
  tenantId: 1,
  branchId: 1,
  title: 1,
  version: 1,
});

export const ContractTemplate = mongoose.model<IContractTemplate>(
  "ContractTemplate",
  contractTemplateSchema,
  "contract_templates"
);
