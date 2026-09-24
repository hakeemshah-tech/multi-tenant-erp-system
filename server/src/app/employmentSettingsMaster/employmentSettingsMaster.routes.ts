import { Router } from "express";
import * as employmentSettingsMasterController from "./employmentSettingsMaster.controller";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { requireAdmin } from "@/common/middlewares/adminMiddleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: EmploymentSettingsMaster
 *   description: Employment Settings Master data management endpoints (Admin only)
 */

/**
 * @swagger
 * /admin/employment-settings-master:
 *   get:
 *     summary: Get employment settings master data
 *     tags: [EmploymentSettingsMaster]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Employment settings master data fetched successfully
 */
router.get(
  "/",
  requireAdmin,
  asyncHandler(employmentSettingsMasterController.getEmploymentSettingsMaster)
);

/**
 * @swagger
 * /admin/employment-settings-master:
 *   put:
 *     summary: Update employment settings master data
 *     tags: [EmploymentSettingsMaster]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               worktype:
 *                 type: object
 *                 properties:
 *                   options:
 *                     type: array
 *                     items:
 *                       type: string
 *               employeetype:
 *                 type: object
 *                 properties:
 *                   options:
 *                     type: array
 *                     items:
 *                       type: string
 *               employmentstatus:
 *                 type: object
 *                 properties:
 *                   options:
 *                     type: array
 *                     items:
 *                       type: string
 *     responses:
 *       200:
 *         description: Employment settings master data updated successfully
 */
router.put(
  "/",
  requireAdmin,
  asyncHandler(
    employmentSettingsMasterController.updateEmploymentSettingsMaster
  )
);

export default router;
