import { RolePermission } from "@/database/models/rolePermission.model";
import { AppError } from "@/common/utils/app-error";
import {
  CreateOrUpdateRolePermissionInput,
  BulkUpdateRolePermissionsInput,
  RolePermissionsMap,
  AllRolePermissionsMap,
} from "./rolePermission.types";
import mongoose from "mongoose";

/**
 * Create or update a single role permission
 */
export const createOrUpdateRolePermission = async (
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  data: CreateOrUpdateRolePermissionInput
) => {
  const normalizedRoleId = data.roleId.toLowerCase().trim();

  // System Admin permissions are not stored - they always have full access
  if (normalizedRoleId === "system_admin") {
    throw new AppError(
      "Cannot modify system_admin permissions - they have full access by default",
      400
    );
  }

  const rolePermission = await RolePermission.findOneAndUpdate(
    {
      tenantId,
      branchId,
      roleId: normalizedRoleId,
      sectionKey: data.sectionKey.trim(),
      isDeleted: false,
    },
    {
      tenantId,
      branchId,
      roleId: normalizedRoleId,
      sectionKey: data.sectionKey.trim(),
      permissions: data.permissions,
      isDeleted: false,
      deletedAt: null,
    },
    { new: true, upsert: true }
  );

  return rolePermission;
};

/**
 * Bulk update permissions for a role
 */
export const bulkUpdateRolePermissions = async (
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  data: BulkUpdateRolePermissionsInput
) => {
  const roleId = data.roleId.toLowerCase().trim();

  // System Admin permissions are not stored - they always have full access
  if (roleId === "system_admin") {
    // Silently return empty array - system_admin doesn't need permissions stored
    return [];
  }

  const results = [];

  // Update or create each permission
  for (const [sectionKey, permissionData] of Object.entries(data.permissions)) {
    // Extract dataAccessLevel if present
    const { dataAccessLevel, ...permissions } = permissionData as any;

    const rolePermission = await RolePermission.findOneAndUpdate(
      {
        tenantId,
        branchId,
        roleId,
        sectionKey: sectionKey.trim(),
        isDeleted: false,
      },
      {
        tenantId,
        branchId,
        roleId,
        sectionKey: sectionKey.trim(),
        permissions,
        dataAccessLevel: dataAccessLevel || null,
        isDeleted: false,
        deletedAt: null,
      },
      { new: true, upsert: true }
    );
    results.push(rolePermission);
  }

  return results;
};

/**
 * Get all permissions for a specific role
 */
export const getRolePermissions = async (
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  roleId: string
): Promise<{
  permissions: RolePermissionsMap;
  dataAccessLevels?: { [sectionKey: string]: number };
}> => {
  const normalizedRoleId = roleId.toLowerCase();

  // System Admin always has full access to all sections
  if (normalizedRoleId === "system_admin") {
    // Get all unique section keys from all permissions
    const allPermissions = await RolePermission.find({
      tenantId,
      branchId,
      isDeleted: false,
    }).distinct("sectionKey");

    const permissionsMap: RolePermissionsMap = {};
    const dataAccessLevelsMap: { [sectionKey: string]: number } = {};

    allPermissions.forEach((sectionKey) => {
      permissionsMap[sectionKey] = {
        read: true,
        write: true,
        delete: true,
      };
      dataAccessLevelsMap[sectionKey] = 7; // System admin has max level
    });

    return {
      permissions: permissionsMap,
      dataAccessLevels: dataAccessLevelsMap,
    };
  }

  // For other roles, get their stored permissions
  const permissions = await RolePermission.find({
    tenantId,
    branchId,
    roleId: normalizedRoleId,
    isDeleted: false,
  });

  const permissionsMap: RolePermissionsMap = {};
  const dataAccessLevelsMap: { [sectionKey: string]: number } = {};

  permissions.forEach((perm) => {
    permissionsMap[perm.sectionKey] = {
      read: perm.permissions.read,
      write: perm.permissions.write,
      delete: perm.permissions.delete,
    };
    // Include data access level if it exists
    if (perm.dataAccessLevel !== undefined && perm.dataAccessLevel !== null) {
      dataAccessLevelsMap[perm.sectionKey] = perm.dataAccessLevel;
    }
  });

  return { permissions: permissionsMap, dataAccessLevels: dataAccessLevelsMap };
};

/**
 * Get all permissions for all roles
 */
export const getAllRolePermissions = async (
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId
): Promise<{
  permissions: AllRolePermissionsMap;
}> => {
  const permissions = await RolePermission.find({
    tenantId,
    branchId,
    isDeleted: false,
  });

  const allPermissionsMap: AllRolePermissionsMap = {};

  // Collect all unique section keys
  const allSectionKeys = new Set<string>();

  permissions.forEach((perm) => {
    allSectionKeys.add(perm.sectionKey);

    if (!allPermissionsMap[perm.roleId]) {
      allPermissionsMap[perm.roleId] = {};
    }
    const permissionData: any = {
      read: perm.permissions.read,
      write: perm.permissions.write,
      delete: perm.permissions.delete,
    };
    // Include dataAccessLevel if it exists
    if (perm.dataAccessLevel !== undefined && perm.dataAccessLevel !== null) {
      permissionData.dataAccessLevel = perm.dataAccessLevel;
    }
    allPermissionsMap[perm.roleId][perm.sectionKey] = permissionData;
  });

  // System Admin always has full access to all sections
  const SYSTEM_ADMIN_ROLE_ID = "system_admin";
  if (!allPermissionsMap[SYSTEM_ADMIN_ROLE_ID]) {
    allPermissionsMap[SYSTEM_ADMIN_ROLE_ID] = {};
  }

  // Add full permissions for system_admin for all sections
  allSectionKeys.forEach((sectionKey) => {
    allPermissionsMap[SYSTEM_ADMIN_ROLE_ID][sectionKey] = {
      read: true,
      write: true,
      delete: true,
    };
  });

  return {
    permissions: allPermissionsMap,
  };
};

/**
 * Delete a role permission (soft delete)
 */
export const deleteRolePermission = async (
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  roleId: string,
  sectionKey: string
) => {
  const rolePermission = await RolePermission.findOne({
    tenantId,
    branchId,
    roleId: roleId.toLowerCase(),
    sectionKey: sectionKey.trim(),
    isDeleted: false,
  });

  if (!rolePermission) {
    throw new AppError("Role permission not found", 404);
  }

  rolePermission.isDeleted = true;
  rolePermission.deletedAt = new Date();
  await rolePermission.save();

  return rolePermission;
};

/**
 * Delete all permissions for a role (soft delete)
 */
export const deleteAllRolePermissions = async (
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  roleId: string
) => {
  await RolePermission.updateMany(
    {
      tenantId,
      branchId,
      roleId: roleId.toLowerCase(),
      isDeleted: false,
    },
    {
      isDeleted: true,
      deletedAt: new Date(),
    }
  );
};
