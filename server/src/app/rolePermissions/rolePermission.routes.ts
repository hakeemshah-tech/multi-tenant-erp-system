import { Router } from "express";
import * as rolePermissionController from "./rolePermission.controller";
import { validateBody } from "@/common/middlewares/zodMiddleware";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { authenticate } from "@/common/middlewares/authMiddleware";
import { requireVerification } from "@/common/middlewares/requireVerification";
import {
  createOrUpdateRolePermissionSchema,
  bulkUpdateRolePermissionsSchema,
} from "./rolePermission.validation";
import { authorizeRoles } from "@/common/middlewares/authorize-roles.middleware";
import { checkPermission } from "@/common/middlewares/checkPermission";

const router = Router();

// Apply verification requirement to all role permission routes
router.use(authenticate, requireVerification);

/**
 * @swagger
 * tags:
 *   name: Role Permissions
 *   description: Role permission management endpoints
 */

/**
 * @swagger
 * /role-permissions:
 *   post:
 *     summary: Create or update a role permission
 *     tags: [Role Permissions]
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
 *               - sectionKey
 *               - permissions
 *             properties:
 *               roleId:
 *                 type: string
 *                 example: "hr_manager"
 *               sectionKey:
 *                 type: string
 *                 example: "personal-details"
 *               permissions:
 *                 type: object
 *                 properties:
 *                   read:
 *                     type: boolean
 *                   write:
 *                     type: boolean
 *                   delete:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Role permission saved successfully
 */
router.post(
  "/",
  checkPermission({ section: "rbac", action: "write" }),
  validateBody(createOrUpdateRolePermissionSchema),
  asyncHandler(rolePermissionController.createOrUpdateRolePermission)
);

/**
 * @swagger
 * /role-permissions/bulk:
 *   put:
 *     summary: Bulk update permissions for a role
 *     tags: [Role Permissions]
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
 *               - permissions
 *             properties:
 *               roleId:
 *                 type: string
 *               permissions:
 *                 type: object
 *                 additionalProperties:
 *                   type: object
 *                   properties:
 *                     read:
 *                       type: boolean
 *                     write:
 *                       type: boolean
 *                     delete:
 *                       type: boolean
 *     responses:
 *       200:
 *         description: Role permissions updated successfully
 */
router.put(
  "/bulk",
  checkPermission({ section: "rbac", action: "write" }),
  validateBody(bulkUpdateRolePermissionsSchema),
  asyncHandler(rolePermissionController.bulkUpdateRolePermissions)
);

/**
 * @swagger
 * /role-permissions:
 *   get:
 *     summary: Get all permissions for all roles
 *     tags: [Role Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All role permissions fetched successfully
 */
router.get(
  "/",
  checkPermission({ section: "rbac", action: "read" }),
  asyncHandler(rolePermissionController.getAllRolePermissions)
);

/**
 * @swagger
 * /role-permissions/role/{roleId}:
 *   get:
 *     summary: Get all permissions for a specific role
 *     tags: [Role Permissions]
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
 *         description: Role permissions fetched successfully
 */
router.get(
  "/role/:roleId",
  checkPermission({ section: "rbac", action: "read" }),
  asyncHandler(rolePermissionController.getRolePermissions)
);

/**
 * @swagger
 * /role-permissions/role/{roleId}/section/{sectionKey}:
 *   delete:
 *     summary: Delete a role permission
 *     tags: [Role Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: sectionKey
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role permission deleted successfully
 */
router.delete(
  "/role/:roleId/section/:sectionKey",
  checkPermission({ section: "rbac", action: "delete" }),
  asyncHandler(rolePermissionController.deleteRolePermission)
);

export default router;
