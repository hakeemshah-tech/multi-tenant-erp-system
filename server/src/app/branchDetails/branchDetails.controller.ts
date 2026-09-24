import { Response } from "express";
import * as branchDetailsService from "./branchDetails.service";
import { UpdateBranchDetailsInput } from "./branchDetails.types";
import { WithUser } from "@/common/middlewares/authMiddleware";

/**
 * @desc Get branch details by ID
 * @route GET /branches/:branchId/details
 */
export const getBranchDetails = async (req: WithUser, res: Response) => {
  const { branchId } = req.params;

  // If no activeAssignment (e.g., on accept-invite page), fetch branch without tenantId filter
  // This allows access from accept-invite page where user might not have activeAssignment yet
  if (!req.user.activeAssignment?.tenantId) {
    const branch =
      await branchDetailsService.getBranchDetailsByIdOnly(branchId);
    if (!branch) {
      return res.status(404).json({
        message: "Branch not found",
        status: "error",
      });
    }

    return res.status(200).json({
      message: "Branch details fetched successfully",
      data: branch,
    });
  }

  // If activeAssignment exists, use tenantId from it
  const tenantId = req.user.activeAssignment.tenantId as string;
  const branch = await branchDetailsService.getBranchDetails(
    branchId,
    tenantId
  );

  return res.status(200).json({
    message: "Branch details fetched successfully",
    data: branch,
  });
};

/**
 * @desc Update branch details
 * @route PUT /branches/:branchId/details
 */
export const updateBranchDetails = async (req: WithUser, res: Response) => {
  const { branchId } = req.params;
  const tenantId = req.user.activeAssignment.tenantId as string;
  const data: UpdateBranchDetailsInput = req.body;

  const branch = await branchDetailsService.updateBranchDetails(
    branchId,
    tenantId,
    data
  );

  return res.status(200).json({
    message: "Branch details updated successfully",
    data: branch,
  });
};
