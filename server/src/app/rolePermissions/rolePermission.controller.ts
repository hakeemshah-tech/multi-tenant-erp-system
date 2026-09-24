import { Response } from "express";
import * as rolePermissionService from "./rolePermission.service";
import {
  CreateOrUpdateRolePermissionInput,
  BulkUpdateRolePermissionsInput,
} from "./rolePermission.types";
import { Types } from "mongoose";
import { WithUser } from "@/common/middlewares/authMiddleware";

/**
 * @desc Create or update a role permission
 * @route POST /role-permissions
 */
export const createOrUpdateRolePermission = async (
  req: WithUser,
  res: Response
) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const data: CreateOrUpdateRolePermissionInput = req.body;

  const rolePermission =
    await rolePermissionService.createOrUpdateRolePermission(
      tenantId,
      branchId,
      data
    );

  return res.status(200).json({
    message: "Role permission saved successfully",
    data: rolePermission,
  });
};

/**
 * @desc Bulk update permissions for a role
 * @route PUT /role-permissions/bulk
 */
export const bulkUpdateRolePermissions = async (
  req: WithUser,
  res: Response
) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const data: BulkUpdateRolePermissionsInput = req.body;

  const rolePermissions = await rolePermissionService.bulkUpdateRolePermissions(
    tenantId,
    branchId,
    data
  );

  return res.status(200).json({
    message: "Role permissions updated successfully",
    data: rolePermissions,
  });
};

/**
 * @desc Get all permissions for a specific role
 * @route GET /role-permissions/role/:roleId
 */
export const getRolePermissions = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const { roleId } = req.params;

  const permissions = await rolePermissionService.getRolePermissions(
    tenantId,
    branchId,
    roleId
  );

  return res.status(200).json({
    message: "Role permissions fetched successfully",
    data: permissions,
  });
};

/**
 * @desc Get all permissions for all roles
 * @route GET /role-permissions
 */
export const getAllRolePermissions = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);

  const permissions = await rolePermissionService.getAllRolePermissions(
    tenantId,
    branchId
  );

  return res.status(200).json({
    message: "All role permissions fetched successfully",
    data: permissions,
  });
};

/**
 * @desc Delete a role permission
 * @route DELETE /role-permissions/role/:roleId/section/:sectionKey
 */
export const deleteRolePermission = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const { roleId, sectionKey } = req.params;

  await rolePermissionService.deleteRolePermission(
    tenantId,
    branchId,
    roleId,
    sectionKey
  );

  return res.status(200).json({
    message: "Role permission deleted successfully",
  });
};
