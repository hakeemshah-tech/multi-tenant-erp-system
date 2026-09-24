import { Role } from "@/database/models/role.model";
import { AppError } from "@/common/utils/app-error";
import { CreateRoleInput, UpdateRoleInput } from "./role.types";
import mongoose from "mongoose";

export const createRole = async (
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  data: CreateRoleInput
) => {
  // Check for duplicate roleId (case-insensitive) within the same tenant and branch
  const existingRole = await Role.findOne({
    tenantId,
    branchId,
    roleId: data.roleId.toLowerCase().trim(),
    isDeleted: false,
  });

  if (existingRole) {
    throw new AppError(
      `Role with ID "${data.roleId}" already exists in this organisation`,
      409
    );
  }

  // Check if it's a system role (system_admin is protected)
  const isSystemRole = data.roleId === "system_admin";

  const role = await Role.create({
    tenantId,
    branchId,
    roleId: data.roleId.toLowerCase().trim(),
    name: data.name.trim(),
    description: data.description?.trim(),
    color: data.color,
    level: data.level || 1, // Default to 1 if not provided
    isSystemRole,
  });

  return role;
};

/**
 * Get all roles for a tenant and branch
 */
export const getRoles = async (
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId
) => {
  const roles = await Role.find({
    tenantId,
    branchId,
    isDeleted: false,
  }).sort({ isSystemRole: -1, name: 1 }); // System roles first, then alphabetically

  return roles;
};

/**
 * Get a single role by ID
 */
export const getRoleById = async (
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  roleId: string
) => {
  const role = await Role.findOne({
    tenantId,
    branchId,
    roleId: roleId.toLowerCase(),
    isDeleted: false,
  });

  if (!role) {
    throw new AppError("Role not found", 404);
  }

  return role;
};

/**
 * Update a role
 */
export const updateRole = async (
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  roleId: string,
  data: UpdateRoleInput
) => {
  const role = await Role.findOne({
    tenantId,
    branchId,
    roleId: roleId.toLowerCase(),
    isDeleted: false,
  });

  if (!role) {
    throw new AppError("Role not found", 404);
  }

  // Prevent updating system roles
  if (role.isSystemRole && role.roleId === "system_admin") {
    throw new AppError("Cannot update System Admin role", 403);
  }

  // Update fields
  if (data.name !== undefined) {
    role.name = data.name.trim();
  }
  if (data.description !== undefined) {
    role.description = data.description?.trim();
  }
  if (data.color !== undefined) {
    role.color = data.color;
  }
  if (data.level !== undefined) {
    role.level = data.level;
  }

  await role.save();
  return role;
};

/**
 * Delete a role (soft delete)
 */
export const deleteRole = async (
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  roleId: string
) => {
  const role = await Role.findOne({
    tenantId,
    branchId,
    roleId: roleId.toLowerCase(),
    isDeleted: false,
  });

  if (!role) {
    throw new AppError("Role not found", 404);
  }

  // Prevent deleting system roles
  if (role.isSystemRole && role.roleId === "system_admin") {
    throw new AppError("Cannot delete System Admin role", 403);
  }

  // Soft delete
  role.isDeleted = true;
  role.deletedAt = new Date();
  await role.save();

  return role;
};
