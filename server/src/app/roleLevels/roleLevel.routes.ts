import { Router } from "express";
import * as roleLevelController from "./roleLevel.controller";
import { validateBody } from "@/common/middlewares/zodMiddleware";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { authenticate } from "@/common/middlewares/authMiddleware";
import { requireVerification } from "@/common/middlewares/requireVerification";
import {
  createRoleLevelSchema,
  updateRoleLevelSchema,
} from "./roleLevel.validation";
import { authorizeRoles } from "@/common/middlewares/authorize-roles.middleware";
import { checkPermission } from "@/common/middlewares/checkPermission";

const router = Router();

// Apply verification requirement to all role level routes
router.use(authenticate, requireVerification);

/**
 * @swagger
 * tags:
 *   name: Role Levels
 *   description: Role level management endpoints
 */

/**
 * @swagger
 * /role-levels:
 *   post:
 *     summary: Create a new role level
 *     tags: [Role Levels]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - level
 *               - name
 *             properties:
 *               level:
 *                 type: number
 *                 example: 1
 *               name:
 *                 type: string
 *                 example: "Base Level - Worker"
 *               description:
 *                 type: string
 *                 example: "Entry level position"
 *     responses:
 *       201:
 *         description: Role level created successfully
 */
router.post(
  "/",
  checkPermission({ section: "role-levels", action: "write" }),
  validateBody(createRoleLevelSchema),
  asyncHandler(roleLevelController.createRoleLevel)
);

/**
 * @swagger
 * /role-levels:
 *   get:
 *     summary: Get all role levels for the tenant
 *     tags: [Role Levels]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Role levels fetched successfully
 */
router.get(
  "/",
  checkPermission({ section: "role-levels", action: "read" }),
  asyncHandler(roleLevelController.getRoleLevels)
);

/**
 * @swagger
 * /role-levels/{roleLevelId}:
 *   get:
 *     summary: Get a single role level by ID
 *     tags: [Role Levels]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleLevelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role level fetched successfully
 */
router.get(
  "/:roleLevelId",
  checkPermission({ section: "role-levels", action: "read" }),
  asyncHandler(roleLevelController.getRoleLevelById)
);

/**
 * @swagger
 * /role-levels/{roleLevelId}:
 *   put:
 *     summary: Update a role level
 *     tags: [Role Levels]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleLevelId
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
 *               level:
 *                 type: number
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Role level updated successfully
 */
router.put(
  "/:roleLevelId",
  checkPermission({ section: "role-levels", action: "write" }),
  validateBody(updateRoleLevelSchema),
  asyncHandler(roleLevelController.updateRoleLevel)
);

/**
 * @swagger
 * /role-levels/{roleLevelId}:
 *   delete:
 *     summary: Delete a role level
 *     tags: [Role Levels]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleLevelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role level deleted successfully
 */
router.delete(
  "/:roleLevelId",
  checkPermission({ section: "role-levels", action: "delete" }),
  asyncHandler(roleLevelController.deleteRoleLevel)
);

export default router;
