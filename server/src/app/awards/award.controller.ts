import { Response } from "express";
import * as awardService from "./award.service";
import { CreateAwardInput, UpdateAwardInput } from "./award.types";
import { WithAdmin } from "@/common/middlewares/adminMiddleware";

/**
 * @desc Create a new award
 * @route POST /admin/awards
 */
export const createAward = async (req: WithAdmin, res: Response) => {
  const data: CreateAwardInput = req.body;
  const award = await awardService.createAward(data);

  return res.status(201).json({
    message: "Award created successfully",
    data: award,
  });
};

/**
 * @desc Get all awards
 * @route GET /admin/awards
 */
export const getAwards = async (req: WithAdmin, res: Response) => {
  const includeDeleted = req.query.includeDeleted === "true";
  const awards = await awardService.getAwards(includeDeleted);

  return res.status(200).json({
    message: "Awards fetched successfully",
    data: awards,
  });
};

/**
 * @desc Get award by ID
 * @route GET /admin/awards/:id
 */
export const getAwardById = async (req: WithAdmin, res: Response) => {
  const { id } = req.params;
  const award = await awardService.getAwardById(id);

  return res.status(200).json({
    message: "Award fetched successfully",
    data: award,
  });
};

/**
 * @desc Update award by ID
 * @route PUT /admin/awards/:id
 */
export const updateAward = async (req: WithAdmin, res: Response) => {
  const { id } = req.params;
  const data: UpdateAwardInput = req.body;
  const award = await awardService.updateAward(id, data);

  return res.status(200).json({
    message: "Award updated successfully",
    data: award,
  });
};

/**
 * @desc Delete award by ID (soft delete)
 * @route DELETE /admin/awards/:id
 */
export const deleteAward = async (req: WithAdmin, res: Response) => {
  const { id } = req.params;
  await awardService.deleteAward(id);

  return res.status(200).json({
    message: "Award deleted successfully",
  });
};
