import { Request, Response } from "express";
import { Types } from "mongoose";
import { WithUser } from "@/common/middlewares/authMiddleware";
import * as profileService from "./employeeProfile.service";
import { CreateEmployeeInput } from "./employeeProfile.types";
import { EmployeeProfile } from "@/database/models/employeeProfile.model";
import { logRegisterEmployee } from "@/audit/auth-audit";

/**
 * @desc Create a new employee with profile
 * @route POST /employee-profiles
 */
export const createEmployeeProfile = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);

  const data: CreateEmployeeInput = req.body;
  const result = await profileService.createEmployeeProfile({
    tenantId,
    branchId,
    data,
  });

  // 🔐 AUDIT (best-effort)
  try {
    await logRegisterEmployee({
      req,
      userId: String(result.user._id),
      email: result.user.email,
      fullName: result.user.fullName ?? `${data.firstname} ${data.lastname}`,
      tenantId: String(tenantId),
      branchId: String(branchId),
      mode: "employee",
    });
  } catch (err) {
    console.error("[audit] logRegisterEmployee failed:", err);
  }

  return res.status(201).json({
    message: "Employee registered successfully",
    data: result,
  });
};

/**
 * @desc Get employee profile by userId
 * @route GET /employee-profiles/user/:userId
 */
export const getProfileByUser = async (req: Request, res: Response) => {
  const userId = new Types.ObjectId(req.params.userId);
  const profile = await profileService.getEmployeeProfileByUser(userId);

  return res.status(200).json({
    message: "Employee profile fetched successfully",
    data: profile,
  });
};

/**
 * @desc Get employee profile by profile ID
 * @route GET /employee-profiles/:id
 */
export const getProfileById = async (req: Request, res: Response) => {
  const profileId = new Types.ObjectId(req.params.id);
  const profile = await profileService.getEmployeeProfileById(profileId);

  return res.status(200).json({
    message: "Employee profile fetched successfully",
    data: profile,
  });
};

/**
 * @desc Update employee profile by ID
 * @route PUT /employee-profiles/:id
 */
export const updateProfile = async (req: Request, res: Response) => {
  const id = new Types.ObjectId(req.params.id);
  const data = req.body;

  const updated = await profileService.updateEmployeeProfile(id, data);

  return res.status(200).json({
    message: "Employee profile updated successfully",
    data: updated,
  });
};

/**
 * @desc Delete employee profile by ID
 * @route DELETE /employee-profiles/:id
 */
export const deleteProfile = async (req: Request, res: Response) => {
  const id = new Types.ObjectId(req.params.id);
  await profileService.deleteEmployeeProfile(id);

  return res.status(200).json({
    message: "Employee profile deleted successfully",
  });
};

/**
 * @desc Newbie user registers their own employee profile
 * @route POST /employee-profiles/self
 */
export const registerSelfProfile = async (req: WithUser, res: Response) => {
  const userId = req.user.userId;
  // const data: any = req.body;

  const data: any = {
    personaldetails: {
      firstname: req.user.fullName,
      // lastname: req.user.fullName,
      mobile: req.user.phone,
    },
  };

  const profile = await profileService.registerSelfProfile(userId, data);

  return res.status(201).json({
    message: "Profile created successfully",
    data: profile,
  });
};

/**
 * @desc Get current logged-in user's profile
 * @route GET /employee-profiles/self
 */
export const getSelfProfile = async (req: WithUser, res: Response) => {
  const userId = req.user.userId;
  const profile = await profileService.getEmployeeProfileByUser(
    new Types.ObjectId(userId)
  );

  return res.status(200).json({
    message: "Profile fetched successfully",
    data: profile,
  });
};

/**
 * @desc Get current logged-in user's profile
 * @route GET /employee-profiles/my-organizations
 */
export const getMyOrganizations = async (req: WithUser, res: Response) => {
  const userId = req.user.userId;

  const profile = await EmployeeProfile.findOne({ userId });

  if (!profile) {
    return res.status(404).json({ message: "Employee profile not found" });
  }

  const orgs = await profileService.getOrganizationsByProfile(profile._id);
  return res.status(200).json({ data: orgs });
};

/**
 * @desc Update self profile
 * @route PUT /employee-profiles/self
 */
export const updateSelfAutoSaveProfile = async (
  req: WithUser,
  res: Response
) => {
  const userId = req.user.userId;
  const data = req.body;

  const updatedProfile = await profileService.updateSelfProfileAutoSave(
    userId,
    data
  );

  return res.status(200).json({
    message: "Profile updated successfully",
    data: updatedProfile,
  });
};
