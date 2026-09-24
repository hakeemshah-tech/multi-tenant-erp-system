import { Branch, IBranch } from "@/database/models/branch.model";
import { AppError } from "@/common/utils/app-error";
import {
  AddBranchAwardInput,
  UpdateBranchAwardInput,
} from "./branchAwards.types";
import mongoose from "mongoose";
import { Award } from "@/database/models/award.model";
import { AwardEmployeeType } from "@/database/models/awardEmployeeType.model";

/**
 * Get all awards for a branch
 */
export const getBranchAwards = async (
  branchId: string,
  tenantId: string
): Promise<IBranch | null> => {
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
    .populate({
      path: "awards.awardId",
      select: "title description icon",
    })
    .populate({
      path: "awards.awardEmployeeTypeIds",
      select: "title description",
    })
    .lean<IBranch>();

  if (!branch) {
    throw new AppError("Branch not found", 404);
  }

  return branch;
};

/**
 * Add an award to a branch
 */
export const addBranchAward = async (
  branchId: string,
  tenantId: string,
  data: AddBranchAwardInput
): Promise<IBranch> => {
  if (!mongoose.Types.ObjectId.isValid(branchId)) {
    throw new AppError("Invalid branch ID", 400);
  }

  if (!mongoose.Types.ObjectId.isValid(tenantId)) {
    throw new AppError("Invalid tenant ID", 400);
  }

  if (!mongoose.Types.ObjectId.isValid(data.awardId)) {
    throw new AppError("Invalid award ID", 400);
  }

  // Validate award exists
  const award = await Award.findById(data.awardId).lean();
  if (!award) {
    throw new AppError("Award not found", 404);
  }

  // Validate all award employee types exist and belong to the award
  const awardEmployeeTypeIds = data.awardEmployeeTypeIds.map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  const awardEmployeeTypes = await AwardEmployeeType.find({
    _id: { $in: awardEmployeeTypeIds },
    isDeleted: false,
  }).lean();

  if (awardEmployeeTypes.length !== data.awardEmployeeTypeIds.length) {
    throw new AppError("One or more award employee types not found", 404);
  }

  // Verify all award employee types belong to the selected award
  for (const type of awardEmployeeTypes) {
    const typeAwardId =
      typeof type.awardId === "object" ? type.awardId._id : type.awardId;
    if (String(typeAwardId) !== String(data.awardId)) {
      throw new AppError(
        `Award employee type "${type.title}" does not belong to the selected award`,
        400
      );
    }
  }

  const branch = await Branch.findOne({
    _id: branchId,
    tenantId: new mongoose.Types.ObjectId(tenantId),
    isDeleted: false,
  });

  if (!branch) {
    throw new AppError("Branch not found", 404);
  }

  // Check if award already exists in branch
  const existingAwardIndex = branch.awards?.findIndex(
    (a) => String(a.awardId) === String(data.awardId)
  );

  if (existingAwardIndex !== undefined && existingAwardIndex >= 0) {
    throw new AppError("Award already exists in this Organisation", 409);
  }

  // Add the award
  if (!branch.awards) {
    branch.awards = [];
  }

  branch.awards.push({
    awardId: new mongoose.Types.ObjectId(data.awardId),
    awardEmployeeTypeIds: awardEmployeeTypeIds,
  });

  await branch.save();

  // Return populated branch
  const populatedBranch = await Branch.findById(branch._id)
    .populate({
      path: "awards.awardId",
      select: "title description icon",
    })
    .populate({
      path: "awards.awardEmployeeTypeIds",
      select: "title description",
    })
    .lean<IBranch>();

  return populatedBranch!;
};

/**
 * Update award employee types for a branch award
 */
export const updateBranchAward = async (
  branchId: string,
  tenantId: string,
  awardId: string,
  data: UpdateBranchAwardInput
): Promise<IBranch> => {
  if (!mongoose.Types.ObjectId.isValid(branchId)) {
    throw new AppError("Invalid branch ID", 400);
  }

  if (!mongoose.Types.ObjectId.isValid(tenantId)) {
    throw new AppError("Invalid tenant ID", 400);
  }

  if (!mongoose.Types.ObjectId.isValid(awardId)) {
    throw new AppError("Invalid award ID", 400);
  }

  // Validate all award employee types exist and belong to the award
  const awardEmployeeTypeIds = data.awardEmployeeTypeIds.map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  const awardEmployeeTypes = await AwardEmployeeType.find({
    _id: { $in: awardEmployeeTypeIds },
    isDeleted: false,
  }).lean();

  if (awardEmployeeTypes.length !== data.awardEmployeeTypeIds.length) {
    throw new AppError("One or more award employee types not found", 404);
  }

  // Verify all award employee types belong to the selected award
  for (const type of awardEmployeeTypes) {
    const typeAwardId =
      typeof type.awardId === "object" ? type.awardId._id : type.awardId;
    if (String(typeAwardId) !== String(awardId)) {
      throw new AppError(
        `Award employee type "${type.title}" does not belong to the selected award`,
        400
      );
    }
  }

  const branch = await Branch.findOne({
    _id: branchId,
    tenantId: new mongoose.Types.ObjectId(tenantId),
    isDeleted: false,
  });

  if (!branch) {
    throw new AppError("Branch not found", 404);
  }

  // Find the award in branch
  const awardIndex = branch.awards?.findIndex(
    (a) => String(a.awardId) === String(awardId)
  );

  if (awardIndex === undefined || awardIndex < 0) {
    throw new AppError("Award not found in this branch", 404);
  }

  // Update the award employee types
  if (branch.awards) {
    branch.awards[awardIndex].awardEmployeeTypeIds = awardEmployeeTypeIds;
  }

  await branch.save();

  // Return populated branch
  const populatedBranch = await Branch.findById(branch._id)
    .populate({
      path: "awards.awardId",
      select: "title description icon",
    })
    .populate({
      path: "awards.awardEmployeeTypeIds",
      select: "title description",
    })
    .lean<IBranch>();

  return populatedBranch!;
};

/**
 * Remove an award from a branch
 */
export const removeBranchAward = async (
  branchId: string,
  tenantId: string,
  awardId: string
): Promise<IBranch> => {
  if (!mongoose.Types.ObjectId.isValid(branchId)) {
    throw new AppError("Invalid branch ID", 400);
  }

  if (!mongoose.Types.ObjectId.isValid(tenantId)) {
    throw new AppError("Invalid tenant ID", 400);
  }

  if (!mongoose.Types.ObjectId.isValid(awardId)) {
    throw new AppError("Invalid award ID", 400);
  }

  const branch = await Branch.findOne({
    _id: branchId,
    tenantId: new mongoose.Types.ObjectId(tenantId),
    isDeleted: false,
  });

  if (!branch) {
    throw new AppError("Branch not found", 404);
  }

  // Remove the award
  if (branch.awards) {
    branch.awards = branch.awards.filter(
      (a) => String(a.awardId) !== String(awardId)
    );
  }

  await branch.save();

  // Return populated branch
  const populatedBranch = await Branch.findById(branch._id)
    .populate({
      path: "awards.awardId",
      select: "title description icon",
    })
    .populate({
      path: "awards.awardEmployeeTypeIds",
      select: "title description",
    })
    .lean<IBranch>();

  return populatedBranch!;
};
