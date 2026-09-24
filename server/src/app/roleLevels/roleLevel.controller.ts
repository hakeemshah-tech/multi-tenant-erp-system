import { Response } from "express";
import * as roleLevelService from "./roleLevel.service";
import { CreateRoleLevelInput, UpdateRoleLevelInput } from "./roleLevel.types";
import { Types } from "mongoose";
import { WithUser } from "@/common/middlewares/authMiddleware";

/**
 * @desc Create a new role level
 * @route POST /role-levels
 */
export const createRoleLevel = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);

  const data: CreateRoleLevelInput = req.body;

  const roleLevel = await roleLevelService.createRoleLevel(
    tenantId,
    branchId,
    data
  );

  return res.status(201).json({
    message: "Role level created successfully",
    data: roleLevel,
  });
};

/**
 * @desc Get all role levels for a tenant
 * @route GET /role-levels
 */
export const getRoleLevels = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);

  const roleLevels = await roleLevelService.getRoleLevels(tenantId, branchId);

  return res.status(200).json({
    message: "Role levels fetched successfully",
    data: roleLevels,
  });
};

/**
 * @desc Get a single role level by ID
 * @route GET /role-levels/:roleLevelId
 */
export const getRoleLevelById = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const { roleLevelId } = req.params;

  const roleLevel = await roleLevelService.getRoleLevelById(
    tenantId,
    branchId,
    roleLevelId
  );

  return res.status(200).json({
    message: "Role level fetched successfully",
    data: roleLevel,
  });
};

/**
 * @desc Update a role level
 * @route PUT /role-levels/:roleLevelId
 */
export const updateRoleLevel = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const { roleLevelId } = req.params;
  const data: UpdateRoleLevelInput = req.body;

  const roleLevel = await roleLevelService.updateRoleLevel(
    tenantId,
    branchId,
    roleLevelId,
    data
  );

  return res.status(200).json({
    message: "Role level updated successfully",
    data: roleLevel,
  });
};

/**
 * @desc Delete a role level
 * @route DELETE /role-levels/:roleLevelId
 */
export const deleteRoleLevel = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const { roleLevelId } = req.params;

  await roleLevelService.deleteRoleLevel(tenantId, branchId, roleLevelId);

  return res.status(200).json({
    message: "Role level deleted successfully",
  });
};
