import { Router } from "express";
import * as roleController from "./role.controller";
import { validateBody } from "@/common/middlewares/zodMiddleware";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { authenticate } from "@/common/middlewares/authMiddleware";
import { requireVerification } from "@/common/middlewares/requireVerification";
import { createRoleSchema, updateRoleSchema } from "./role.validation";
import { authorizeRoles } from "@/common/middlewares/authorize-roles.middleware";
import { checkPermission } from "@/common/middlewares/checkPermission";

const router = Router();

// Apply verification requirement to all role routes
router.use(authenticate, requireVerification);

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: Role management endpoints
 */

/**
 * @swagger
 * /roles:
 *   post:
 *     summary: Create a new role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roleId
 *               - name
 *               - color
 *             properties:
 *               roleId:
 *                 type: string
 *                 example: "hr_manager"
 *               name:
 *                 type: string
 *                 example: "HR Manager"
 *               description:
 *                 type: string
 *                 example: "HR department oversight"
 *               color:
 *                 type: string
 *                 enum: [purple, blue, green, amber, red, pink, teal, gray]
 *                 example: "blue"
 *     responses:
 *       201:
 *         description: Role created successfully
 */
router.post(
  "/",
  checkPermission({ section: "rbac", action: "write" }),
  validateBody(createRoleSchema),
  asyncHandler(roleController.createRole)
);

/**
 * @swagger
 * /roles:
 *   get:
 *     summary: Get all roles for the tenant
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Roles fetched successfully
 */
// Get all roles - allow tenant-owners and employees with job-titles read permission
router.get(
  "/",
  checkPermission({ section: "job-titles", action: "read" }),
  asyncHandler(roleController.getRoles)
);

/**
 * @swagger
 * /roles/{roleId}:
 *   get:
 *     summary: Get a single role by ID
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role fetched successfully
 */
router.get(
  "/:roleId",
  checkPermission({ section: "rbac", action: "read" }),
  asyncHandler(roleController.getRoleById)
);

/**
 * @swagger
 * /roles/{roleId}:
 *   put:
 *     summary: Update a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
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
 *               color:
 *                 type: string
 *                 enum: [purple, blue, green, amber, red, pink, teal, gray]
 *     responses:
 *       200:
 *         description: Role updated successfully
 */
router.put(
  "/:roleId",
  checkPermission({ section: "rbac", action: "write" }),
  validateBody(updateRoleSchema),
  asyncHandler(roleController.updateRole)
);

/**
 * @swagger
 * /roles/{roleId}:
 *   delete:
 *     summary: Delete a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role deleted successfully
 */
router.delete(
  "/:roleId",
  checkPermission({ section: "rbac", action: "delete" }),
  asyncHandler(roleController.deleteRole)
);

export default router;
