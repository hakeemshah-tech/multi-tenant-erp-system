import { Router } from "express";
import * as departmentController from "./department.controller";
import { validateBody } from "@/common/middlewares/zodMiddleware";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { authenticate } from "@/common/middlewares/authMiddleware";
import { requireVerification } from "@/common/middlewares/requireVerification";
import {
  createDepartmentSchema,
  updateDepartmentSchema,
} from "./department.validation";
import { authorizeRoles } from "@/common/middlewares/authorize-roles.middleware";
import { checkPermission } from "@/common/middlewares/checkPermission";

const router = Router();

// Apply verification requirement to all department routes
router.use(authenticate, requireVerification);

/**
 * @swagger
 * tags:
 *   name: Departments
 *   description: Department management endpoints
 */

/**
 * @swagger
 * /departments:
 *   post:
 *     summary: Create a new department
 *     tags: [Departments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateDepartmentInput'
 *     responses:
 *       201:
 *         description: Department created successfully
 *         content:
 *           application/json:
 *             example:
 *               message: Department created successfully
 *               data:
 *                 _id: "665ff9282cbd33a155ee9f03"
 *                 name: "Engineering"
 *                 description: "Handles product development"
 *                 designationIds: ["665ff9282cbd33a155ee9f02"]
 */

// Create department - requires "write" permission
router.post(
  "/",
  checkPermission({ section: "departments", action: "write" }),
  validateBody(createDepartmentSchema),
  asyncHandler(departmentController.createDepartment)
);

/**
 * @swagger
 * /departments:
 *   get:
 *     summary: Get all departments for the tenant
 *     tags: [Departments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Fetched departments successfully
 */
// Get all departments - requires "read" permission
router.get(
  "/",
  checkPermission({ section: "departments", action: "read" }),
  asyncHandler(departmentController.getDepartments)
);

/**
 * @swagger
 * /departments/{id}:
 *   get:
 *     summary: Get department by ID
 *     tags: [Departments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Department ID
 *     responses:
 *       200:
 *         description: Fetched department successfully
 */
// Get department by ID - requires "read" permission
router.get(
  "/:id",
  checkPermission({ section: "departments", action: "read" }),
  asyncHandler(departmentController.getDepartmentById)
);

/**
 * @swagger
 * /departments/{id}:
 *   put:
 *     summary: Update department by ID
 *     tags: [Departments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Department ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateDepartmentInput'
 *     responses:
 *       200:
 *         description: Department updated successfully
 */
// Update department - requires "write" permission
router.put(
  "/:id",
  checkPermission({ section: "departments", action: "write" }),
  validateBody(updateDepartmentSchema),
  asyncHandler(departmentController.updateDepartment)
);

/**
 * @swagger
 * /departments/{id}/toggle-status:
 *   patch:
 *     summary: Toggle department active/inactive status
 *     tags: [Departments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Department ID
 *     responses:
 *       200:
 *         description: Department status toggled successfully
 */
// Toggle department status (activate/deactivate) - requires "delete" permission
router.patch(
  "/:id/toggle-status",
  checkPermission({ section: "departments", action: "delete" }),
  asyncHandler(departmentController.toggleDepartmentStatus)
);

export default router;
