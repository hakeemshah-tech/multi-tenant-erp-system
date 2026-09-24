import { Types } from "mongoose";
import EmployeeModel from "@/database/models/employee.model";
import { Designation } from "@/database/models/designation.model";
import { getRolePermissions } from "../rolePermissions/rolePermission.service";
import { RolePermissionsMap } from "../rolePermissions/rolePermission.types";

/**
 * Aggregated roles for an employee
 */
export interface AggregatedRoles {
  roleIds: string[];
  isSystemAdmin: boolean;
  aggregatedRoles: Array<{
    roleId: string;
    name: string;
    color?: string;
    level?: number;
  }>;
}

/**
 * Resolved permissions for an employee
 */
export interface EmployeePermissions {
  permissions: RolePermissionsMap;
  dataAccessLevels: { [sectionKey: string]: number };
  accessibleSections: string[];
}

/**
 * Get all aggregated roles for an employee in a specific organization
 * Combines: Primary designation roles + Additional designation roles + Direct additional roles
 */
export const getAggregatedRoles = async (
  userId: Types.ObjectId,
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId
): Promise<AggregatedRoles> => {
  // First, get the EmployeeProfile for this userId
  const { EmployeeProfile } =
    await import("@/database/models/employeeProfile.model");
  const employeeProfile = await EmployeeProfile.findOne({ userId }).lean();

  if (!employeeProfile) {
    throw new Error("Employee profile not found");
  }

  // Find employee record using employeeProfile._id
  const employee = await EmployeeModel.findOne({
    employeeProfile: employeeProfile._id,
    tenantId,
    branchId,
    isDeleted: false,
  })
    .populate("designation")
    .populate("additionalDesignationIds")
    .lean();

  if (!employee) {
    throw new Error("Employee not found in this organization");
  }

  const roleIdSet = new Set<string>();

  // 1. Get roles from primary designation
  if (
    employee.designation &&
    typeof employee.designation === "object" &&
    "roleIds" in employee.designation
  ) {
    const primaryDesignation = employee.designation as any;
    if (Array.isArray(primaryDesignation.roleIds)) {
      primaryDesignation.roleIds.forEach((roleId: string) => {
        if (roleId) roleIdSet.add(roleId.toLowerCase().trim());
      });
    }
  }

  // 2. Get roles from additional designations
  if (Array.isArray(employee.additionalDesignationIds)) {
    for (const additionalDesignation of employee.additionalDesignationIds) {
      if (
        additionalDesignation &&
        typeof additionalDesignation === "object" &&
        "roleIds" in additionalDesignation
      ) {
        const designation = additionalDesignation as any;
        if (Array.isArray(designation.roleIds)) {
          designation.roleIds.forEach((roleId: string) => {
            if (roleId) roleIdSet.add(roleId.toLowerCase().trim());
          });
        }
      }
    }
  }

  // 3. Get direct additional roles from employee
  if (Array.isArray(employee.additionalRoleIds)) {
    employee.additionalRoleIds.forEach((roleId: string) => {
      if (roleId) roleIdSet.add(roleId.toLowerCase().trim());
    });
  }

  const roleIds = Array.from(roleIdSet);
  const isSystemAdmin = roleIds.includes("system_admin");

  // Fetch role details (name, color, level) for display purposes
  // Note: We'll fetch this separately if needed, for now just return roleIds
  const aggregatedRoles = roleIds.map((roleId) => ({
    roleId,
    name: roleId, // Will be populated later if needed
    color: undefined,
    level: undefined,
  }));

  return {
    roleIds,
    isSystemAdmin,
    aggregatedRoles,
  };
};

/**
 * Resolve permissions by merging all role permissions
 * Uses UNION logic: If ANY role has permission, grant it
 * Employee level comes from job titles (designations), not roles
 */
