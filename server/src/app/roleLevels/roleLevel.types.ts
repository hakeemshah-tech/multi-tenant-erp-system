import { Types } from "mongoose";

/**
 * Payload to create a role level
 */
export interface CreateRoleLevelInput {
  level: number;
  name: string;
  description?: string;
}

/**
 * Payload to update a role level
 */
export interface UpdateRoleLevelInput {
  level?: number;
  name?: string;
  description?: string;
}

/**
 * Role level response structure
 */
export interface RoleLevelResponse {
  _id: string;
  level: number;
  name: string;
  description?: string;
  tenantId: string;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
}
