import { Router } from "express";
import * as designationController from "./designation.controller";
import { validateBody } from "@/common/middlewares/zodMiddleware";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { authenticate } from "@/common/middlewares/authMiddleware";
import { requireVerification } from "@/common/middlewares/requireVerification";
import {
  createDesignationSchema,
  updateDesignationSchema,
} from "./designation.validation";
import { paginationMiddleware } from "@/common/middlewares/paginationMiddleware";
import { authorizeRoles } from "@/common/middlewares/authorize-roles.middleware";
import { checkPermission } from "@/common/middlewares/checkPermission";

const router = Router();

// Apply verification requirement to all designation routes
router.use(authenticate, requireVerification);

/**
 * @swagger
 * tags:
 *   name: Designations
 *   description: Designation management endpoints
 */

/**
 * @swagger
 * /designations:
 *   post:
 *     summary: Create a new designation
 *     tags: [Designations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateDesignationInput'
 *     responses:
 *       201:
 *         description: Designation created successfully
 *         content:
 *           application/json:
 *             example:
 *               message: Designation created successfully
 *               data:
 *                 _id: "665ffa8e2cbd33a155ee9f11"
 *                 name: "Senior Developer"
 *                 departmentIds: ["665ff9282cbd33a155ee9f03"]
 */
// Create designation - requires "write" permission
router.post(
  "/",
  checkPermission({ section: "job-titles", action: "write" }),
  validateBody(createDesignationSchema),
  asyncHandler(designationController.createDesignation)
);

/**
 * @swagger
 * /designations:
 *   get:
 *     summary: Get all designations for the tenant and branch
 *     tags: [Designations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for designation name
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *         description: Filter designations by department ID
 *     responses:
 *       200:
 *         description: Fetched designations successfully
 *         content:
 *           application/json:
 *             example:
 *               message: Fetched designations successfully
 *               data:
 *                 - _id: "665ff9282cbd33a155ee9f03"
 *                   name: "Senior Developer"
 *                   departmentIds:
 *                     - _id: "665ff9282cbd33a155ee9f01"
 *                       name: "Engineering"
 *                       description: "Handles development"
 */
// Get all designations - requires "read" permission
router.get(
  "/",
  checkPermission({ section: "job-titles", action: "read" }),
  paginationMiddleware,
  asyncHandler(designationController.getDesignations)
);

/**
 * @swagger
 * /designations/{id}:
 *   get:
 *     summary: Get designation by ID
 *     tags: [Designations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Designation ID
 *     responses:
 *       200:
 *         description: Fetched designation successfully
 */
// Get designation by ID - requires "read" permission
router.get(
  "/:id",
  checkPermission({ section: "job-titles", action: "read" }),
  asyncHandler(designationController.getDesignationById)
);

/**
 * @swagger
 * /designations/{id}:
 *   put:
 *     summary: Update designation by ID
 *     tags: [Designations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Designation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateDesignationInput'
 *     responses:
 *       200:
 *         description: Designation updated successfully
 */
// Update designation - requires "write" permission
router.put(
  "/:id",
  checkPermission({ section: "job-titles", action: "write" }),
  validateBody(updateDesignationSchema),
  asyncHandler(designationController.updateDesignation)
);

/**
 * @swagger
 * /designations/{id}:
 *   delete:
 *     summary: Delete designation by ID (soft delete)
 *     tags: [Designations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Designation ID
 *     responses:
 *       200:
 *         description: Designation deleted successfully
 */
router.delete(
  "/:id",
  authorizeRoles("tenant-owner"),
  asyncHandler(designationController.deleteDesignation)
);

/**
 * @swagger
 * /designations/{id}/toggle-status:
 *   patch:
 *     summary: Toggle designation active/inactive status
 *     tags: [Designations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Designation ID
 *     responses:
 *       200:
 *         description: Designation status toggled successfully
 */
// Toggle designation status - requires "delete" permission
router.patch(
  "/:id/toggle-status",
  checkPermission({ section: "job-titles", action: "delete" }),
  asyncHandler(designationController.toggleDesignationStatus)
);

export default router;
