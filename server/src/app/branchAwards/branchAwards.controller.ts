import { Response } from "express";
import { WithUser } from "@/common/middlewares/authMiddleware";
import * as branchAwardsService from "./branchAwards.service";
import {
  AddBranchAwardInput,
  UpdateBranchAwardInput,
} from "./branchAwards.types";

/**
 * @desc Get all awards for a branch
 * @route GET /branches/:branchId/awards
 */
export const getBranchAwards = async (req: WithUser, res: Response) => {
  const branchId = req.params.branchId;
  const tenantId = req.user.activeAssignment.tenantId;

  const branch = await branchAwardsService.getBranchAwards(
    branchId,
    tenantId as string
  );

  return res.status(200).json({
    message: "Branch awards fetched successfully",
    data: branch,
  });
};

/**
 * @desc Add an award to a branch
 * @route POST /branches/:branchId/awards
 */
export const addBranchAward = async (req: WithUser, res: Response) => {
  const branchId = req.params.branchId;
  const tenantId = req.user.activeAssignment.tenantId;
  const data: AddBranchAwardInput = req.body;

  const branch = await branchAwardsService.addBranchAward(
    branchId,
    tenantId as string,
    data
  );

  return res.status(201).json({
    message: "Award added to branch successfully",
    data: branch,
  });
};

/**
 * @desc Update award employee types for a branch award
 * @route PUT /branches/:branchId/awards/:awardId
 */
export const updateBranchAward = async (req: WithUser, res: Response) => {
  const branchId = req.params.branchId;
  const awardId = req.params.awardId;
  const tenantId = req.user.activeAssignment.tenantId;
  const data: UpdateBranchAwardInput = req.body;

  const branch = await branchAwardsService.updateBranchAward(
    branchId,
    tenantId as string,
    awardId,
    data
  );

  return res.status(200).json({
    message: "Branch award updated successfully",
    data: branch,
  });
};

/**
 * @desc Remove an award from a branch
 * @route DELETE /branches/:branchId/awards/:awardId
 */
export const removeBranchAward = async (req: WithUser, res: Response) => {
  const branchId = req.params.branchId;
  const awardId = req.params.awardId;
  const tenantId = req.user.activeAssignment.tenantId;

  const branch = await branchAwardsService.removeBranchAward(
    branchId,
    tenantId as string,
    awardId
  );

  return res.status(200).json({
    message: "Award removed from branch successfully",
    data: branch,
  });
};
