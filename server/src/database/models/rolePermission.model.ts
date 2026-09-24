import mongoose, { Schema, Document } from "mongoose";

/**
 * Permission structure for a section
 */
export interface ISectionPermission {
  read: boolean;
  write: boolean;
  delete: boolean;
}

/**
 * Role Permission Document
 * Stores permissions for each role on each section
 */
export interface IRolePermission extends Document {
  tenantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  roleId: string; // Reference to Role.roleId
  sectionKey: string; // Parent section key (e.g., "personal-details", "address")
  permissions: ISectionPermission; // { read, write, delete }
  dataAccessLevel?: number; // Max employee level this role can access (1-7) - only for Employees sections
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const sectionPermissionSchema = new Schema<ISectionPermission>(
  {
    read: { type: Boolean, required: true, default: false },
    write: { type: Boolean, required: true, default: false },
    delete: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

const rolePermissionSchema = new Schema<IRolePermission>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    roleId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    sectionKey: {
      type: String,
      required: true,
      trim: true,
    },
    permissions: {
      type: sectionPermissionSchema,
      required: true,
    },
    dataAccessLevel: {
      type: Number,
      required: false,
      min: 1,
      max: 7,
      default: null,
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

// Indexes
rolePermissionSchema.index({ tenantId: 1, branchId: 1 });
rolePermissionSchema.index({ tenantId: 1, branchId: 1, roleId: 1 });
// Unique index: one permission record per role per section per tenant/branch
rolePermissionSchema.index(
  { tenantId: 1, branchId: 1, roleId: 1, sectionKey: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false },
  }
);

export const RolePermission = mongoose.model<IRolePermission>(
  "RolePermission",
  rolePermissionSchema
);
