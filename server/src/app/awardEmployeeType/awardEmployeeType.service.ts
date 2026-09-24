import {
  AwardEmployeeType,
  IAwardEmployeeType,
} from "@/database/models/awardEmployeeType.model";
import { AppError } from "@/common/utils/app-error";
import {
  CreateAwardEmployeeTypeInput,
  UpdateAwardEmployeeTypeInput,
} from "./awardEmployeeType.types";
import mongoose from "mongoose";

/**
 * Create a new award employee type
 */
export const createAwardEmployeeType = async (
  data: CreateAwardEmployeeTypeInput
): Promise<IAwardEmployeeType> => {
  if (!mongoose.Types.ObjectId.isValid(data.awardId)) {
    throw new AppError("Invalid award ID", 400);
  }

  const awardEmployeeType = await AwardEmployeeType.create({
    title: data.title,
    description: data.description,
    awardId: new mongoose.Types.ObjectId(data.awardId),
  });

  return awardEmployeeType;
};

/**
 * Get all award employee types (excluding soft-deleted)
 */
export const getAwardEmployeeTypes = async (
  includeDeleted: boolean = false
): Promise<IAwardEmployeeType[]> => {
  const query: any = {};

  if (!includeDeleted) {
    query.isDeleted = false;
  }

  const awardEmployeeTypes = await AwardEmployeeType.find(query)
    .populate("awardId", "title")
    .sort({ createdAt: -1 })
    .lean<IAwardEmployeeType[]>();
  return awardEmployeeTypes;
};

/**
 * Get award employee type by ID
 */
export const getAwardEmployeeTypeById = async (
  id: string
): Promise<IAwardEmployeeType> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid award employee type ID", 400);
  }

  const awardEmployeeType = await AwardEmployeeType.findOne({
    _id: id,
    isDeleted: false,
  })
    .populate("awardId", "title")
    .lean<IAwardEmployeeType>();

  if (!awardEmployeeType) {
    throw new AppError("Award employee type not found", 404);
  }

  return awardEmployeeType;
};

/**
 * Update award employee type by ID
 */
export const updateAwardEmployeeType = async (
  id: string,
  data: UpdateAwardEmployeeTypeInput
): Promise<IAwardEmployeeType> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid award employee type ID", 400);
  }

  const updateData: any = { ...data };

  if (data.awardId) {
    if (!mongoose.Types.ObjectId.isValid(data.awardId)) {
      throw new AppError("Invalid award ID", 400);
    }
    updateData.awardId = new mongoose.Types.ObjectId(data.awardId);
  }

  const awardEmployeeType = await AwardEmployeeType.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $set: updateData },
    { new: true, runValidators: true }
  )
    .populate("awardId", "title")
    .lean<IAwardEmployeeType>();

  if (!awardEmployeeType) {
    throw new AppError("Award employee type not found", 404);
  }

  return awardEmployeeType;
};

/**
 * Soft delete award employee type by ID
 */
export const deleteAwardEmployeeType = async (id: string): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid award employee type ID", 400);
  }

  const awardEmployeeType = await AwardEmployeeType.findOneAndUpdate(
    { _id: id, isDeleted: false },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!awardEmployeeType) {
    throw new AppError("Award employee type not found", 404);
  }
};
