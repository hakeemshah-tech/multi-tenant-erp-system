import mongoose, { Schema, Document } from "mongoose";

export interface IBusinessStructure extends Document {
  _id: any;
  name: string;
  description?: string;
  code?: string;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const businessStructureSchema = new Schema<IBusinessStructure>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    code: { type: String, trim: true, unique: true, sparse: true },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Index for soft delete queries
businessStructureSchema.index({ isDeleted: 1, isActive: 1 });
businessStructureSchema.index({ code: 1 });

export const BusinessStructure = mongoose.model<IBusinessStructure>(
  "BusinessStructure",
  businessStructureSchema
);
