// import mongoose, { Schema, Document } from "mongoose";

// /**
//  * Interface for a single branch assignment.
//  */
// export interface IAssignment {
//   tenantId: mongoose.Types.ObjectId;
//   branchId: mongoose.Types.ObjectId;
//   role: "admin" | "employee" | "tenant-owner";
// }

// /**
//  * Interface for the User model.
//  */
// export interface IUser extends Document {
//   _id: any;
//   fullName: string;
//   email: string;
//   passwordHash: string;
//   assignments: IAssignment[];
//   activeAssignment?: IAssignment;
//   isDeleted: boolean;
//   deletedAt?: Date;
//   createdAt?: Date;
//   updatedAt?: Date;
// }

// const assignmentSchema = new Schema<IAssignment>(
//   {
//     tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
//     branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
//     role: {
//       type: String,
//       enum: ["admin", "employee", "tenant-owner"],
//       default: "employee",
//     },
//   },
//   { _id: false }
// );

// const userSchema = new Schema<IUser>(
//   {
//     fullName: { type: String, required: true },
//     email: { type: String, required: true, unique: true, index: true },
//     passwordHash: { type: String, required: true },

//     assignments: {
//       type: [assignmentSchema],
//       validate: {
//         validator: (assignments: IAssignment[]) => {
//           const seen = new Set();
//           return assignments.every(({ tenantId, branchId }) => {
//             const key = `${tenantId.toString()}-${branchId.toString()}`;
//             if (seen.has(key)) return false;
//             seen.add(key);
//             return true;
//           });
//         },
//         message: "Duplicate tenant-branch assignment found",
//       },
//     },

//     activeAssignment: {
//       type: assignmentSchema,
//       required: false,
//     },

//     isDeleted: { type: Boolean, default: false },
//     deletedAt: { type: Date, default: null },
//   },
//   { timestamps: true }
// );

// // Indexes
// userSchema.index({ "assignments.tenantId": 1 });

// export const User = mongoose.model<IUser>("User", userSchema);

import mongoose, { Schema, Document } from "mongoose";

/**
 * Interface for a single branch assignment.
 */
export interface IAssignment {
  tenantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  role: "admin" | "employee" | "tenant-owner";
}

/**
 * Interface for the User model.
 */
export interface IUser extends Document {
  _id: any;
  fullName: string;
  email: string;
  phone?: string;
  passwordHash: string;
  assignments: IAssignment[];
  activeAssignment?: IAssignment;
  isDeleted: boolean;
  deletedAt?: Date;
  isPlatformAdmin?: boolean; // Platform owner/admin flag
  isVerified?: boolean; // Email verification status
  currentMode: "nexus-profile" | "organization" | "newbie";
  notificationPreferences?: {
    emailNotifications: {
      documentExpiry: boolean;
      documentPreExpiry: boolean;
      documentApproval: boolean;
    };
    preExpiryDays: number; // 1-7 days
    emailFrequency: "immediate" | "daily" | "weekly";
    quietHours: {
      enabled: boolean;
      startTime: string; // "22:00"
      endTime: string; // "08:00"
      timezone: string;
    };
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const assignmentSchema = new Schema<IAssignment>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    role: {
      type: String,
      enum: ["admin", "employee", "tenant-owner"],
      default: "employee",
    },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true },

    assignments: {
      type: [assignmentSchema],
      default: [],
      // validate: {
      //   validator: (assignments: IAssignment[]) => {
      //     const seen = new Set();
      //     return assignments.every(({ tenantId, branchId }) => {
      //       const key = `${tenantId.toString()}-${branchId.toString()}`;
      //       if (seen.has(key)) return false;
      //       seen.add(key);
      //       return true;
      //     });
      //   },
      //   message: "Duplicate tenant-branch assignment found",
      // },
    },

    activeAssignment: {
      type: assignmentSchema,
      required: false,
    },

    currentMode: {
      type: String,
      enum: ["nexus-profile", "organization", "newbie"],
      default: "newbie", // ✅ default for newly registered users
    },

    notificationPreferences: {
      emailNotifications: {
        documentExpiry: { type: Boolean, default: true },
        documentPreExpiry: { type: Boolean, default: true },
        documentApproval: { type: Boolean, default: true },
      },
      preExpiryDays: { type: Number, default: 3, min: 1, max: 7 },
      emailFrequency: {
        type: String,
        enum: ["immediate", "daily", "weekly"],
        default: "immediate",
      },
      quietHours: {
        enabled: { type: Boolean, default: false },
        startTime: { type: String, default: "22:00" },
        endTime: { type: String, default: "08:00" },
        timezone: { type: String, default: "UTC" },
      },
    },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    isPlatformAdmin: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false }, // Email verification status
  },
  { timestamps: true }
);

// Indexes
userSchema.index({ "assignments.tenantId": 1 });

export const User = mongoose.model<IUser>("User", userSchema);
