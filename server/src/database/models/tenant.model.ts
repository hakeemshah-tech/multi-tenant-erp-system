import mongoose, { Schema, Document } from "mongoose";

export interface ITenantModel extends Document {
  name: string;
  email: string;
  stripeCustomerId: string;
  trialEndsAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const tenantSchema = new Schema<ITenantModel>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    stripeCustomerId: { type: String, required: true },
    trialEndsAt: { type: Date, required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// 🔹 Necessary indexes only
tenantSchema.index({ email: 1 }); // For login & lookup

export const Tenant = mongoose.model<ITenantModel>("Tenant", tenantSchema);
