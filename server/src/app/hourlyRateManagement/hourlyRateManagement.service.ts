import {
  HourlyRateManagement,
  IHourlyRateManagement,
} from "@/database/models/hourlyRateManagement.model";
import { Award } from "@/database/models/award.model";
import { AwardEmployeeType } from "@/database/models/awardEmployeeType.model";
import { AppError } from "@/common/utils/app-error";
import {
  CreateHourlyRateManagementInput,
  UpdateHourlyRateManagementInput,
} from "./hourlyRateManagement.types";
import mongoose from "mongoose";

/**
 * Create a new hourly rate management
 */
export const createHourlyRateManagement = async (
  data: CreateHourlyRateManagementInput
): Promise<IHourlyRateManagement> => {
  // Validate award exists
  const award = await Award.findOne({
    _id: data.awardId,
    isDeleted: false,
  });
  if (!award) {
    throw new AppError("Award not found", 404);
  }

  // Validate award employee type exists
  const awardEmployeeType = await AwardEmployeeType.findOne({
    _id: data.awardEmployeeTypeId,
    isDeleted: false,
  });
  if (!awardEmployeeType) {
    throw new AppError("Award employee type not found", 404);
  }

  // Validate date range if endDate is provided
  const startDate = new Date(data.startDate);
  const updateData: any = {
    awardId: new mongoose.Types.ObjectId(data.awardId),
    awardEmployeeTypeId: new mongoose.Types.ObjectId(data.awardEmployeeTypeId),
    startDate,
    rates: data.rates,
  };

  if (data.endDate) {
    const endDate = new Date(data.endDate);
    if (endDate < startDate) {
      throw new AppError(
        "End date must be greater than or equal to start date",
        400
      );
    }
    updateData.endDate = endDate;
  }

  const hourlyRateManagement = await HourlyRateManagement.create(updateData);

  return hourlyRateManagement;
};

/**
 * Get all hourly rate managements (excluding soft-deleted)
 */
export const getHourlyRateManagements = async (
  includeDeleted: boolean = false
): Promise<IHourlyRateManagement[]> => {
  const query: any = {};

  if (!includeDeleted) {
    query.isDeleted = false;
  }

  const hourlyRateManagements = await HourlyRateManagement.find(query)
    .populate("awardId", "title")
    .populate("awardEmployeeTypeId", "title")
    .sort({ createdAt: -1 })
    .lean<IHourlyRateManagement[]>();
  return hourlyRateManagements;
};

/**
 * Get hourly rate management by ID
 */
export const getHourlyRateManagementById = async (
  id: string
): Promise<IHourlyRateManagement> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid hourly rate management ID", 400);
  }

  const hourlyRateManagement = await HourlyRateManagement.findOne({
    _id: id,
    isDeleted: false,
  })
    .populate("awardId", "title")
    .populate("awardEmployeeTypeId", "title")
    .lean<IHourlyRateManagement>();

  if (!hourlyRateManagement) {
    throw new AppError("Hourly rate management not found", 404);
  }

  return hourlyRateManagement;
};

/**
 * Update hourly rate management by ID
 */
export const updateHourlyRateManagement = async (
  id: string,
  data: UpdateHourlyRateManagementInput
): Promise<IHourlyRateManagement> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid hourly rate management ID", 400);
  }

  // Validate award if provided
  if (data.awardId) {
    const award = await Award.findOne({
      _id: data.awardId,
      isDeleted: false,
    });
    if (!award) {
      throw new AppError("Award not found", 404);
    }
  }

  // Validate award employee type if provided
  if (data.awardEmployeeTypeId) {
    const awardEmployeeType = await AwardEmployeeType.findOne({
      _id: data.awardEmployeeTypeId,
      isDeleted: false,
    });
    if (!awardEmployeeType) {
      throw new AppError("Award employee type not found", 404);
    }
  }

  // Validate date range if both dates are provided
  if (data.startDate && data.endDate) {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    if (endDate < startDate) {
      throw new AppError(
        "End date must be greater than or equal to start date",
        400
      );
    }
  }

  // If only endDate is provided, validate against existing startDate
  if (data.endDate && !data.startDate) {
    const existing = await HourlyRateManagement.findOne({
      _id: id,
      isDeleted: false,
    });
    if (existing) {
      const endDate = new Date(data.endDate);
      if (endDate < existing.startDate) {
        throw new AppError(
          "End date must be greater than or equal to start date",
          400
        );
      }
    }
  }

  const updateData: any = {};
  if (data.awardId) {
    updateData.awardId = new mongoose.Types.ObjectId(data.awardId);
  }
  if (data.awardEmployeeTypeId) {
    updateData.awardEmployeeTypeId = new mongoose.Types.ObjectId(
      data.awardEmployeeTypeId
    );
  }
  if (data.startDate) {
    updateData.startDate = new Date(data.startDate);
  }
  if (data.endDate) {
    updateData.endDate = new Date(data.endDate);
  }
  if (data.rates) {
    updateData.rates = data.rates;
  }

  const hourlyRateManagement = await HourlyRateManagement.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $set: updateData },
    { new: true, runValidators: true }
  )
    .populate("awardId", "title")
    .populate("awardEmployeeTypeId", "title")
    .lean<IHourlyRateManagement>();

  if (!hourlyRateManagement) {
    throw new AppError("Hourly rate management not found", 404);
  }

  return hourlyRateManagement;
};