export const resolvePermissions = async (
  roleIds: string[],
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId,
  employeeLevel?: number // Employee level from job title (designation)
): Promise<EmployeePermissions> => {
  if (roleIds.length === 0) {
    return {
      permissions: {},
      dataAccessLevels: {},
      accessibleSections: [],
    };
  }

  // System admin has full access
  if (roleIds.includes("system_admin")) {
    // Get all unique section keys from all permissions in this tenant/branch
    const { RolePermission } =
      await import("@/database/models/rolePermission.model");
    const allSectionKeys = await RolePermission.find({
      tenantId,
      branchId,
      isDeleted: false,
    }).distinct("sectionKey");

    const permissions: RolePermissionsMap = {};
    const dataAccessLevels: { [sectionKey: string]: number } = {};

    allSectionKeys.forEach((sectionKey) => {
      permissions[sectionKey] = {
        read: true,
        write: true,
        delete: true,
      };
      dataAccessLevels[sectionKey] = 7; // Highest level
    });

    return {
      permissions,
      dataAccessLevels,
      accessibleSections: allSectionKeys,
    };
  }

  // For non-system-admin roles, merge permissions
  const permissionsMap: RolePermissionsMap = {};
  const dataAccessLevelsMap: { [sectionKey: string]: number } = {};
  const accessibleSectionsSet = new Set<string>();

  // Batch fetch all role permissions at once
  for (const roleId of roleIds) {
    const { permissions, dataAccessLevels: roleDataAccessLevels } =
      await getRolePermissions(tenantId, branchId, roleId);

    // Merge permissions (union logic)
    Object.keys(permissions).forEach((sectionKey) => {
      if (!permissionsMap[sectionKey]) {
        permissionsMap[sectionKey] = {
          read: false,
          write: false,
          delete: false,
        };
      }

      // If ANY role has permission, grant it
      permissionsMap[sectionKey].read =
        permissionsMap[sectionKey].read || permissions[sectionKey].read;
      permissionsMap[sectionKey].write =
        permissionsMap[sectionKey].write || permissions[sectionKey].write;
      permissionsMap[sectionKey].delete =
        permissionsMap[sectionKey].delete || permissions[sectionKey].delete;

      // Track accessible sections (at least read access)
      if (permissionsMap[sectionKey].read) {
        accessibleSectionsSet.add(sectionKey);
      }

      // Merge data access levels (take the maximum)
      if (
        roleDataAccessLevels &&
        roleDataAccessLevels[sectionKey] !== undefined
      ) {
        const currentLevel = dataAccessLevelsMap[sectionKey];
        const newLevel = roleDataAccessLevels[sectionKey];
        if (currentLevel === undefined || newLevel > currentLevel) {
          dataAccessLevelsMap[sectionKey] = newLevel;
        }
      }
    });
  }

  return {
    permissions: permissionsMap,
    dataAccessLevels: dataAccessLevelsMap,
    accessibleSections: Array.from(accessibleSectionsSet),
  };
};

/**
 * Main function: Get complete employee permissions for an organization
 * This is the function to use for permission checks
 */
export const getEmployeePermissions = async (
  userId: Types.ObjectId,
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId
): Promise<{
  aggregatedRoles: AggregatedRoles;
  permissions: EmployeePermissions;
}> => {
  // Step 1: Get aggregated roles (this also fetches employee with designations)
  const aggregatedRoles = await getAggregatedRoles(userId, tenantId, branchId);

  // Step 2: Get employee level from designation(s)
  // Get the employee record to access designation employeeLevel
  const { EmployeeProfile } =
    await import("@/database/models/employeeProfile.model");
  const employeeProfile = await EmployeeProfile.findOne({ userId }).lean();

  if (!employeeProfile) {
    throw new Error("Employee profile not found");
  }

  const employee = await EmployeeModel.findOne({
    employeeProfile: employeeProfile._id,
    tenantId,
    branchId,
    isDeleted: false,
  })
    .populate("designation")
    .populate("additionalDesignationIds")
    .lean();

  if (!employee) {
    throw new Error("Employee not found in this organization");
  }

  // Get employee level from primary designation or additional designations
  // Use MAX level if multiple designations have different levels
  let employeeLevel = 1; // Default to 1
  const designationLevels: number[] = [];

  // Check primary designation
  if (
    employee.designation &&
    typeof employee.designation === "object" &&
    "employeeLevel" in employee.designation
  ) {
    const primaryDesignation = employee.designation as any;
    if (
      primaryDesignation.employeeLevel &&
      typeof primaryDesignation.employeeLevel === "number"
    ) {
      designationLevels.push(primaryDesignation.employeeLevel);
    }
  }

  // Check additional designations
  if (Array.isArray(employee.additionalDesignationIds)) {
    for (const additionalDesignation of employee.additionalDesignationIds) {
      if (
        additionalDesignation &&
        typeof additionalDesignation === "object" &&
        "employeeLevel" in additionalDesignation
      ) {
        const designation = additionalDesignation as any;
        if (
          designation.employeeLevel &&
          typeof designation.employeeLevel === "number"
        ) {
          designationLevels.push(designation.employeeLevel);
        }
      }
    }
  }

  // Use MAX level from all designations
  if (designationLevels.length > 0) {
    employeeLevel = Math.max(...designationLevels);
  }

  // Step 3: Resolve permissions with employee level
  const permissions = await resolvePermissions(
    aggregatedRoles.roleIds,
    tenantId,
    branchId,
    employeeLevel
  );

  return {
    aggregatedRoles,
    permissions,
  };
};
