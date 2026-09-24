import { RoleLevel } from "@/database/models/roleLevel.model";
import { AppError } from "@/common/utils/app-error";
import { CreateRoleLevelInput, UpdateRoleLevelInput } from "./roleLevel.types";
import mongoose from "mongoose";

/**
 * Create default role levels for a tenant/branch
 * This function is idempotent - it will only create levels that don't already exist
 */
export const createDefaultRoleLevels = async (
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId
) => {
  const defaultLevels = [
    { level: 1, name: "Base Level - Worker", description: "" },
    { level: 2, name: "Officer Level", description: "" },
    { level: 3, name: "Senior Officer Level", description: "" },
    { level: 4, name: "Manager Level", description: "" },
    { level: 5, name: "Senior Manager Level", description: "" },
    { level: 6, name: "Executive Level", description: "" },
    { level: 7, name: "Senior Executive Level", description: "" },
  ];

  // Check which levels already exist
  const existingLevels = await RoleLevel.find({
    tenantId,
    branchId,
    isDeleted: false,
  });

  const existingLevelNumbers = new Set(existingLevels.map((rl) => rl.level));

  // Only create levels that don't exist
  const levelsToCreate = defaultLevels.filter(
    (level) => !existingLevelNumbers.has(level.level)
  );

  if (levelsToCreate.length === 0) {
    console.log(
      `✅ All default role levels already exist for tenant ${tenantId}, branch ${branchId}`
    );
    return existingLevels;
  }

  const newRoleLevels = await RoleLevel.insertMany(
    levelsToCreate.map((level) => ({
      tenantId,
      branchId,
      level: level.level,
      name: level.name,
      description: level.description,
      isDeleted: false,
    }))
  );

  console.log(
    `✅ Created ${newRoleLevels.length} default role levels for tenant ${tenantId}, branch ${branchId}`
  );

  // Return all levels (existing + newly created)
  return [...existingLevels, ...newRoleLevels];
};

/**
 * Create a new role level
 */
export const createRoleLevel = async (
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  data: CreateRoleLevelInput
) => {
  // Check for duplicate level within the same tenant and branch
  const existingLevel = await RoleLevel.findOne({
    tenantId,
    branchId,
    level: data.level,
    isDeleted: false,
  });

  if (existingLevel) {
    throw new AppError(
      `Role level ${data.level} already exists in this organisation`,
      409
    );
  }

  const roleLevel = await RoleLevel.create({
    tenantId,
    branchId,
    level: data.level,
    name: data.name.trim(),
    description: data.description?.trim(),
    isDeleted: false,
  });

  return roleLevel;
};

/**
 * Get all role levels for a tenant and branch
 */
export const getRoleLevels = async (
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId
) => {
  const roleLevels = await RoleLevel.find({
    tenantId,
    branchId,
    isDeleted: false,
  }).sort({ level: 1 }); // Sort by level ascending

  return roleLevels;
};

/**
 * Get a single role level by ID
 */
export const getRoleLevelById = async (
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  roleLevelId: string
) => {
  const roleLevel = await RoleLevel.findOne({
    _id: roleLevelId,
    tenantId,
    branchId,
    isDeleted: false,
  });

  if (!roleLevel) {
    throw new AppError("Role level not found", 404);
  }

  return roleLevel;
};

/**
 * Update a role level
 */
export const updateRoleLevel = async (
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  roleLevelId: string,
  data: UpdateRoleLevelInput
) => {
  const roleLevel = await RoleLevel.findOne({
    _id: roleLevelId,
    tenantId,
    branchId,
    isDeleted: false,
  });

  if (!roleLevel) {
    throw new AppError("Role level not found", 404);
  }

  // If level is being changed, check for conflicts
  if (data.level !== undefined && data.level !== roleLevel.level) {
    const existingLevel = await RoleLevel.findOne({
      tenantId,
      branchId,
      level: data.level,
      isDeleted: false,
      _id: { $ne: roleLevelId },
    });

    if (existingLevel) {
      throw new AppError(
        `Role level ${data.level} already exists in this organisation`,
        409
      );
    }
  }

  // Update fields
  if (data.level !== undefined) {
    roleLevel.level = data.level;
  }
  if (data.name !== undefined) {
    roleLevel.name = data.name.trim();
  }
  if (data.description !== undefined) {
    roleLevel.description = data.description?.trim();
  }

  await roleLevel.save();
  return roleLevel;
};

/**
 * Delete a role level (soft delete)
 */
export const deleteRoleLevel = async (
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  roleLevelId: string
) => {
  const roleLevel = await RoleLevel.findOne({
    _id: roleLevelId,
    tenantId,
    branchId,
    isDeleted: false,
  });

  if (!roleLevel) {
    throw new AppError("Role level not found", 404);
  }

  // Soft delete
  roleLevel.isDeleted = true;
  roleLevel.deletedAt = new Date();
  await roleLevel.save();

  return roleLevel;
};
