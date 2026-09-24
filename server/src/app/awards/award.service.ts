import { Award, IAward } from "@/database/models/award.model";
import { AppError } from "@/common/utils/app-error";
import { CreateAwardInput, UpdateAwardInput } from "./award.types";
import mongoose from "mongoose";

/**
 * Create a new award
 */
export const createAward = async (data: CreateAwardInput): Promise<IAward> => {
  const award = await Award.create({
    title: data.title,
    description: data.description,
    icon: data.icon,
    isActive: data.isActive ?? true,
  });

  return award;
};

/**
 * Get all awards (excluding soft-deleted)
 */
export const getAwards = async (
  includeDeleted: boolean = false
): Promise<IAward[]> => {
  const query: any = {};

  if (!includeDeleted) {
    query.isDeleted = false;
  }

  const awards = await Award.find(query)
    .sort({ createdAt: -1 })
    .lean<IAward[]>();
  return awards;
};

/**
 * Get award by ID
 */
export const getAwardById = async (id: string): Promise<IAward> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid award ID", 400);
  }

  const award = await Award.findOne({
    _id: id,
    isDeleted: false,
  }).lean<IAward>();

  if (!award) {
    throw new AppError("Award not found", 404);
  }

  return award;
};

/**
 * Update award by ID
 */
export const updateAward = async (
  id: string,
  data: UpdateAwardInput
): Promise<IAward> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid award ID", 400);
  }

  const award = await Award.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $set: data },
    { new: true, runValidators: true }
  ).lean<IAward>();

  if (!award) {
    throw new AppError("Award not found", 404);
  }

  return award;
};

/**
 * Soft delete award by ID
 */
export const deleteAward = async (id: string): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid award ID", 400);
  }

  const award = await Award.findOneAndUpdate(
    { _id: id, isDeleted: false },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!award) {
    throw new AppError("Award not found", 404);
  }
};
