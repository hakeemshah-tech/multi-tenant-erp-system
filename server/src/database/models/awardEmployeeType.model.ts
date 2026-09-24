import mongoose, { Schema, Document } from "mongoose";

export interface IAwardEmployeeType extends Document {
  _id: any;
  title: string;
  description?: string;
  awardId: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const awardEmployeeTypeSchema = new Schema<IAwardEmployeeType>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    awardId: {
      type: Schema.Types.ObjectId,
      ref: "Award",
      required: true,
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Index for soft delete queries
awardEmployeeTypeSchema.index({ isDeleted: 1 });

export const AwardEmployeeType = mongoose.model<IAwardEmployeeType>(
  "AwardEmployeeType",
  awardEmployeeTypeSchema
);
