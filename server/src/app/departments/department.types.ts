import { Types } from "mongoose";

/**
 * Payload to create a department
 */
export interface CreateDepartmentInput {
  name: string;
  description?: string;
  branchId: Types.ObjectId;
}

/**
 * Payload to update a department
 */
export interface UpdateDepartmentInput {
  name?: string;
  description?: string;
  branchId?: Types.ObjectId;
}

/**
 * Department response structure
 */
export interface DepartmentResponse {
  id: string;
  name: string;
  description?: string;
  tenantId: string;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
}

// "dev": "ts-node-dev --respawn --transpile-only -r tsconfig-paths/register src/index.ts",
// "build": "tsc --noEmitOnError false",
