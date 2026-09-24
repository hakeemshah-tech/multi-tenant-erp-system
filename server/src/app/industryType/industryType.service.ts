import {
  IndustryType,
  IIndustryType,
} from "@/database/models/industryType.model";
import { AppError } from "@/common/utils/app-error";
import {
  CreateIndustryTypeInput,
  UpdateIndustryTypeInput,
} from "./industryType.types";
import mongoose from "mongoose";

/**
 * Create a new industry type
 */
export const createIndustryType = async (
  data: CreateIndustryTypeInput
): Promise<IIndustryType> => {
  const industryType = await IndustryType.create({
    name: data.name,
    description: data.description,
    isActive: data.isActive ?? true,
  });

  return industryType;
};

/**
 * Get all industry types (excluding soft-deleted)
 */
export const getIndustryTypes = async (
  includeDeleted: boolean = false
): Promise<IIndustryType[]> => {
  const query: any = {};

  if (!includeDeleted) {
    query.isDeleted = false;
  }

  const industryTypes = await IndustryType.find(query)
    .sort({ createdAt: -1 })
    .lean<IIndustryType[]>();
  return industryTypes;
};

/**
 * Get industry type by ID
 */
export const getIndustryTypeById = async (
  id: string
): Promise<IIndustryType> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid industry type ID", 400);
  }

  const industryType = await IndustryType.findOne({
    _id: id,
    isDeleted: false,
  }).lean<IIndustryType>();

  if (!industryType) {
    throw new AppError("Industry type not found", 404);
  }

  return industryType;
};

/**
 * Update industry type by ID
 */
export const updateIndustryType = async (
  id: string,
  data: UpdateIndustryTypeInput
): Promise<IIndustryType> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid industry type ID", 400);
  }

  const industryType = await IndustryType.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $set: data },
    { new: true, runValidators: true }
  ).lean<IIndustryType>();

  if (!industryType) {
    throw new AppError("Industry type not found", 404);
  }

  return industryType;
};

/**
 * Soft delete industry type by ID
 */
export const deleteIndustryType = async (id: string): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid industry type ID", 400);
  }

  const industryType = await IndustryType.findOneAndUpdate(
    { _id: id, isDeleted: false },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!industryType) {
    throw new AppError("Industry type not found", 404);
  }
};
