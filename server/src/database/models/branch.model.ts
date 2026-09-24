import mongoose, { Schema, Document } from "mongoose";

export interface IBranchAward {
  awardId: mongoose.Types.ObjectId;
  awardEmployeeTypeIds: mongoose.Types.ObjectId[];
}

export interface IBranchAddress {
  buildingPropertyName?: string;
  flatUnitNumber?: string;
  streetNumber?: string;
  streetName?: string;
  suburbCity?: string;
  stateTerritory?: string;
  country?: string;
  zipPostalCode?: string;
}

export interface IBranchPhysicalWorkLocation {
  state: string;
  place: string;
}

export interface IBranchOfficeWorkerHours {
  startTime: string; // e.g., "09:00"
  endTime: string; // e.g., "17:00"
  weekDays: string[]; // e.g., ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
}

export interface IBranchShiftWorkerHours {
  description: string;
  weekDays: string[];
}

export interface IBranchHoursOfOperation {
  officeWorker?: IBranchOfficeWorkerHours;
  shiftWorker?: IBranchShiftWorkerHours;
}

export interface IBranch extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  location: string;
  employeeCount: string;
  businessCategory: mongoose.Types.ObjectId;
  awards?: IBranchAward[];
  // New fields
  logo?: string;
  abn?: string;
  acn?: string;
  businessStructureId?: mongoose.Types.ObjectId;
  industryTypeIds?: mongoose.Types.ObjectId[];
  industrySubTypeIds?: mongoose.Types.ObjectId[];
  addresses?: IBranchAddress[];
  email?: string;
  phone?: string;
  websiteUrl?: string;
  physicalWorkLocations?: IBranchPhysicalWorkLocation[];
  businessHoursOfOperation?: IBranchHoursOfOperation;
  isNotForProfit?: boolean;
  isSalaryPackagingAvailable?: boolean;
  salaryPackagingMaximumAmount?: number;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const branchSchema = new Schema<IBranch>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    employeeCount: {
      type: String,
      required: true,
      default: "1-10",
    },
    businessCategory: {
      type: Schema.Types.ObjectId,
      ref: "BusinessCategory",
      required: true,
    },
    awards: [
      {
        awardId: {
          type: Schema.Types.ObjectId,
          ref: "Award",
          required: true,
        },
        awardEmployeeTypeIds: [
          {
            type: Schema.Types.ObjectId,
            ref: "AwardEmployeeType",
            required: true,
          },
        ],
      },
    ],
    // New fields
    logo: {
      type: String,
      trim: true,
    },
    abn: {
      type: String,
      trim: true,
    },
    acn: {
      type: String,
      trim: true,
    },
    businessStructureId: {
      type: Schema.Types.ObjectId,
      ref: "BusinessStructure",
    },
    industryTypeIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "IndustryType",
      },
    ],
    industrySubTypeIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "IndustrySubType",
      },
    ],
    addresses: [
      {
        buildingPropertyName: { type: String, trim: true },
        flatUnitNumber: { type: String, trim: true },
        streetNumber: { type: String, trim: true },
        streetName: { type: String, trim: true },
        suburbCity: { type: String, trim: true },
        stateTerritory: { type: String, trim: true },
        country: { type: String, trim: true },
        zipPostalCode: { type: String, trim: true },
      },
    ],
    email: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    websiteUrl: {
      type: String,
      trim: true,
    },
    physicalWorkLocations: [
      {
        state: { type: String, required: true, trim: true },
        place: { type: String, required: true, trim: true },
      },
    ],
    businessHoursOfOperation: {
      officeWorker: {
        startTime: { type: String, trim: true },
        endTime: { type: String, trim: true },
        weekDays: [{ type: String, trim: true }],
      },
      shiftWorker: {
        description: { type: String, trim: true },
        weekDays: [{ type: String, trim: true }],
      },
    },
    isNotForProfit: {
      type: Boolean,
      default: false,
    },
    isSalaryPackagingAvailable: {
      type: Boolean,
      default: false,
    },
    salaryPackagingMaximumAmount: {
      type: Number,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// 🔹 Indexes
branchSchema.index({ tenantId: 1 }); // For filtering branches per tenant

export const Branch = mongoose.model<IBranch>("Branch", branchSchema);
