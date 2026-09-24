import { Response } from "express";
import * as hourlyRateManagementService from "./hourlyRateManagement.service";
import {
  CreateHourlyRateManagementInput,
  UpdateHourlyRateManagementInput,
} from "./hourlyRateManagement.types";
import { WithAdmin } from "@/common/middlewares/adminMiddleware";

/**
 * @desc Create a new hourly rate management
 * @route POST /admin/hourly-rate-managements
 */
export const createHourlyRateManagement = async (
  req: WithAdmin,
  res: Response
) => {
  const data: CreateHourlyRateManagementInput = req.body;
  const hourlyRateManagement =
    await hourlyRateManagementService.createHourlyRateManagement(data);

  return res.status(201).json({
    message: "Hourly rate management created successfully",
    data: hourlyRateManagement,
  });
};

/**
 * @desc Get all hourly rate managements
 * @route GET /admin/hourly-rate-managements
 */
export const getHourlyRateManagements = async (
  req: WithAdmin,
  res: Response
) => {
  const includeDeleted = req.query.includeDeleted === "true";
  const hourlyRateManagements =
    await hourlyRateManagementService.getHourlyRateManagements(includeDeleted);

  return res.status(200).json({
    message: "Hourly rate managements fetched successfully",
    data: hourlyRateManagements,
  });
};

/**
 * @desc Get hourly rate management by ID
 * @route GET /admin/hourly-rate-managements/:id
 */
export const getHourlyRateManagementById = async (
  req: WithAdmin,
  res: Response
) => {
  const { id } = req.params;
  const hourlyRateManagement =
    await hourlyRateManagementService.getHourlyRateManagementById(id);

  return res.status(200).json({
    message: "Hourly rate management fetched successfully",
    data: hourlyRateManagement,
  });
};

/**
 * @desc Update hourly rate management by ID
 * @route PUT /admin/hourly-rate-managements/:id
 */
export const updateHourlyRateManagement = async (
  req: WithAdmin,
  res: Response
) => {
  const { id } = req.params;
  const data: UpdateHourlyRateManagementInput = req.body;
  const hourlyRateManagement =
    await hourlyRateManagementService.updateHourlyRateManagement(id, data);

  return res.status(200).json({
    message: "Hourly rate management updated successfully",
    data: hourlyRateManagement,
  });
};

/**
 * @desc Delete hourly rate management by ID (soft delete)
 * @route DELETE /admin/hourly-rate-managements/:id
 */
export const deleteHourlyRateManagement = async (
  req: WithAdmin,
  res: Response
) => {
  const { id } = req.params;
  await hourlyRateManagementService.deleteHourlyRateManagement(id);

  return res.status(200).json({
    message: "Hourly rate management deleted successfully",
  });
};

/**
 * @desc Get active hourly rate management by awardId and awardEmployeeTypeId (public endpoint)
 * @route GET /hourly-rate-managements/active
 */
export const getActiveHourlyRateManagement = async (
  req: any,
  res: Response
) => {
  const { awardId, awardEmployeeTypeId } = req.query;

  if (!awardId || !awardEmployeeTypeId) {
    return res.status(400).json({
      message: "awardId and awardEmployeeTypeId are required",
    });
  }

  try {
    const hourlyRateManagement =
      await hourlyRateManagementService.getActiveHourlyRateManagement(
        awardId as string,
        awardEmployeeTypeId as string
      );

    if (!hourlyRateManagement) {
      return res.status(200).json({
        message: "No active hourly rate management found",
        data: null,
      });
    }

    return res.status(200).json({
      message: "Active hourly rate management fetched successfully",
      data: hourlyRateManagement,
    });
  } catch (error: any) {
    console.error("Error fetching active hourly rate management:", error);
    return res.status(500).json({
      message: error.message || "Failed to fetch hourly rate management",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};
