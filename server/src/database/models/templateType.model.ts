import mongoose, { Schema, Document, Types } from "mongoose";

export interface ITemplateType extends Document {
  title: string;
  description?: string;
  contractTypeId: Types.ObjectId;
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const templateTypeSchema = new Schema<ITemplateType>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    contractTypeId: {
      type: Schema.Types.ObjectId,
      ref: "ContractType",
      required: true,
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

templateTypeSchema.index(
  { tenantId: 1, contractTypeId: 1, title: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

// Keep default collection naming for existing data (no requirement change specified)
export const TemplateType = mongoose.model<ITemplateType>(
  "TemplateType",
  templateTypeSchema
);
