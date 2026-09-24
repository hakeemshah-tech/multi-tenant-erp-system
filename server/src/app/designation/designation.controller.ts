import { Response } from "express";
import * as designationService from "./designation.service";
import {
  CreateDesignationInput,
  UpdateDesignationInput,
} from "./designation.types";
import { Types } from "mongoose";
import { WithUser } from "@/common/middlewares/authMiddleware";
import { WithPagination } from "@/common/middlewares/paginationMiddleware";

/**
 * @desc Create a new designation
 * @route POST /designations
 */
export const createDesignation = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);

  const data: CreateDesignationInput & { selectedDocumentFields?: string[] } =
    req.body;

  const designation = await designationService.createDesignation(
    tenantId,
    branchId,
    data,
    {
      req,
      actorUserId: req.user.userId ?? null,
      actorEmail: req.user.email ?? null,
      actorName: req.user.fullName ?? null,
    }
  );

  return res.status(201).json({
    message: "Designation created successfully",
    data: designation,
  });
};

/**
 * @desc Get all designations for a tenant and branch
 * @route GET /designations
 */
export const getDesignations = async (req: WithUser, res: Response) => {
  const { tenantId, branchId } = req.user.activeAssignment;
  const { skip, limit } = (req as WithPagination).pagination || {};
  const status =
    (req.query.status as "active" | "inactive" | "all") || "active";
  const search = (req.query.search as string) || undefined;

  const tenantObjId = new Types.ObjectId(tenantId);
  const branchObjId = new Types.ObjectId(branchId);

  // Fetch paginated data
  const designations = await designationService.getDesignations(
    tenantObjId,
    branchObjId,
    { skip, limit, search, status }
  );

  // Fetch total count without pagination
  const total = await designationService.getDesignationCount(
    tenantObjId,
    branchObjId,
    status
  );

  return res.status(200).json({
    message: "Fetched designations successfully",
    data: designations,
    total,
  });
};

/**
 * @desc Get a specific designation by ID
 * @route GET /designations/:id
 */
export const getDesignationById = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const designationId = req.params.id;

  const designation = await designationService.getDesignationById(
    designationId,
    tenantId,
    branchId
  );

  return res.status(200).json({
    message: "Fetched designation successfully",
    data: designation,
  });
};

/**
 * @desc Update designation by ID
 * @route PUT /designations/:id
 */
export const updateDesignation = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const designationId = req.params.id;
  const data: UpdateDesignationInput & { selectedDocumentFields?: string[] } =
    req.body;

  const updated = await designationService.updateDesignation(
    designationId,
    tenantId,
    branchId,
    data,
    {
      req,
      actorUserId: req.user.userId ?? null,
      actorEmail: req.user.email ?? null,
      actorName: req.user.fullName ?? null,
    }
  );

  return res.status(200).json({
    message: "Designation updated successfully",
    data: updated,
  });
};

/**
 * @desc Soft delete a designation by ID
 * @route DELETE /designations/:id
 */
export const deleteDesignation = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const designationId = req.params.id;

  const result = await designationService.deleteDesignation(
    designationId,
    tenantId,
    branchId
  );

  return res.status(200).json({
    message: result.message,
  });
};

/**
 * @desc Toggle designation active/inactive status
 * @route PATCH /designations/:id/toggle-status
 */
export const toggleDesignationStatus = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const designationId = req.params.id;

  const result = await designationService.toggleDesignationStatus(
    designationId,
    tenantId,
    branchId,
    {
      req,
      actorUserId: req.user.userId ?? null,
      actorEmail: req.user.email ?? null,
      actorName: req.user.fullName ?? null,
    }
  );

  return res.status(200).json({
    message: result.message,
    data: result.data,
  });
};
