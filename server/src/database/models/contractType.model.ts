import mongoose, { Schema, Document, Types } from "mongoose";

export interface IContractType extends Document {
  title: string;
  description?: string;
  tenantId?: Types.ObjectId;
  userId?: Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const contractTypeSchema = new Schema<IContractType>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: false,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Unique by title globally for active (not deleted) docs
contractTypeSchema.index(
  { title: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

// Explicit collection name to match requirement: `contract_types`
export const ContractType = mongoose.model<IContractType>(
  "ContractType",
  contractTypeSchema,
  "contract_types"
);
