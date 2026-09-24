import mongoose, { Schema, Document } from "mongoose";

export interface IEmploymentSettingsMaster extends Document {
  worktype: {
    options: string[];
    defaultOptions: string[]; // Default values that must always be present
  };
  employeetype: {
    options: string[];
    defaultOptions: string[]; // Default values that must always be present
  };
  employmentstatus: {
    options: string[];
    defaultOptions: string[]; // Default values that must always be present
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const EmploymentSettingsMasterSchema = new Schema<IEmploymentSettingsMaster>(
  {
    worktype: {
      options: {
        type: [String],
        default: ["Office Work", "Shift Work"],
        required: true,
      },
      defaultOptions: {
        type: [String],
        default: ["Office Work", "Shift Work"],
        required: true,
      },
    },
    employeetype: {
      options: {
        type: [String],
        default: [
          "Permanent Full Time",
          "Permanent Part Time",
          "Fixed Term Contract",
          "Casual",
          "Labour Hire",
        ],
        required: true,
      },
      defaultOptions: {
        type: [String],
        default: [
          "Permanent Full Time",
          "Permanent Part Time",
          "Fixed Term Contract",
          "Casual",
          "Labour Hire",
        ],
        required: true,
      },
    },
    employmentstatus: {
      options: {
        type: [String],
        default: [
          "Reference Check Started",
          "Reference Check Satisfactory",
          "Reference Check Unsatisfactory",
          "Offer Letter Issued",
          "Offer Accepted",
          "Offer Rejected",
          "Onboard",
          "No Show",
          "Resigned",
          "Terminated",
        ],
        required: true,
      },
      defaultOptions: {
        type: [String],
        default: [
          "Reference Check Started",
          "Reference Check Satisfactory",
          "Reference Check Unsatisfactory",
          "Offer Letter Issued",
          "Offer Accepted",
          "Offer Rejected",
          "Onboard",
          "No Show",
          "Resigned",
          "Terminated",
        ],
        required: true,
      },
    },
  },
  { timestamps: true }
);

// Ensure there's only one document
EmploymentSettingsMasterSchema.statics.getOrCreate = async function () {
  let master = await this.findOne();
  if (!master) {
    master = await this.create({});
  }
  return master;
};

// Ensure default options are always included
EmploymentSettingsMasterSchema.pre("save", function (next) {
  // Ensure default options are always in options array
  ["worktype", "employeetype", "employmentstatus"].forEach((field) => {
    const fieldData = this.get(field) as any;
    if (fieldData && fieldData.defaultOptions) {
      const defaultOpts = fieldData.defaultOptions || [];
      const currentOpts = fieldData.options || [];
      // Merge: defaults first, then custom options (avoid duplicates)
      const merged = [
        ...defaultOpts,
        ...currentOpts.filter((opt: string) => !defaultOpts.includes(opt)),
      ];
      this.set(`${field}.options`, merged);
    }
  });
  next();
});

export default mongoose.models.EmploymentSettingsMaster ||
  mongoose.model<IEmploymentSettingsMaster>(
    "EmploymentSettingsMaster",
    EmploymentSettingsMasterSchema
  );
