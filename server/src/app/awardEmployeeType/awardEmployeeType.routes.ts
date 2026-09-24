import { Router } from "express";
import * as awardEmployeeTypeController from "./awardEmployeeType.controller";
import { validateBody } from "@/common/middlewares/zodMiddleware";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { requireAdmin } from "@/common/middlewares/adminMiddleware";
import {
  createAwardEmployeeTypeSchema,
  updateAwardEmployeeTypeSchema,
} from "./awardEmployeeType.validation";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: AwardEmployeeTypes
 *   description: Award Employee Type management endpoints (Admin only)
 */

/**
 * @swagger
 * /admin/award-employee-types:
 *   post:
 *     summary: Create a new award employee type
 *     tags: [AwardEmployeeTypes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Award employee type created successfully
 */
router.post(
  "/",
  requireAdmin,
  validateBody(createAwardEmployeeTypeSchema),
  asyncHandler(awardEmployeeTypeController.createAwardEmployeeType)
);

/**
 * @swagger
 * /admin/award-employee-types:
 *   get:
 *     summary: Get all award employee types
 *     tags: [AwardEmployeeTypes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Award employee types fetched successfully
 */
router.get(
  "/",
  requireAdmin,
  asyncHandler(awardEmployeeTypeController.getAwardEmployeeTypes)
);

/**
 * @swagger
 * /admin/award-employee-types/{id}:
 *   get:
 *     summary: Get award employee type by ID
 *     tags: [AwardEmployeeTypes]
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
 *         description: Award employee type fetched successfully
 */
router.get(
  "/:id",
  requireAdmin,
  asyncHandler(awardEmployeeTypeController.getAwardEmployeeTypeById)
);

/**
 * @swagger
 * /admin/award-employee-types/{id}:
 *   put:
 *     summary: Update award employee type by ID
 *     tags: [AwardEmployeeTypes]
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
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Award employee type updated successfully
 */
router.put(
  "/:id",
  requireAdmin,
  validateBody(updateAwardEmployeeTypeSchema),
  asyncHandler(awardEmployeeTypeController.updateAwardEmployeeType)
);

/**
 * @swagger
 * /admin/award-employee-types/{id}:
 *   delete:
 *     summary: Delete award employee type by ID (soft delete)
 *     tags: [AwardEmployeeTypes]
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
 *         description: Award employee type deleted successfully
 */
router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(awardEmployeeTypeController.deleteAwardEmployeeType)
);

export default router;
