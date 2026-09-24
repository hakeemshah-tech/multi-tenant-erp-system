import {
  BusinessStructure,
  IBusinessStructure,
} from "@/database/models/businessStructure.model";
import { AppError } from "@/common/utils/app-error";
import {
  CreateBusinessStructureInput,
  UpdateBusinessStructureInput,
} from "./businessStructure.types";
import mongoose from "mongoose";

/**
 * Create a new business structure
 */
export const createBusinessStructure = async (
  data: CreateBusinessStructureInput
): Promise<IBusinessStructure> => {
  const businessStructure = await BusinessStructure.create({
    name: data.name,
    description: data.description,
    code: data.code,
    isActive: data.isActive ?? true,
  });

  return businessStructure;
};

/**
 * Get all business structures (excluding soft-deleted)
 */
export const getBusinessStructures = async (
  includeDeleted: boolean = false
): Promise<IBusinessStructure[]> => {
  const query: any = {};

  if (!includeDeleted) {
    query.isDeleted = false;
  }

  const businessStructures = await BusinessStructure.find(query)
    .sort({ createdAt: -1 })
    .lean<IBusinessStructure[]>();
  return businessStructures;
};

/**
 * Get business structure by ID
 */
export const getBusinessStructureById = async (
  id: string
): Promise<IBusinessStructure> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid business structure ID", 400);
  }

  const businessStructure = await BusinessStructure.findOne({
    _id: id,
    isDeleted: false,
  }).lean<IBusinessStructure>();

  if (!businessStructure) {
    throw new AppError("Business structure not found", 404);
  }

  return businessStructure;
};

/**
 * Update business structure by ID
 */
export const updateBusinessStructure = async (
  id: string,
  data: UpdateBusinessStructureInput
): Promise<IBusinessStructure> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid business structure ID", 400);
  }

  const businessStructure = await BusinessStructure.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $set: data },
    { new: true, runValidators: true }
  ).lean<IBusinessStructure>();

  if (!businessStructure) {
    throw new AppError("Business structure not found", 404);
  }

  return businessStructure;
};

/**
 * Soft delete business structure by ID
 */
export const deleteBusinessStructure = async (id: string): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid business structure ID", 400);
  }

  const businessStructure = await BusinessStructure.findOneAndUpdate(
    { _id: id, isDeleted: false },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!businessStructure) {
    throw new AppError("Business structure not found", 404);
  }
};
