import { Router } from "express";
import * as authController from "./auth.controller";
import * as adminLoginController from "./adminLogin.controller";
import { validateBody } from "@/common/middlewares/zodMiddleware";
import {
  registerTenantSchema,
  loginSchema,
  registerUserSchema,
  updateModeSchema,
  verifyOTPSchema,
  resendOTPSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  switchOrganizationContextSchema,
} from "./auth.validation";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { authenticate } from "@/common/middlewares/authMiddleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication & onboarding
 */

/**
 * @swagger
 * /auth/register-user:
 *   post:
 *     summary: Register a new standalone user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterUserInput'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             example:
 *               message: "User registered successfully"
 *               data:
 *                 id: "665f4e08a78a5b001f0c567d"
 *                 fullName: "Jane Doe"
 *                 email: "jane@example.com"
 *                 phone: "+1234567890"
 */
router.post(
  "/register-user",
  validateBody(registerUserSchema),
  asyncHandler(authController.registerUser)
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             example:
 *               accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               user:
 *                 id: "665f4e08a78a5b001f0c567d"
 *                 fullName: "John Doe"
 *                 email: "john@example.com"
 *                 role: "admin"
 */
router.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(authController.login)
);

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Get authenticated user's profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *       401:
 *         description: Unauthorized
 */
router.get("/profile", authenticate, asyncHandler(authController.getProfile));

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout the current authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully logged out
 *         content:
 *           application/json:
 *             example:
 *               message: Logged out successfully
 *       401:
 *         description: Unauthorized - invalid or expired token
 */
router.post("/logout", authenticate, asyncHandler(authController.logout));

router.post(
  "/register-tenant",
  authenticate,
  validateBody(registerTenantSchema),
  asyncHandler(authController.registerTenant)
);

/**
 * @swagger
 * /auth/update-mode:
 *   patch:
 *     summary: Update the current mode of the logged-in user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentMode
 *             properties:
 *               currentMode:
 *                 type: string
 *                 enum: [nexus-profile, organization, newbie]
 *     responses:
 *       200:
 *         description: Current mode updated successfully
 */
router.patch(
  "/update-mode",
  authenticate,
  validateBody(updateModeSchema),
  asyncHandler(authController.updateCurrentMode)
);

/**
 * @swagger
 * /auth/check-email:
 *   get:
 *     summary: Check if an email exists in the system (public endpoint)
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email check result
 *         content:
 *           application/json:
 *             example:
 *               message: "Email check completed"
 *               data:
 *                 exists: true
 *                 email: "user@example.com"
 */
router.get("/check-email", asyncHandler(authController.checkEmailExists));

/**
 * @swagger
 * /auth/admin/login:
 *   post:
 *     summary: Admin login endpoint (platform owner)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Admin login successful
 *       403:
 *         description: Access denied - not a platform admin
 */
router.post("/admin/login", asyncHandler(adminLoginController.adminLogin));

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Verify OTP code for email verification
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *                 pattern: '^\d{6}$'
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid or expired OTP
 */
router.post(
  "/verify-otp",
  validateBody(verifyOTPSchema),
  asyncHandler(authController.verifyOTP)
);

/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     summary: Resend OTP code for email verification
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP code sent successfully
 *       400:
 *         description: User not found or already verified
 */
router.post(
  "/resend-otp",
  validateBody(resendOTPSchema),
  asyncHandler(authController.resendOTP)
);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset OTP sent (if email exists)
 *       400:
 *         description: Invalid email format
 */
router.post(
  "/forgot-password",
  validateBody(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword)
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password with OTP verification
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *                 pattern: '^\d{6}$'
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid OTP or password requirements not met
 */
router.post(
  "/reset-password",
  validateBody(resetPasswordSchema),
  asyncHandler(authController.resetPassword)
);

/**
 * @swagger
 * /auth/switch-organization-context:
 *   post:
 *     summary: Switch employee to organization context for accessing employer panel
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - branchId
 *             properties:
 *               branchId:
 *                 type: string
 *                 description: Branch ID to switch to
 *     responses:
 *       200:
 *         description: Organization context switched successfully
 *       403:
 *         description: Employee not found or no roles assigned
 */
router.post(
  "/switch-organization-context",
  authenticate,
  validateBody(switchOrganizationContextSchema),
  asyncHandler(authController.switchOrganizationContext)
);

export default router;
