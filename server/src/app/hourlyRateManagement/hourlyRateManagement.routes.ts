import { Router } from "express";
import * as hourlyRateManagementController from "./hourlyRateManagement.controller";
import { validateBody } from "@/common/middlewares/zodMiddleware";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { requireAdmin } from "@/common/middlewares/adminMiddleware";
import {
  createHourlyRateManagementSchema,
  updateHourlyRateManagementSchema,
} from "./hourlyRateManagement.validation";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: HourlyRateManagements
 *   description: Hourly Rate Management endpoints (Admin only)
 */

/**
 * @swagger
 * /admin/hourly-rate-managements:
 *   post:
 *     summary: Create a new hourly rate management
 *     tags: [HourlyRateManagements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - awardId
 *               - awardEmployeeTypeId
 *               - startDate
 *               - endDate
 *               - rates
 *             properties:
 *               awardId:
 *                 type: string
 *               awardEmployeeTypeId:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               rates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     level:
 *                       type: number
 *                     baseMinimumHourlyRates:
 *                       type: number
 *     responses:
 *       201:
 *         description: Hourly rate management created successfully
 */
router.post(
  "/",
  requireAdmin,
  validateBody(createHourlyRateManagementSchema),
  asyncHandler(hourlyRateManagementController.createHourlyRateManagement)
);

/**
 * @swagger
 * /admin/hourly-rate-managements:
 *   get:
 *     summary: Get all hourly rate managements
 *     tags: [HourlyRateManagements]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hourly rate managements fetched successfully
 */
router.get(
  "/",
  requireAdmin,
  asyncHandler(hourlyRateManagementController.getHourlyRateManagements)
);

/**
 * @swagger
 * /admin/hourly-rate-managements/{id}:
 *   get:
 *     summary: Get hourly rate management by ID
 *     tags: [HourlyRateManagements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hourly rate management fetched successfully
 */
router.get(
  "/:id",
  requireAdmin,
  asyncHandler(hourlyRateManagementController.getHourlyRateManagementById)
);

/**
 * @swagger
 * /admin/hourly-rate-managements/{id}:
 *   put:
 *     summary: Update hourly rate management by ID
 *     tags: [HourlyRateManagements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               awardId:
 *                 type: string
 *               awardEmployeeTypeId:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               rates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     level:
 *                       type: number
 *                     baseMinimumHourlyRates:
 *                       type: number
 *     responses:
 *       200:
 *         description: Hourly rate management updated successfully
 */
router.put(
  "/:id",
  requireAdmin,
  validateBody(updateHourlyRateManagementSchema),
  asyncHandler(hourlyRateManagementController.updateHourlyRateManagement)
);

/**
 * @swagger
 * /admin/hourly-rate-managements/{id}:
 *   delete:
 *     summary: Delete hourly rate management by ID (soft delete)
 *     tags: [HourlyRateManagements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hourly rate management deleted successfully
 */
router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(hourlyRateManagementController.deleteHourlyRateManagement)
);

export default router;