/**
 * Get active hourly rate management by awardId and awardEmployeeTypeId
 * Returns the rate management that is currently active (current date is between startDate and endDate, or endDate is null)
 */
export const getActiveHourlyRateManagement = async (
  awardId: string,
  awardEmployeeTypeId: string
): Promise<IHourlyRateManagement | null> => {
  if (!mongoose.Types.ObjectId.isValid(awardId)) {
    throw new AppError("Invalid award ID", 400);
  }
  if (!mongoose.Types.ObjectId.isValid(awardEmployeeTypeId)) {
    throw new AppError("Invalid award employee type ID", 400);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of day for comparison

  // Set end of day for endDate comparison (if endDate exists, it should be >= start of today)
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  // First, check if any records exist for this award/type combination (for debugging)
  const allRecords = await HourlyRateManagement.find({
    awardId: new mongoose.Types.ObjectId(awardId),
    awardEmployeeTypeId: new mongoose.Types.ObjectId(awardEmployeeTypeId),
    isDeleted: false,
  })
    .select("startDate endDate rates")
    .lean();

  if (allRecords.length === 0) {
    console.log(
      `No hourly rate management records found for awardId: ${awardId}, awardEmployeeTypeId: ${awardEmployeeTypeId}`
    );
    return null;
  }

  console.log(
    `Found ${allRecords.length} record(s) for awardId: ${awardId}, awardEmployeeTypeId: ${awardEmployeeTypeId}`
  );
  console.log("Records:", JSON.stringify(allRecords, null, 2));
  console.log("Today:", today.toISOString());

  // Build query: find rate management where:
  // - awardId and awardEmployeeTypeId match
  // - isDeleted is false
  // - startDate <= today (start date has passed or is today)
  // - (endDate is null/undefined OR endDate >= today)
  const query: any = {
    awardId: new mongoose.Types.ObjectId(awardId),
    awardEmployeeTypeId: new mongoose.Types.ObjectId(awardEmployeeTypeId),
    isDeleted: false,
    startDate: { $lte: endOfToday },
    $or: [
      { endDate: null },
      { endDate: { $exists: false } },
      { endDate: { $gte: today } },
    ],
  };

  console.log("Query:", JSON.stringify(query, null, 2));

  const hourlyRateManagement = await HourlyRateManagement.findOne(query)
    .populate("awardId", "title")
    .populate("awardEmployeeTypeId", "title")
    .sort({ startDate: -1 }) // Get the most recent one if multiple match
    .lean<IHourlyRateManagement>();

  if (!hourlyRateManagement) {
    console.log(
      "No active hourly rate management found matching date criteria"
    );
  } else {
    console.log("Found active hourly rate management:", {
      _id: hourlyRateManagement._id,
      ratesCount: hourlyRateManagement.rates?.length || 0,
      startDate: hourlyRateManagement.startDate,
      endDate: hourlyRateManagement.endDate,
    });
  }

  return hourlyRateManagement || null;
};

/**
 * Soft delete hourly rate management by ID
 */
export const deleteHourlyRateManagement = async (id: string): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid hourly rate management ID", 400);
  }

  const hourlyRateManagement = await HourlyRateManagement.findOneAndUpdate(
    { _id: id, isDeleted: false },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!hourlyRateManagement) {
    throw new AppError("Hourly rate management not found", 404);
  }
};
