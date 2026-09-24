import { Types } from "mongoose";

/**
 * Payload to create a role
 */
export interface CreateRoleInput {
  roleId: string; // Unique identifier (e.g., "hr_manager")
  name: string; // Display name (e.g., "HR Manager")
  description?: string;
  color: string; // Color for UI (purple, blue, green, amber, red, pink, teal, gray)
  level?: number; // Employee level (1-7) - optional, defaults to 1
}

/**
 * Payload to update a role
 */
export interface UpdateRoleInput {
  name?: string;
  description?: string;
  color?: string;
  level?: number;
}

/**
 * Role response structure
 */
export interface RoleResponse {
  _id: string;
  roleId: string;
  name: string;
  description?: string;
  color: string;
  level: number;
  isSystemRole: boolean;
  tenantId: string;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
}
