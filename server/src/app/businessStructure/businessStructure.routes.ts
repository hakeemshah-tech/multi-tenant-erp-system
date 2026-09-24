import { Router } from "express";
import * as businessStructureController from "./businessStructure.controller";
import { validateBody } from "@/common/middlewares/zodMiddleware";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { requireAdmin } from "@/common/middlewares/adminMiddleware";
import {
  createBusinessStructureSchema,
  updateBusinessStructureSchema,
} from "./businessStructure.validation";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: BusinessStructures
 *   description: Business Structure management endpoints (Admin only)
 */

/**
 * @swagger
 * /admin/business-structures:
 *   post:
 *     summary: Create a new business structure
 *     tags: [BusinessStructures]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               code:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Business structure created successfully
 */
router.post(
  "/",
  requireAdmin,
  validateBody(createBusinessStructureSchema),
  asyncHandler(businessStructureController.createBusinessStructure)
);

/**
 * @swagger
 * /admin/business-structures:
 *   get:
 *     summary: Get all business structures
 *     tags: [BusinessStructures]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Business structures fetched successfully
 */
router.get(
  "/",
  requireAdmin,
  asyncHandler(businessStructureController.getBusinessStructures)
);

/**
 * @swagger
 * /admin/business-structures/{id}:
 *   get:
 *     summary: Get business structure by ID
 *     tags: [BusinessStructures]
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
 *         description: Business structure fetched successfully
 */
router.get(
  "/:id",
  requireAdmin,
  asyncHandler(businessStructureController.getBusinessStructureById)
);

/**
 * @swagger
 * /admin/business-structures/{id}:
 *   put:
 *     summary: Update business structure by ID
 *     tags: [BusinessStructures]
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               code:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Business structure updated successfully
 */
router.put(
  "/:id",
  requireAdmin,
  validateBody(updateBusinessStructureSchema),
  asyncHandler(businessStructureController.updateBusinessStructure)
);

/**
 * @swagger
 * /admin/business-structures/{id}:
 *   delete:
 *     summary: Delete business structure by ID (soft delete)
 *     tags: [BusinessStructures]
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
 *         description: Business structure deleted successfully
 */
router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(businessStructureController.deleteBusinessStructure)
);

export default router;
