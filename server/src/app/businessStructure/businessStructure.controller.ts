import { Response } from "express";
import * as businessStructureService from "./businessStructure.service";
import {
  CreateBusinessStructureInput,
  UpdateBusinessStructureInput,
} from "./businessStructure.types";
import { WithAdmin } from "@/common/middlewares/adminMiddleware";
import { WithUser } from "@/common/middlewares/authMiddleware";

/**
 * @desc Create a new business structure
 * @route POST /admin/business-structures
 */
export const createBusinessStructure = async (
  req: WithAdmin,
  res: Response
) => {
  const data: CreateBusinessStructureInput = req.body;
  const businessStructure =
    await businessStructureService.createBusinessStructure(data);

  return res.status(201).json({
    message: "Business structure created successfully",
    data: businessStructure,
  });
};

/**
 * @desc Get all business structures
 * @route GET /admin/business-structures or GET /business-structures
 */
export const getBusinessStructures = async (
  req: WithAdmin | WithUser,
  res: Response
) => {
  const includeDeleted = req.query.includeDeleted === "true";
  const businessStructures =
    await businessStructureService.getBusinessStructures(includeDeleted);

  return res.status(200).json({
    message: "Business structures fetched successfully",
    data: businessStructures,
  });
};

/**
 * @desc Get business structure by ID
 * @route GET /admin/business-structures/:id
 */
export const getBusinessStructureById = async (
  req: WithAdmin,
  res: Response
) => {
  const { id } = req.params;
  const businessStructure =
    await businessStructureService.getBusinessStructureById(id);

  return res.status(200).json({
    message: "Business structure fetched successfully",
    data: businessStructure,
  });
};

/**
 * @desc Update business structure by ID
 * @route PUT /admin/business-structures/:id
 */
export const updateBusinessStructure = async (
  req: WithAdmin,
  res: Response
) => {
  const { id } = req.params;
  const data: UpdateBusinessStructureInput = req.body;
  const businessStructure =
    await businessStructureService.updateBusinessStructure(id, data);

  return res.status(200).json({
    message: "Business structure updated successfully",
    data: businessStructure,
  });
};

/**
 * @desc Delete business structure by ID (soft delete)
 * @route DELETE /admin/business-structures/:id
 */
export const deleteBusinessStructure = async (
  req: WithAdmin,
  res: Response
) => {
  const { id } = req.params;
  await businessStructureService.deleteBusinessStructure(id);

  return res.status(200).json({
    message: "Business structure deleted successfully",
  });
};
