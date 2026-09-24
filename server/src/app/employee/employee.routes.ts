import { Router } from "express";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { authenticate } from "@/common/middlewares/authMiddleware";
import { requireVerification } from "@/common/middlewares/requireVerification";
import * as employeeController from "./employee.controller";
import { validateBody } from "@/common/middlewares/zodMiddleware";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
} from "./employee.validation";
import { applyPropagation, previewPropagation } from "./propagation.controller";
import { authorizeRoles } from "@/common/middlewares/authorize-roles.middleware";

const router = Router();

// Apply verification requirement to all employee routes
router.use(authenticate, requireVerification);

/**
 * @swagger
 * tags:
 *   name: Employee
 *   description: Employee management endpoints
 */

/**
 * @swagger
 * /employees:
 *   post:
 *     summary: Create a new employee
 *     tags: [Employee]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateEmployeeInput'
 *     responses:
 *       201:
 *         description: Employee created successfully
 */
router.post(
  "/",
  authorizeRoles("tenant-owner"),
  // validateBody(createEmployeeSchema),
  asyncHandler(employeeController.createEmployee)
);

/**
 * @swagger
 * /employees:
 *   get:
 *     summary: Get all employees for the current branch (excluding deleted)
 *     tags: [Employee]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Employees fetched successfully
 */
router.get("/", asyncHandler(employeeController.getEmployees));

/**
 * @swagger
 * /employees/{id}:
 *   get:
 *     summary: Get a single employee by ID
 *     tags: [Employee]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee ID
 *     responses:
 *       200:
 *         description: Employee fetched successfully
 */
/**
 * @swagger
 * /employees/{id}/section-permissions:
 *   get:
 *     summary: Get section-level permissions for viewing an employee's details
 *     tags: [Employee]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee ID
 *     responses:
 *       200:
 *         description: Section permissions fetched successfully
 */
router.get(
  "/:id/section-permissions",
  asyncHandler(employeeController.getEmployeeSectionPermissions)
);

router.get("/:id", asyncHandler(employeeController.getEmployeeById));

/**
 * @swagger
 * /employees/{id}:
 *   put:
 *     summary: Update an employee by ID
 *     tags: [Employee]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateEmployeeInput'
 *     responses:
 *       200:
 *         description: Employee updated successfully
 */
router.put(
  "/:id",
  authorizeRoles("tenant-owner"),
  // validateBody(updateEmployeeSchema),
  asyncHandler(employeeController.updateEmployee)
);

/**
 * @swagger
 * /employees/{id}:
 *   delete:
 *     summary: Soft delete an employee
 *     tags: [Employee]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee ID
 *     responses:
 *       200:
 *         description: Employee soft deleted successfully
 */
router.delete("/:id", asyncHandler(employeeController.deleteEmployee));

/**
 * @swagger
 * /employees/{id}/employeer-only-fields:
 *   put:
 *     summary: Upsert employer-only additional fields for a section
 *     tags: [Employee]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sectionKey, items]
 *             properties:
 *               sectionKey:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [sectionKey, fieldKey, value]
 *                   properties:
 *                     sectionKey:
 *                       type: string
 *                     innerSectionKey:
 *                       type: string
 *                     fieldKey:
 *                       type: string
 *                     value:
 *                       nullable: true
 *     responses:
 *       200:
 *         description: Employer-only fields saved
 */
router.put(
  "/:id/employeer-only-fields",
  asyncHandler(employeeController.upsertEmployeerOnlyFields)
);

/**
 * @swagger
 * /employees/me/employee-fields:
 *   put:
 *     summary: Update employeeFields for the logged-in user
 *     tags: [Employee]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateEmployeeFieldsInput'
 *     responses:
 *       200:
 *         description: Employee fields updated successfully
 */
router.put(
  "/me/employee-fields/:branchId",
  asyncHandler(employeeController.updateMyEmployeeFields)
);

// This for getting organization side >> employee profile by employee id >> only admin
router.put(
  "/:id/employee-fields",
  asyncHandler(employeeController.upsertEmployeeFields)
);

/**
 * @swagger
 * /employees/me/org-fields/{id}:
 *   get:
 *     summary: Get my organization (branch) by id, validating membership via assignments
 *     tags: [Organization]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID (organization id)
 *     responses:
 *       200:
 *         description: Organization fetched successfully
 *       403:
 *         description: User is not assigned to this branch
 */
router.get(
  "/me/org-fields/:id/",
  asyncHandler(employeeController.getMyOrganizationById)
);

// this  update my organization (branch) by id: validates membership via assignments
router.put(
  "/me/org-fields/:id/",
  asyncHandler(employeeController.updateFieldsMyOrganizationById)
);

router.post("/me/preview-propagation", previewPropagation);
router.post("/me/apply-propagation", applyPropagation);

export default router;
