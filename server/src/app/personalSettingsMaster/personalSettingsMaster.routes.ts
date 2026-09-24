import { Router } from "express";
import * as personalSettingsMasterController from "./personalSettingsMaster.controller";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { requireAdmin } from "@/common/middlewares/adminMiddleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: PersonalSettingsMaster
 *   description: Personal Settings Master data management endpoints (Admin only)
 */

/**
 * @swagger
 * /admin/personal-settings-master:
 *   get:
 *     summary: Get personal settings master data
 *     tags: [PersonalSettingsMaster]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Personal settings master data fetched successfully
 */
router.get(
  "/",
  requireAdmin,
  asyncHandler(personalSettingsMasterController.getPersonalSettingsMaster)
);

/**
 * @swagger
 * /admin/personal-settings-master:
 *   put:
 *     summary: Update personal settings master data
 *     tags: [PersonalSettingsMaster]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               gender:
 *                 type: object
 *                 properties:
 *                   options:
 *                     type: array
 *                     items:
 *                       type: string
 *               pronouns:
 *                 type: object
 *                 properties:
 *                   options:
 *                     type: array
 *                     items:
 *                       type: string
 *               residencystatus:
 *                 type: object
 *                 properties:
 *                   options:
 *                     type: array
 *                     items:
 *                       type: string
 *               typeofvisa:
 *                 type: object
 *                 properties:
 *                   options:
 *                     type: array
 *                     items:
 *                       type: string
 *     responses:
 *       200:
 *         description: Personal settings master data updated successfully
 */
router.put(
  "/",
  requireAdmin,
  asyncHandler(personalSettingsMasterController.updatePersonalSettingsMaster)
);

export default router;
