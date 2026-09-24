import { Response } from "express";
import * as roleService from "./role.service";
import { CreateRoleInput, UpdateRoleInput } from "./role.types";
import { Types } from "mongoose";
import { WithUser } from "@/common/middlewares/authMiddleware";

/**
 * @desc Create a new role
 * @route POST /roles
 */
export const createRole = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);

  const data: CreateRoleInput = req.body;

  const role = await roleService.createRole(tenantId, branchId, data);

  return res.status(201).json({
    message: "Role created successfully",
    data: role,
  });
};

/**
 * @desc Get all roles for a tenant
 * @route GET /roles
 */
export const getRoles = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);

  const roles = await roleService.getRoles(tenantId, branchId);

  return res.status(200).json({
    message: "Roles fetched successfully",
    data: roles,
  });
};

/**
 * @desc Get a single role by ID
 * @route GET /roles/:roleId
 */
export const getRoleById = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const { roleId } = req.params;

  const role = await roleService.getRoleById(tenantId, branchId, roleId);

  return res.status(200).json({
    message: "Role fetched successfully",
    data: role,
  });
};

/**
 * @desc Update a role
 * @route PUT /roles/:roleId
 */
export const updateRole = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const { roleId } = req.params;
  const data: UpdateRoleInput = req.body;

  const role = await roleService.updateRole(tenantId, branchId, roleId, data);

  return res.status(200).json({
    message: "Role updated successfully",
    data: role,
  });
};

/**
 * @desc Delete a role
 * @route DELETE /roles/:roleId
 */
export const deleteRole = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const { roleId } = req.params;

  await roleService.deleteRole(tenantId, branchId, roleId);

  return res.status(200).json({
    message: "Role deleted successfully",
  });
};
