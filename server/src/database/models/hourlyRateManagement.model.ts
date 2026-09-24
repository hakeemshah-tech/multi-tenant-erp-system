import mongoose, { Schema, Document } from "mongoose";

export interface IRate {
  level: number;
  baseMinimumHourlyRates: number;
}

export interface IHourlyRateManagement extends Document {
  _id: any;
  awardId: mongoose.Types.ObjectId;
  awardEmployeeTypeId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate?: Date;
  rates: IRate[];
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const rateSchema = new Schema<IRate>(
  {
    level: { type: Number, required: true },
    baseMinimumHourlyRates: { type: Number, required: true },
  },
  { _id: false }
);

const hourlyRateManagementSchema = new Schema<IHourlyRateManagement>(
  {
    awardId: {
      type: Schema.Types.ObjectId,
      ref: "Award",
      required: true,
      index: true,
    },
    awardEmployeeTypeId: {
      type: Schema.Types.ObjectId,
      ref: "AwardEmployeeType",
      required: true,
      index: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: false },
    rates: {
      type: [rateSchema],
      required: true,
      validate: {
        validator: (rates: IRate[]) => rates.length > 0,
        message: "At least one rate is required",
      },
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Index for soft delete queries
hourlyRateManagementSchema.index({ isDeleted: 1 });
hourlyRateManagementSchema.index({ awardId: 1, awardEmployeeTypeId: 1 });

export const HourlyRateManagement = mongoose.model<IHourlyRateManagement>(
  "HourlyRateManagement",
  hourlyRateManagementSchema
);
