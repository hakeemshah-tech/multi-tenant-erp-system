import { Branch, IBranch } from "@/database/models/branch.model";
import { AppError } from "@/common/utils/app-error";
import { UpdateBranchDetailsInput } from "./branchDetails.types";
import mongoose from "mongoose";

/**
 * Get branch details by ID only (without tenantId filter)
 * Used when activeAssignment is not available
 */
export const getBranchDetailsByIdOnly = async (
  branchId: string
): Promise<IBranch | null> => {
  if (!mongoose.Types.ObjectId.isValid(branchId)) {
    return null;
  }

  const branch = await Branch.findOne({
    _id: branchId,
    isDeleted: false,
  })
    .populate("businessStructureId", "name code")
    .populate("industryTypeIds", "name code")
    .populate("industrySubTypeIds", "name code industryTypeId")
    .lean<IBranch>();

  return branch;
};

/**
 * Get branch details by ID
 */
export const getBranchDetails = async (
  branchId: string,
  tenantId: string
): Promise<IBranch> => {
  if (!mongoose.Types.ObjectId.isValid(branchId)) {
    throw new AppError("Invalid branch ID", 400);
  }

  if (!mongoose.Types.ObjectId.isValid(tenantId)) {
    throw new AppError("Invalid tenant ID", 400);
  }

  const branch = await Branch.findOne({
    _id: branchId,
    tenantId: new mongoose.Types.ObjectId(tenantId),
    isDeleted: false,
  })
    .populate("businessStructureId", "name code")
    .populate("industryTypeIds", "name code")
    .populate("industrySubTypeIds", "name code industryTypeId")
    .lean<IBranch>();

  if (!branch) {
    throw new AppError("Branch not found", 404);
  }

  return branch;
};

/**
 * Update branch details
 */
export const updateBranchDetails = async (
  branchId: string,
  tenantId: string,
  data: UpdateBranchDetailsInput
): Promise<IBranch> => {
  if (!mongoose.Types.ObjectId.isValid(branchId)) {
    throw new AppError("Invalid branch ID", 400);
  }

  if (!mongoose.Types.ObjectId.isValid(tenantId)) {
    throw new AppError("Invalid tenant ID", 400);
  }

  const branch = await Branch.findOne({
    _id: branchId,
    tenantId: new mongoose.Types.ObjectId(tenantId),
    isDeleted: false,
  });

  if (!branch) {
    throw new AppError("Branch not found", 404);
  }

  // Prepare update data
  const updateData: any = {};

  if (data.logo !== undefined) updateData.logo = data.logo;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.abn !== undefined) updateData.abn = data.abn;
  if (data.acn !== undefined) updateData.acn = data.acn;
  if (data.businessStructureId !== undefined) {
    updateData.businessStructureId = data.businessStructureId
      ? new mongoose.Types.ObjectId(data.businessStructureId)
      : null;
  }
  if (data.industryTypeIds !== undefined) {
    updateData.industryTypeIds = data.industryTypeIds.map(
      (id) => new mongoose.Types.ObjectId(id)
    );
  }
  if (data.industrySubTypeIds !== undefined) {
    updateData.industrySubTypeIds = data.industrySubTypeIds.map(
      (id) => new mongoose.Types.ObjectId(id)
    );
  }
  if (data.addresses !== undefined) updateData.addresses = data.addresses;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.websiteUrl !== undefined) updateData.websiteUrl = data.websiteUrl;
  if (data.physicalWorkLocations !== undefined)
    updateData.physicalWorkLocations = data.physicalWorkLocations;
  if (data.businessHoursOfOperation !== undefined)
    updateData.businessHoursOfOperation = data.businessHoursOfOperation;
  if (data.isNotForProfit !== undefined)
    updateData.isNotForProfit = data.isNotForProfit;
  if (data.isSalaryPackagingAvailable !== undefined)
    updateData.isSalaryPackagingAvailable = data.isSalaryPackagingAvailable;
  if (data.salaryPackagingMaximumAmount !== undefined)
    updateData.salaryPackagingMaximumAmount = data.salaryPackagingMaximumAmount;

  // If salary packaging is not available, clear the maximum amount
  if (data.isSalaryPackagingAvailable === false) {
    updateData.salaryPackagingMaximumAmount = null;
  }

  Object.assign(branch, updateData);
  await branch.save();

  // Return populated branch
  const populatedBranch = await Branch.findById(branch._id)
    .populate("businessStructureId", "name code")
    .populate("industryTypeIds", "name code")
    .populate("industrySubTypeIds", "name code industryTypeId")
    .lean<IBranch>();

  return populatedBranch!;
};
