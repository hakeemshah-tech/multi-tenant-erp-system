import { Response } from "express";
import * as industrySubTypeService from "./industrySubType.service";
import {
  CreateIndustrySubTypeInput,
  UpdateIndustrySubTypeInput,
} from "./industrySubType.types";
import { WithAdmin } from "@/common/middlewares/adminMiddleware";
import { WithUser } from "@/common/middlewares/authMiddleware";

/**
 * @desc Create a new industry sub type
 * @route POST /admin/industry-sub-types
 */
export const createIndustrySubType = async (req: WithAdmin, res: Response) => {
  const data: CreateIndustrySubTypeInput = req.body;
  const industrySubType =
    await industrySubTypeService.createIndustrySubType(data);

  return res.status(201).json({
    message: "Industry sub type created successfully",
    data: industrySubType,
  });
};

/**
 * @desc Get all industry sub types
 * @route GET /admin/industry-sub-types or GET /industry-sub-types
 */
export const getIndustrySubTypes = async (
  req: WithAdmin | WithUser,
  res: Response
) => {
  const includeDeleted = req.query.includeDeleted === "true";
  const industryTypeId = req.query.industryTypeId as string | undefined;
  const industrySubTypes = await industrySubTypeService.getIndustrySubTypes(
    includeDeleted,
    industryTypeId
  );

  return res.status(200).json({
    message: "Industry sub types fetched successfully",
    data: industrySubTypes,
  });
};

/**
 * @desc Get industry sub type by ID
 * @route GET /admin/industry-sub-types/:id
 */
export const getIndustrySubTypeById = async (req: WithAdmin, res: Response) => {
  const { id } = req.params;
  const industrySubType =
    await industrySubTypeService.getIndustrySubTypeById(id);

  return res.status(200).json({
    message: "Industry sub type fetched successfully",
    data: industrySubType,
  });
};

/**
 * @desc Update industry sub type by ID
 * @route PUT /admin/industry-sub-types/:id
 */
export const updateIndustrySubType = async (req: WithAdmin, res: Response) => {
  const { id } = req.params;
  const data: UpdateIndustrySubTypeInput = req.body;
  const industrySubType = await industrySubTypeService.updateIndustrySubType(
    id,
    data
  );

  return res.status(200).json({
    message: "Industry sub type updated successfully",
    data: industrySubType,
  });
};

/**
 * @desc Delete industry sub type by ID (soft delete)
 * @route DELETE /admin/industry-sub-types/:id
 */
export const deleteIndustrySubType = async (req: WithAdmin, res: Response) => {
  const { id } = req.params;
  await industrySubTypeService.deleteIndustrySubType(id);

  return res.status(200).json({
    message: "Industry sub type deleted successfully",
  });
};
