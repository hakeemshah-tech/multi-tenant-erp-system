import {
  IndustrySubType,
  IIndustrySubType,
} from "@/database/models/industrySubType.model";
import { IndustryType } from "@/database/models/industryType.model";
import { AppError } from "@/common/utils/app-error";
import {
  CreateIndustrySubTypeInput,
  UpdateIndustrySubTypeInput,
} from "./industrySubType.types";
import mongoose from "mongoose";

/**
 * Create a new industry sub type
 */
export const createIndustrySubType = async (
  data: CreateIndustrySubTypeInput
): Promise<IIndustrySubType> => {
  // Validate that industry type exists
  if (!mongoose.Types.ObjectId.isValid(data.industryTypeId)) {
    throw new AppError("Invalid industry type ID", 400);
  }

  const industryType = await IndustryType.findOne({
    _id: data.industryTypeId,
    isDeleted: false,
  });

  if (!industryType) {
    throw new AppError("Industry type not found", 404);
  }

  const industrySubType = await IndustrySubType.create({
    name: data.name,
    description: data.description,
    code: data.code,
    industryTypeId: data.industryTypeId,
    isActive: data.isActive ?? true,
  });

  return industrySubType;
};

/**
 * Get all industry sub types (excluding soft-deleted)
 */
export const getIndustrySubTypes = async (
  includeDeleted: boolean = false,
  industryTypeId?: string
): Promise<IIndustrySubType[]> => {
  const query: any = {};

  if (!includeDeleted) {
    query.isDeleted = false;
  }

  if (industryTypeId) {
    query.industryTypeId = industryTypeId;
  }

  const industrySubTypes = await IndustrySubType.find(query)
    .populate("industryTypeId", "name code")
    .sort({ createdAt: -1 })
    .lean<IIndustrySubType[]>();
  return industrySubTypes;
};

/**
 * Get industry sub type by ID
 */
export const getIndustrySubTypeById = async (
  id: string
): Promise<IIndustrySubType> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid industry sub type ID", 400);
  }

  const industrySubType = await IndustrySubType.findOne({
    _id: id,
    isDeleted: false,
  })
    .populate("industryTypeId", "name code")
    .lean<IIndustrySubType>();

  if (!industrySubType) {
    throw new AppError("Industry sub type not found", 404);
  }

  return industrySubType;
};

/**
 * Update industry sub type by ID
 */
export const updateIndustrySubType = async (
  id: string,
  data: UpdateIndustrySubTypeInput
): Promise<IIndustrySubType> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid industry sub type ID", 400);
  }

  // If industryTypeId is being updated, validate it exists
  if (data.industryTypeId) {
    if (!mongoose.Types.ObjectId.isValid(data.industryTypeId)) {
      throw new AppError("Invalid industry type ID", 400);
    }

    const industryType = await IndustryType.findOne({
      _id: data.industryTypeId,
      isDeleted: false,
    });

    if (!industryType) {
      throw new AppError("Industry type not found", 404);
    }
  }

  const industrySubType = await IndustrySubType.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $set: data },
    { new: true, runValidators: true }
  )
    .populate("industryTypeId", "name code")
    .lean<IIndustrySubType>();

  if (!industrySubType) {
    throw new AppError("Industry sub type not found", 404);
  }

  return industrySubType;
};

/**
 * Soft delete industry sub type by ID
 */
export const deleteIndustrySubType = async (id: string): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid industry sub type ID", 400);
  }

  const industrySubType = await IndustrySubType.findOneAndUpdate(
    { _id: id, isDeleted: false },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!industrySubType) {
    throw new AppError("Industry sub type not found", 404);
  }
};
