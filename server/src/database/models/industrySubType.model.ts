import mongoose, { Schema, Document } from "mongoose";

export interface IIndustrySubType extends Document {
  _id: any;
  name: string;
  description?: string;
  code?: string;
  industryTypeId: mongoose.Types.ObjectId;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const industrySubTypeSchema = new Schema<IIndustrySubType>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    code: { type: String, trim: true },
    industryTypeId: {
      type: Schema.Types.ObjectId,
      ref: "IndustryType",
      required: true,
    },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Index for soft delete queries
industrySubTypeSchema.index({ isDeleted: 1, isActive: 1 });
industrySubTypeSchema.index({ industryTypeId: 1 });
industrySubTypeSchema.index({ code: 1, industryTypeId: 1 }); // Unique code per industry type

export const IndustrySubType = mongoose.model<IIndustrySubType>(
  "IndustrySubType",
  industrySubTypeSchema
);
