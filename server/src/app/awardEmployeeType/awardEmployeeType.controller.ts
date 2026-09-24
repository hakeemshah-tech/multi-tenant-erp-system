import { Response } from "express";
import * as awardEmployeeTypeService from "./awardEmployeeType.service";
import {
  CreateAwardEmployeeTypeInput,
  UpdateAwardEmployeeTypeInput,
} from "./awardEmployeeType.types";
import { WithAdmin } from "@/common/middlewares/adminMiddleware";

/**
 * @desc Create a new award employee type
 * @route POST /admin/award-employee-types
 */
export const createAwardEmployeeType = async (
  req: WithAdmin,
  res: Response
) => {
  const data: CreateAwardEmployeeTypeInput = req.body;
  const awardEmployeeType =
    await awardEmployeeTypeService.createAwardEmployeeType(data);

  return res.status(201).json({
    message: "Award employee type created successfully",
    data: awardEmployeeType,
  });
};

/**
 * @desc Get all award employee types
 * @route GET /admin/award-employee-types
 */
export const getAwardEmployeeTypes = async (req: WithAdmin, res: Response) => {
  const includeDeleted = req.query.includeDeleted === "true";
  const awardEmployeeTypes =
    await awardEmployeeTypeService.getAwardEmployeeTypes(includeDeleted);

  return res.status(200).json({
    message: "Award employee types fetched successfully",
    data: awardEmployeeTypes,
  });
};

/**
 * @desc Get award employee type by ID
 * @route GET /admin/award-employee-types/:id
 */
export const getAwardEmployeeTypeById = async (
  req: WithAdmin,
  res: Response
) => {
  const { id } = req.params;
  const awardEmployeeType =
    await awardEmployeeTypeService.getAwardEmployeeTypeById(id);

  return res.status(200).json({
    message: "Award employee type fetched successfully",
    data: awardEmployeeType,
  });
};

/**
 * @desc Update award employee type by ID
 * @route PUT /admin/award-employee-types/:id
 */
export const updateAwardEmployeeType = async (
  req: WithAdmin,
  res: Response
) => {
  const { id } = req.params;
  const data: UpdateAwardEmployeeTypeInput = req.body;
  const awardEmployeeType =
    await awardEmployeeTypeService.updateAwardEmployeeType(id, data);

  return res.status(200).json({
    message: "Award employee type updated successfully",
    data: awardEmployeeType,
  });
};

/**
 * @desc Delete award employee type by ID (soft delete)
 * @route DELETE /admin/award-employee-types/:id
 */
export const deleteAwardEmployeeType = async (
  req: WithAdmin,
  res: Response
) => {
  const { id } = req.params;
  await awardEmployeeTypeService.deleteAwardEmployeeType(id);

  return res.status(200).json({
    message: "Award employee type deleted successfully",
  });
};
