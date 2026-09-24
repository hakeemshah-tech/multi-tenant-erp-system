/**
 * Permission structure for a section
 */
export interface SectionPermission {
  read: boolean;
  write: boolean;
  delete: boolean;
}

/**
 * Permission with optional data access level
 */
export interface SectionPermissionWithDataAccess extends SectionPermission {
  dataAccessLevel?: number;
}

/**
 * Payload to create/update role permissions
 */
export interface CreateOrUpdateRolePermissionInput {
  roleId: string;
  sectionKey: string;
  permissions: SectionPermission;
}

/**
 * Bulk update permissions for a role
 */
export interface BulkUpdateRolePermissionsInput {
  roleId: string;
  permissions: {
    [sectionKey: string]: SectionPermissionWithDataAccess;
  };
}

/**
 * Role permission response structure
 */
export interface RolePermissionResponse {
  _id: string;
  roleId: string;
  sectionKey: string;
  permissions: SectionPermission;
  tenantId: string;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * All permissions for a role (grouped by section)
 */
export interface RolePermissionsMap {
  [sectionKey: string]: SectionPermission;
}

/**
 * All permissions for all roles (grouped by role, then by section)
 */
export interface AllRolePermissionsMap {
  [roleId: string]: RolePermissionsMap;
}
