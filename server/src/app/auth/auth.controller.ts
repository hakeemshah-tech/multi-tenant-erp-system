import { Request, Response } from "express";
import * as authService from "./auth.service";
import * as employeeFieldConfigService from "../employeeFieldConfig/employeeFieldConfig.service";
import {
  RegisterTenantInput,
  LoginInput,
  RegisterUserInput,
} from "./auth.types";
import { Types } from "mongoose";
import { defaultConfigData } from "@/database/defaults/defaultConfigData";

/**
 * @desc Register a new tenant with the first branch and a tenant-owner user
 * @route POST /auth/register
 */
export const registerTenant = async (req: Request, res: Response) => {
  const data: RegisterTenantInput = req.body;

  const result = await authService.registerTenant(req, data);

  const tenantId = new Types.ObjectId(result.tenant.id);
  const branchId = new Types.ObjectId(result.branch.id);

  await employeeFieldConfigService.createDefaultEmployeeFieldConfig(
    tenantId,
    branchId,
    defaultConfigData
  );

  return res.status(201).json({
    message: "Organisation Registered Successfully",
    data: result,
  });
};

/**
 * @desc Register the User
 * @route POST /auth/register-user
 */
export const registerUser = async (req: Request, res: Response) => {
  const data: RegisterUserInput = req.body;

  const result = await authService.registerUser(data, req);

  return res.status(201).json({
    message: "User registered successfully",
    data: result,
  });
};

/**
 * @desc Login an existing user and return JWTs
 * @route POST /auth/login
 */
export const login = async (req: Request, res: Response) => {
  const data: LoginInput = req.body;

  const result = await authService.login(data, req);

  // await employeeFieldConfigService.createDefaultEmployeeFieldConfig(
  //   result.user.tenantId,
  //   result.user.branchId,
  //   defaultConfigData
  // );

  return res.status(200).json({
    message: "Login successful",
    data: result,
  });
};

/**
 * @desc Get current authenticated user's profile
 * @route GET /auth/profile
 */
export const getProfile = async (req: Request, res: Response) => {
  const user = req.user;

  return res.status(200).json({ message: "Fetched Profile Data", data: user });
};

/**
 * @desc Logout the current user and revoke their refresh token
 * @route POST /auth/logout
 */
export const logout = async (req: Request, res: Response) => {
  // Safely access cookies - handle case where cookies might be undefined
  const token = req.cookies?.refreshToken;

  if (token) {
    try {
      await authService.logout(token, req, {
        userId: req.user?.userId,
        email: req.user?.email,
      });
    } catch (err) {
      console.warn("Failed to revoke token in Redis:", err);
    }
  }

  // Clear the tokens from cookies
  res.clearCookie("accessToken", { path: "/" });
  res.clearCookie("refreshToken", { path: "/" });

  return res.status(200).json({ message: "Logged out successfully" });
};

/**
 * @desc Switch employee to organization context for accessing employer panel
 * @route POST /auth/switch-organization-context
 */
export const switchOrganizationContext = async (
  req: Request,
  res: Response
) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { branchId } = req.body;
  if (!branchId) {
    return res.status(400).json({ message: "Branch ID is required" });
  }

  const result = await authService.switchOrganizationContext(
    userId,
    branchId,
    req
  );

  return res.status(200).json({
    message: "Organization context switched successfully",
    data: result,
  });
};

export const updateCurrentMode = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { currentMode } = req.body;

  if (!["nexus-profile", "organization", "newbie"].includes(currentMode)) {
    return res.status(400).json({ message: "Invalid mode" });
  }

  const updatedUser = await authService.updateUserMode(
    userId,
    currentMode,
    req
  );

  return res.status(200).json({
    message: "Current mode updated successfully",
    data: updatedUser,
  });
};

/**
 * @desc Check if an email exists in the system (public endpoint)
 * @route GET /auth/check-email
 */
export const checkEmailExists = async (req: Request, res: Response) => {
  const { email } = req.query;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ message: "Email is required" });
  }

  const exists = await authService.checkEmailExists(email.toLowerCase());

  return res.status(200).json({
    message: "Email check completed",
    data: { exists, email: email.toLowerCase() },
  });
};

/**
 * @desc Verify OTP code for email verification
 * @route POST /auth/verify-otp
 */
export const verifyOTP = async (req: Request, res: Response) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({
      message: "Email and OTP code are required",
    });
  }

  const result = await authService.verifyOTP(email, code);

  if (!result.valid) {
    return res.status(400).json({
      message: result.message,
    });
  }

  return res.status(200).json({
    message: result.message,
    data: { verified: true },
  });
};

/**
 * @desc Resend OTP code for email verification
 * @route POST /auth/resend-otp
 */
export const resendOTP = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      message: "Email is required",
    });
  }

  const result = await authService.resendOTP(email);

  if (!result.success) {
    return res.status(400).json({
      message: result.message,
    });
  }

  return res.status(200).json({
    message: result.message,
    data: { sent: true },
  });
};

/**
 * @desc Request password reset OTP
 * @route POST /auth/forgot-password
 */
export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      message: "Email is required",
    });
  }

  const result = await authService.forgotPassword(email);

  // Always return 200 to prevent email enumeration
  return res.status(200).json({
    message: result.message,
    data: { sent: true },
  });
};

/**
 * @desc Reset password with OTP verification
 * @route POST /auth/reset-password
 */
export const resetPassword = async (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({
      message: "Email, OTP code, and new password are required",
    });
  }

  const result = await authService.resetPassword(email, code, newPassword);

  if (!result.success) {
    return res.status(400).json({
      message: result.message,
    });
  }

  return res.status(200).json({
    message: result.message,
    data: { reset: true },
  });
};
