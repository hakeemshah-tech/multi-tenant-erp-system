import mongoose, { Schema, Document } from "mongoose";

export interface IIndustryType extends Document {
  _id: any;
  name: string;
  description?: string;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const industryTypeSchema = new Schema<IIndustryType>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Index for soft delete queries
industryTypeSchema.index({ isDeleted: 1, isActive: 1 });

export const IndustryType = mongoose.model<IIndustryType>(
  "IndustryType",
  industryTypeSchema
);
