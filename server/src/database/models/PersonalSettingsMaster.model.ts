import mongoose, { Schema, Document } from "mongoose";

export interface IPersonalSettingsMaster extends Document {
  gender: {
    options: string[];
    defaultOptions: string[]; // Default values that must always be present
  };
  pronouns: {
    options: string[];
    defaultOptions: string[]; // Default values that must always be present
  };
  residencystatus: {
    options: string[];
    defaultOptions: string[]; // Default values that must always be present
  };
  typeofvisa: {
    options: string[];
    defaultOptions: string[]; // Default values that must always be present
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const PersonalSettingsMasterSchema = new Schema<IPersonalSettingsMaster>(
  {
    gender: {
      options: {
        type: [String],
        default: ["Male", "Female", "Intersex", "Don't want to Specify"],
        required: true,
      },
      defaultOptions: {
        type: [String],
        default: ["Male", "Female", "Intersex", "Don't want to Specify"],
        required: true,
      },
    },
    pronouns: {
      options: {
        type: [String],
        default: ["He/Him", "She/Her", "They/Them"],
        required: true,
      },
      defaultOptions: {
        type: [String],
        default: ["He/Him", "She/Her", "They/Them"],
        required: true,
      },
    },
    residencystatus: {
      options: {
        type: [String],
        default: ["Australian Citizen", "Permanent Resident", "Visa Holder"],
        required: true,
      },
      defaultOptions: {
        type: [String],
        default: ["Australian Citizen", "Permanent Resident", "Visa Holder"],
        required: true,
      },
    },
    typeofvisa: {
      options: {
        type: [String],
        default: ["Work Visa", "Student Visa", "Working Holiday Visa"],
        required: true,
      },
      defaultOptions: {
        type: [String],
        default: ["Work Visa", "Student Visa", "Working Holiday Visa"],
        required: true,
      },
    },
  },
  { timestamps: true }
);

// Ensure there's only one document
PersonalSettingsMasterSchema.statics.getOrCreate = async function () {
  let master = await this.findOne();
  if (!master) {
    master = await this.create({});
  }
  return master;
};

// Ensure default options are always included
PersonalSettingsMasterSchema.pre("save", function (next) {
  // Ensure default options are always in options array
  ["gender", "pronouns", "residencystatus", "typeofvisa"].forEach((field) => {
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

export default mongoose.models.PersonalSettingsMaster ||
  mongoose.model<IPersonalSettingsMaster>(
    "PersonalSettingsMaster",
    PersonalSettingsMasterSchema
  );
