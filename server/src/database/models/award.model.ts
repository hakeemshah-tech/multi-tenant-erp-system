import mongoose, { Schema, Document } from "mongoose";

export interface IAward extends Document {
  _id: any;
  title: string;
  description?: string;
  icon?: string; // Icon name or URl
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const awardSchema = new Schema<IAward>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    icon: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Index for soft delete queries
awardSchema.index({ isDeleted: 1, isActive: 1 });

export const Award = mongoose.model<IAward>("Award", awardSchema);
