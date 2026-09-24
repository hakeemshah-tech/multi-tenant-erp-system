import { Response } from "express";
import * as industryTypeService from "./industryType.service";
import {
  CreateIndustryTypeInput,
  UpdateIndustryTypeInput,
} from "./industryType.types";
import { WithAdmin } from "@/common/middlewares/adminMiddleware";
import { WithUser } from "@/common/middlewares/authMiddleware";

/**
 * @desc Create a new industry type
 * @route POST /admin/industry-types
 */
export const createIndustryType = async (req: WithAdmin, res: Response) => {
  const data: CreateIndustryTypeInput = req.body;
  const industryType = await industryTypeService.createIndustryType(data);

  return res.status(201).json({
    message: "Industry type created successfully",
    data: industryType,
  });
};

/**
 * @desc Get all industry types
 * @route GET /admin/industry-types or GET /industry-types
 */
export const getIndustryTypes = async (
  req: WithAdmin | WithUser,
  res: Response
) => {
  const includeDeleted = req.query.includeDeleted === "true";
  const industryTypes =
    await industryTypeService.getIndustryTypes(includeDeleted);

  return res.status(200).json({
    message: "Industry types fetched successfully",
    data: industryTypes,
  });
};

/**
 * @desc Get industry type by ID
 * @route GET /admin/industry-types/:id
 */
export const getIndustryTypeById = async (req: WithAdmin, res: Response) => {
  const { id } = req.params;
  const industryType = await industryTypeService.getIndustryTypeById(id);

  return res.status(200).json({
    message: "Industry type fetched successfully",
    data: industryType,
  });
};

/**
 * @desc Update industry type by ID
 * @route PUT /admin/industry-types/:id
 */
export const updateIndustryType = async (req: WithAdmin, res: Response) => {
  const { id } = req.params;
  const data: UpdateIndustryTypeInput = req.body;
  const industryType = await industryTypeService.updateIndustryType(id, data);

  return res.status(200).json({
    message: "Industry type updated successfully",
    data: industryType,
  });
};

/**
 * @desc Delete industry type by ID (soft delete)
 * @route DELETE /admin/industry-types/:id
 */
export const deleteIndustryType = async (req: WithAdmin, res: Response) => {
  const { id } = req.params;
  await industryTypeService.deleteIndustryType(id);

  return res.status(200).json({
    message: "Industry type deleted successfully",
  });
};
