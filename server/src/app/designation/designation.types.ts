import { Types } from "mongoose";

/**
 * Payload to create a designation
 */
export interface CreateDesignationInput {
  name: string;
  description?: string;
  departmentIds: Types.ObjectId[]; // linked to multiple departments
  roleIds?: string[]; // linked to multiple roles (roleId strings)
  branchId: Types.ObjectId;
}

/**
 * Payload to update a designation
 */
export interface UpdateDesignationInput {
  name?: string;
  description?: string;
  departmentIds?: Types.ObjectId[];
  roleIds?: string[]; // linked to multiple roles (roleId strings)
  branchId?: Types.ObjectId;
}

/**
 * Designation response structure
 */
export interface DesignationResponse {
  id: string;
  name: string;
  description?: string;
  tenantId: string;
  branchId: string;
  departmentIds: string[];
  roleIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}
