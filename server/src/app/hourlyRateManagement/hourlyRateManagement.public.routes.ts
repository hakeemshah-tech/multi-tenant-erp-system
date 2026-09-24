import { Router } from "express";
import * as hourlyRateManagementController from "./hourlyRateManagement.controller";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { authenticate } from "@/common/middlewares/authMiddleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Hourly Rate Managements (Public)
 *   description: Public read-only hourly rate management endpoints (accessible to authenticated users)
 */

/**
 * @swagger
 * /hourly-rate-managements/active:
 *   get:
 *     summary: Get active hourly rate management by awardId and awardEmployeeTypeId
 *     tags: [Hourly Rate Managements (Public)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: awardId
 *         required: true
 *         schema:
 *           type: string
 *         description: Award ID
 *       - in: query
 *         name: awardEmployeeTypeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Award Employee Type ID
 *     responses:
 *       200:
 *         description: Active hourly rate management fetched successfully
 */
router.get(
  "/active",
  authenticate,
  asyncHandler(hourlyRateManagementController.getActiveHourlyRateManagement)
);

export default router;
