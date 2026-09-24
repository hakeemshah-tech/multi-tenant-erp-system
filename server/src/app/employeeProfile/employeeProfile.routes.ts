// src/modules/employee/employeeProfile.routes.ts

import { Router } from "express";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { authenticate } from "@/common/middlewares/authMiddleware";
import { requireVerification } from "@/common/middlewares/requireVerification";
import * as profileController from "./employeeProfile.controller";
import { validateBody } from "@/common/middlewares/zodMiddleware";
import {
  createEmployeeSchema,
  employeeProfileSchema,
  updateEmployeeProfileSchema,
} from "./employeeProfile.validation";
import { applyPropagation, previewPropagation } from "./propagation.controller";

const router = Router();

// Apply verification requirement to onboarding routes (register and self)
// Note: Other routes like getSelfProfile might need to be accessible for unverified users
// to check their verification status, so we apply verification selectively

/**
 * @swagger
 * tags:
 *   name: EmployeeProfile
 *   description: Employee profile management endpoints
 */

/**
 * @swagger
 * /employee-profiles:
 *   post:
 *     summary: Create a new employee profile
 *     tags: [EmployeeProfile]
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
 *         description: Employee registered successfully
 */
router.post(
  "/register",
  authenticate,
  requireVerification,
  // validateBody(createEmployeeSchema),
  asyncHandler(profileController.createEmployeeProfile)
);

/**
 * @swagger
 * /employee-profiles/user/{userId}:
 *   get:
 *     summary: Get employee profile by user ID
 *     tags: [EmployeeProfile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Employee profile fetched successfully
 */
router.get(
  "/user/:userId",
  authenticate,
  asyncHandler(profileController.getProfileByUser)
);

/**
 * @swagger
 * /employee-profiles/{id}:
 *   get:
 *     summary: Get employee profile by profile ID
 *     tags: [EmployeeProfile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Profile ID
 *     responses:
 *       200:
 *         description: Employee profile fetched successfully
 */
/**
 * @swagger
 * /employee-profiles/self:
 *   post:
 *     summary: Register self employee profile (for newbie users)
 *     tags: [EmployeeProfile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmployeeProfileInput'
 *     responses:
 *       201:
 *         description: Profile created successfully
 */
router.post(
  "/self",
  authenticate,
  // validateBody(employeeProfileSchema),
  asyncHandler(profileController.registerSelfProfile)
);

/**
 * @swagger
 * /employee-profiles/self/get:
 *   get:
 *     summary: Get logged-in user's employee profile
 *     tags: [EmployeeProfile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile fetched successfully
 */
router.get(
  "/self/get",
  authenticate,
  asyncHandler(profileController.getSelfProfile)
);

/**
 * @swagger
 * /employee-profiles/my-organizations/get:
 *   get:
 *     summary: Get logged-in user's organizations
 *     tags: [EmployeeProfile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Organizations fetched successfully
 */
// IMPORTANT: This route MUST be defined before /:id to prevent route conflicts
// Express matches routes in order, so specific routes must come before parameterized routes
router.get(
  "/my-organizations/get",
  authenticate,
  asyncHandler(profileController.getMyOrganizations)
);

router.get(
  "/:id",
  authenticate,
  asyncHandler(profileController.getProfileById)
);

/**
 * @swagger
 * /employee-profiles/{id}:
 *   put:
 *     summary: Update an employee profile
 *     tags: [EmployeeProfile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Profile ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmployeeProfileInput'
 *     responses:
 *       200:
 *         description: Employee profile updated successfully
 */
router.put(
  "/:id",
  authenticate,
  // validateBody(updateEmployeeProfileSchema),
  asyncHandler(profileController.updateProfile)
);

/**
 * @swagger
 * /employee-profiles/{id}:
 *   delete:
 *     summary: Delete an employee profile
 *     tags: [EmployeeProfile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Profile ID
 *     responses:
 *       200:
 *         description: Employee profile deleted successfully
 */
router.delete(
  "/:id",
  authenticate,
  asyncHandler(profileController.deleteProfile)
);

/**
 * @swagger
 * /employee-profiles/self:
 *   post:
 *     summary: Register self employee profile (for newbie users)
 *     tags: [EmployeeProfile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmployeeProfileInput'
 *     responses:
 *       201:
 *         description: Profile created successfully
 */
router.post(
  "/self",
  authenticate,
  requireVerification,
  // validateBody(employeeProfileSchema),
  asyncHandler(profileController.registerSelfProfile)
);

/**
 * @swagger
 * /employee-profiles/self/get:
 *   get:
 *     summary: Get logged-in user's employee profile
 *     tags: [EmployeeProfile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile fetched successfully
 */
router.get(
  "/self/get",
  authenticate,
  asyncHandler(profileController.getSelfProfile)
);

router.get(
  "/my-organizations/get",
  authenticate,
  asyncHandler(profileController.getMyOrganizations)
);

/**
 * @swagger
 * /employee-profiles/self:
 *   put:
 *     summary: Update self employee profile
 *     tags: [EmployeeProfile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmployeeProfileInput'
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put(
  "/self/update",
  authenticate,
  // Optional: Add validation if needed
  // validateBody(updateEmployeeProfileSchema),
  asyncHandler(profileController.updateSelfAutoSaveProfile)
);

// update

// router.put(
//   "/self/update",
//   authenticate,
//   // Optional: Add validation if needed
//   // validateBody(updateEmployeeProfileSchema),
//   asyncHandler(profileController.updateSelfProfile)
// );

router.post("/self/preview-propagation", authenticate, previewPropagation);
router.post("/self/apply-propagation", authenticate, applyPropagation);

export default router;
