// import bcrypt from "bcryptjs";
// import { IUser, User } from "@/database/models/user.model";
// import { Tenant } from "@/database/models/tenant.model";
// import { Branch } from "@/database/models/branch.model";
// import { AppError } from "@/common/utils/app-error";
// import {
//   AuthResponse,
//   AuthTokenPayload,
//   LoginInput,
//   RegisterTenantInput,
//   RegisterUserInput,
// } from "./auth.types";
// import { generateTokens } from "./token.service";
// import { revokeRefreshToken } from "./token.service";

// export const registerTenant = async (
//   req: Request,
//   data: RegisterTenantInput
// ) => {
//   const userId = req.user?.userId;
//   if (!userId) throw new AppError("Unauthorized", 401);

//   const { companyName, companyLocation, employeeCount, businessCategory } =
//     data;

//   const existingUser = await User.findById(userId);
//   if (!existingUser || existingUser.isDeleted) {
//     throw new AppError("User not found", 404);
//   }

//   const alreadyTenantOwner = existingUser.assignments?.some(
//     (a) => a.role === "tenant-owner"
//   );
//   if (alreadyTenantOwner) {
//     throw new AppError("User already owns a Tenant", 409);
//   }

//   const tenant = await Tenant.create({
//     name: companyName,
//     email: existingUser.email,
//     stripeCustomerId: "mock-stripe-customer-id", // Replace with real integration
//     trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
//   });

//   const branch = await Branch.create({
//     tenantId: tenant._id,
//     name: companyName,
//     location: companyLocation,
//     employeeCount,
//     businessCategory,
//   });

//   const newAssignment = {
//     tenantId: tenant._id,
//     branchId: branch._id,
//     role: "tenant-owner" as const,
//   };

//   existingUser.assignments.push(newAssignment);
//   existingUser.activeAssignment = newAssignment;
//   existingUser.currentMode = "organization";

//   await existingUser.save();

//   return {
//     tenant: {
//       id: tenant._id,
//       name: tenant.name,
//       email: tenant.email,
//       trialEndsAt: tenant.trialEndsAt,
//     },
//     branch: {
//       id: branch._id,
//       name: branch.name,
//       location: branch.location,
//     },
//     user: {
//       id: existingUser._id,
//       fullName: existingUser.fullName,
//       email: existingUser.email,
//       role: "tenant-owner",
//     },
//   };
// };

// export const login = async (data: LoginInput): Promise<AuthResponse> => {
//   const { email, password } = data;

//   const user = await User.findOne({ email, isDeleted: false }).lean<IUser>();
//   if (!user) throw new AppError("Invalid credentials", 400);

//   const isMatch = await bcrypt.compare(password, user.passwordHash);
//   if (!isMatch) throw new AppError("Invalid credentials", 400);

//   let payload: AuthTokenPayload;
//   let accessToken: string;
//   let refreshToken: string;

//   const hasAssignment = user.assignments && user.assignments.length > 0;

//   if (hasAssignment) {
//     const [defaultAssignment] = user.assignments;

//     payload = {
//       userId: user._id.toString(),
//       tenantId: defaultAssignment.tenantId.toString(),
//       branchId: defaultAssignment.branchId.toString(),
//       role: defaultAssignment.role,
//     };
//   } else {
//     // minimal payload for "newbie" users
//     payload = {
//       userId: user._id.toString(),
//       role: "newbie",
//     } as AuthTokenPayload;
//   }

//   const tokens = await generateTokens(payload);
//   accessToken = tokens.accessToken;
//   refreshToken = tokens.refreshToken;

//   return {
//     accessToken,
//     refreshToken,
//     user: {
//       id: user._id.toString(),
//       fullName: user.fullName,
//       email: user.email,
//       phone: user.phone || null,
//       role: payload.role,
//       currentMode: user.currentMode || "newbie",
//       activeAssignment: user.activeAssignment ?? null,
//       tenantId: (payload as any).tenantId ?? null,
//       branchId: (payload as any).branchId ?? null,
//     },
//   };
// };

// export const registerUser = async (data: RegisterUserInput) => {
//   const { fullName, email, phone, password } = data;

//   const existing = await User.findOne({ email });
//   if (existing) throw new AppError("User already exists", 409);

//   const passwordHash = await bcrypt.hash(password, 10);

//   const user = await User.create({
//     fullName,
//     email,
//     phone,
//     passwordHash,
//     assignments: [],
//     activeAssignment: undefined,
//   });

//   return {
//     id: user._id,
//     fullName: user.fullName,
//     email: user.email,
//     phone: user.phone,
//   };
// };

// export const updateUserMode = async (userId: string, mode: string) => {
//   const user = await User.findByIdAndUpdate(
//     userId,
//     { currentMode: mode },
//     { new: true }
//   );

//   return user;
// };

// export const logout = async (refreshToken: string) => {
//   await revokeRefreshToken(refreshToken); // deletes from Redis
// };

import bcrypt from "bcryptjs";
import type { Request } from "express";

import {
  logLoginFailure,
  logLoginSuccess,
  logLogout,
  logRegisterTenant,
  logRegisterUser,
  logUpdateUserMode,
} from "@/audit/auth-audit";
import { AppError } from "@/common/utils/app-error";
import { IUser, IAssignment, User } from "@/database/models/user.model";
import { Tenant } from "@/database/models/tenant.model";
import { Branch } from "@/database/models/branch.model";
import { Department } from "@/database/models/department.model";
import { Designation } from "@/database/models/designation.model";
import {
  AuthResponse,
  AuthTokenPayload,
  LoginInput,
  RegisterTenantInput,
  RegisterUserInput,
} from "./auth.types";
import { generateTokens, revokeRefreshToken } from "./token.service";

/* --------------------------------------------------------
   registerTenant
   -------------------------------------------------------- */
export const registerTenant = async (
  req: Request,
  data: RegisterTenantInput
) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError("Unauthorized", 401);

  const { companyName, companyLocation, employeeCount, businessCategory } =
    data;

  const existingUser = await User.findById(userId);
  if (!existingUser || existingUser.isDeleted) {
    throw new AppError("User not found", 404);
  }

  const alreadyTenantOwner = existingUser.assignments?.some(
    (a) => a.role === "tenant-owner"
  );
  if (alreadyTenantOwner) {
    throw new AppError("User already owns a Tenant", 409);
  }

  const tenant = await Tenant.create({
    name: companyName,
    email: existingUser.email,
    stripeCustomerId: "mock-stripe-customer-id", // Replace with real integration
    trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  const branch = await Branch.create({
    tenantId: tenant._id,
    name: companyName,
    location: companyLocation,
    employeeCount,
    businessCategory,
  });

  const newAssignment: IAssignment = {
    tenantId: tenant._id as any,
    branchId: branch._id as any,
    role: "tenant-owner",
  };

  existingUser.assignments.push(newAssignment);
  existingUser.activeAssignment = newAssignment;
  existingUser.currentMode = "organization";
  // Note: isPlatformAdmin should only be set for actual platform owners, not tenant owners
  // Tenant owners have the "tenant-owner" role in their assignments, which is sufficient

  await existingUser.save();

  // 🏢 Create default departments and designations
  try {
    // Default departments
    const defaultDepartments = [
      { name: "Administration" },
      { name: "Disability Care" },
      { name: "Executive Management" },
      { name: "Accounts" },
      { name: "HR" },
      { name: "Marketing" },
    ];

    const departments = await Department.insertMany(
      defaultDepartments.map((dept) => ({
        tenantId: tenant._id,
        branchId: branch._id,
        name: dept.name,
        isDeleted: false,
      }))
    );

    // Map department names to IDs for designations
    const deptMap = new Map<string, string>();
    departments.forEach((dept) => {
      deptMap.set(dept.name, dept._id.toString());
    });

    // Default designations with department mappings
    const defaultDesignations = [
      {
        name: "Administrative Officer",
        departmentIds: [deptMap.get("Administration")],
      },
      { name: "Receptionist", departmentIds: [deptMap.get("Administration")] },
      {
        name: "Support Worker",
        departmentIds: [deptMap.get("Disability Care")],
      },
      { name: "CEO", departmentIds: [deptMap.get("Executive Management")] },
      { name: "Accounts Officer", departmentIds: [deptMap.get("Accounts")] },
      { name: "Accounts Manager", departmentIds: [deptMap.get("Accounts")] },
      { name: "HR Officer", departmentIds: [deptMap.get("HR")] },
      { name: "HR Manager", departmentIds: [deptMap.get("HR")] },
      { name: "Sales Manager", departmentIds: [deptMap.get("Marketing")] },
      { name: "Marketing Manager", departmentIds: [deptMap.get("Marketing")] },
      {
        name: "General Manager",
        departmentIds: [deptMap.get("Executive Management")],
      },
    ];

    await Designation.insertMany(
      defaultDesignations.map((des) => ({
        tenantId: tenant._id,
        branchId: branch._id,
        name: des.name,
        departmentIds: des.departmentIds,
        isDeleted: false,
      }))
    );

    console.log(
      `✅ Created ${departments.length} default departments and ${defaultDesignations.length} default designations for tenant ${tenant._id}`
    );
  } catch (error) {
    console.error(
      "❌ Failed to create default departments and designations:",
      error
    );
    // Don't fail the registration if defaults fail to create
  }

  // 🎯 Create default role levels
  try {
    const { createDefaultRoleLevels } =
      await import("@/app/roleLevels/roleLevel.service");
    await createDefaultRoleLevels(tenant._id, branch._id);
    console.log(`✅ Created default role levels for tenant ${tenant._id}`);
  } catch (error) {
    console.error("❌ Failed to create default role levels:", error);
    // Don't fail the registration if defaults fail to create
  }

  // 🔐 AUDIT: tenant + branch + assignment creation
  await logRegisterTenant({
    req,
    tenantId: String(tenant._id),
    ownerUserId: String(existingUser._id),
    ownerEmail: existingUser.email,
    ownerName: existingUser.fullName ?? null,
    companyName,
  });

  return {
    tenant: {
      id: tenant._id,
      name: tenant.name,
      email: tenant.email,
      trialEndsAt: tenant.trialEndsAt,
    },
    branch: {
      id: branch._id,
      name: branch.name,
      location: branch.location,
    },
    user: {
      id: existingUser._id,
      fullName: existingUser.fullName,
      email: existingUser.email,
      role: "tenant-owner",
    },
  };
};

/* --------------------------------------------------------
   login
   -------------------------------------------------------- */
export const login = async (
  data: LoginInput,
  req?: Request
): Promise<AuthResponse> => {
  const { email, password } = data;

  const user = await User.findOne({ email, isDeleted: false }).lean<IUser>();
  if (!user) {
    // 🔐 AUDIT: failure (unknown user)
    await logLoginFailure({ req, email, reason: "User not found or deleted" });
    throw new AppError("Invalid credentials", 400);
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    // 🔐 AUDIT: failure (bad password)
    await logLoginFailure({ req, email, reason: "Bad password" });
    throw new AppError("Invalid credentials", 400);
  }

  let payload: AuthTokenPayload;

  // Check if user is platform admin
  if (user.isPlatformAdmin) {
    payload = {
      userId: user._id.toString(),
      role: "platform-admin",
    } as AuthTokenPayload;
  } else {
    const hasAssignment = user.assignments && user.assignments.length > 0;

    if (hasAssignment) {
      const [defaultAssignment] = user.assignments;

      payload = {
        userId: user._id.toString(),
        tenantId: defaultAssignment.tenantId.toString(),
        branchId: defaultAssignment.branchId.toString(),
        role: defaultAssignment.role,
      };
    } else {
      payload = {
        userId: user._id.toString(),
        role: "newbie",
      } as AuthTokenPayload;
    }
  }

  const tokens = await generateTokens(payload);

  // 🔐 AUDIT: success
  await logLoginSuccess({
    req,
    userId: user._id.toString(),
    actorEmail: user.email,
    actorName: user.fullName ?? null,
    tenantId: (payload as any).tenantId ?? null,
    branchId: (payload as any).branchId ?? null,
  });

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      role: payload.role,
      activeAssignment: user.activeAssignment
        ? {
            tenantId: String(user.activeAssignment.tenantId),
            branchId: String(user.activeAssignment.branchId),
            role: user.activeAssignment.role,
          }
        : {
            tenantId: "",
            branchId: "",
            role: "employee",
          },
    },
  };
};

/* --------------------------------------------------------
   registerUser
   -------------------------------------------------------- */
export const registerUser = async (
  data: RegisterUserInput,
  req?: Request
): Promise<AuthResponse> => {
  const { fullName, email, phone, password } = data;

  // Validate email is present and not empty
  if (!email || typeof email !== "string" || email.trim().length === 0) {
    throw new AppError("Email is required and must be a valid string", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) throw new AppError("User already exists", 409);

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    fullName,
    email: normalizedEmail,
    phone,
    passwordHash,
    assignments: [],
    activeAssignment: undefined,
    isVerified: false, // User needs to verify email via OTP
  });

  // 🔐 AUDIT
  await logRegisterUser({
    req,
    userId: String(user._id),
    email: user.email,
    fullName: user.fullName ?? null,
  });

  // Send OTP for email verification
  const { createAndSendOTP } = await import("@/services/otp.service");
  await createAndSendOTP(normalizedEmail, "email_verification", fullName);

  // Generate tokens for new user (they have no assignments yet, so role is "newbie")
  const payload: AuthTokenPayload = {
    userId: user._id.toString(),
    role: "newbie",
  };

  const tokens = await generateTokens(payload);

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      role: "newbie",
      activeAssignment: {
        tenantId: "",
        branchId: "",
        role: "employee", // Use "employee" as default since "newbie" is not in the union type
      },
    },
  };
};

/* --------------------------------------------------------
   updateUserMode
   -------------------------------------------------------- */
export const updateUserMode = async (
  userId: string,
  mode: string,
  req?: Request
) => {
  // fetch current to log old->new
  const current = await User.findById(userId).lean<IUser>();
  const oldMode = current?.currentMode ?? null;

  // When switching to "organization" mode, ensure activeAssignment is set to tenant-owner assignment
  // This is important for tenant owners who are also employees in other organizations
  let updateData: any = { currentMode: mode };

  if (mode === "organization") {
    // Find the tenant-owner assignment
    const tenantOwnerAssignment = current?.assignments?.find(
      (assignment) => assignment.role === "tenant-owner"
    );

    if (tenantOwnerAssignment) {
      // Set activeAssignment to tenant-owner assignment
      updateData.activeAssignment = tenantOwnerAssignment;
    }
  }
  // Note: When switching to "nexus-profile" mode, we keep the current activeAssignment
  // The user can manually switch organization context if needed via the organizations page

  const user = await User.findByIdAndUpdate(userId, updateData, { new: true });

  // 🔐 AUDIT
  await logUpdateUserMode({
    req,
    userId,
    email: (user as any)?.email ?? current?.email ?? null,
    fullName: (user as any)?.fullName ?? current?.fullName ?? null,
    oldMode,
    newMode: mode,
    tenantId: (user as any)?.activeAssignment?.tenantId?.toString() ?? null,
    branchId: (user as any)?.activeAssignment?.branchId?.toString() ?? null,
  });

  return user;
};

/* --------------------------------------------------------
   logout
   -------------------------------------------------------- */
export const logout = async (
  refreshToken: string,
  req?: Request,
  userCtx?: { userId?: string; email?: string }
) => {
  await revokeRefreshToken(refreshToken); // deletes from Redis

  // 🔐 AUDIT (best-effort: often we only know req + maybe userCtx)
  await logLogout({
    req,
    userId: userCtx?.userId ?? null,
    email: userCtx?.email ?? null,
  });
};

/**
 * Check if an email exists in the system
 * @param email - Email to check
 * @returns true if email exists, false otherwise
 */
export const checkEmailExists = async (email: string): Promise<boolean> => {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({
    email: normalizedEmail,
    isDeleted: { $ne: true },
  });
  return !!user;
};

/* --------------------------------------------------------
   verifyOTP
   -------------------------------------------------------- */
export const verifyOTP = async (
  email: string,
  code: string
): Promise<{ valid: boolean; message: string }> => {
  const { verifyOTP: verifyOTPService, incrementOTPAttempts } =
    await import("@/services/otp.service");
  const { User } = await import("@/database/models/user.model");

  // Verify OTP
  const result = await verifyOTPService(email, code, "email_verification");

  if (!result.valid) {
    // Increment attempts for failed verification
    await incrementOTPAttempts(email, code, "email_verification");
    return result;
  }

  // If OTP is valid, mark user as verified
  await User.updateOne(
    { email: email.toLowerCase() },
    { $set: { isVerified: true } }
  );

  return {
    valid: true,
    message: "Email verified successfully",
  };
};

/* --------------------------------------------------------
   resendOTP
   -------------------------------------------------------- */
export const resendOTP = async (
  email: string
): Promise<{ success: boolean; message: string }> => {
  // Validate email is present and not empty
  if (!email || typeof email !== "string" || email.trim().length === 0) {
    return {
      success: false,
      message: "Email is required and must be a valid string",
    };
  }

  const normalizedEmail = email.trim().toLowerCase();

  const { createAndSendOTP } = await import("@/services/otp.service");
  const { User } = await import("@/database/models/user.model");

  // Check if user exists
  const user = await User.findOne({ email: normalizedEmail, isDeleted: false });
  if (!user) {
    return {
      success: false,
      message: "User not found",
    };
  }

  // Check if already verified
  if (user.isVerified) {
    return {
      success: false,
      message: "Email is already verified",
    };
  }

  // Create and send new OTP
  await createAndSendOTP(normalizedEmail, "email_verification", user.fullName);

  return {
    success: true,
    message: "OTP code has been sent to your email",
  };
};

/* --------------------------------------------------------
   forgotPassword
   -------------------------------------------------------- */
export const forgotPassword = async (
  email: string
): Promise<{ success: boolean; message: string }> => {
  // Validate email is present and not empty
  if (!email || typeof email !== "string" || email.trim().length === 0) {
    // Return generic message for security (don't reveal validation failure)
    return {
      success: true,
      message:
        "If an account exists with this email, a password reset code has been sent.",
    };
  }

  const normalizedEmail = email.trim().toLowerCase();

  const { createAndSendOTP } = await import("@/services/otp.service");
  const { User } = await import("@/database/models/user.model");

  // Check if user exists (but don't reveal if email doesn't exist for security)
  const user = await User.findOne({ email: normalizedEmail, isDeleted: false });

  // Always return success message to prevent email enumeration
  // Only send OTP if user exists
  if (user) {
    await createAndSendOTP(normalizedEmail, "password_reset", user.fullName);
  }

  // Return same message regardless of whether user exists
  return {
    success: true,
    message:
      "If an account exists with this email, a password reset code has been sent.",
  };
};

/* --------------------------------------------------------
   resetPassword
   -------------------------------------------------------- */
/**
 * Switch employee to organization context (for accessing employer panel)
 * Validates membership and returns aggregated roles + permissions
 */
export const switchOrganizationContext = async (
  userId: string,
  branchId: string,
  req?: Request
) => {
  const { getEmployeePermissions } =
    await import("../employee/employeePermission.service");
  const { User } = await import("@/database/models/user.model");
  const { Branch } = await import("@/database/models/branch.model");
  const { AppError } = await import("@/common/utils/app-error");
  const { Types } = await import("mongoose");

  // 1. Verify user exists
  const user = await User.findById(userId).lean();
  if (!user) {
    throw new AppError("User not found", 404);
  }

  // 2. Get branch to get tenantId
  const branch = await Branch.findById(branchId).lean();
  if (!branch) {
    throw new AppError("Branch not found", 404);
  }

  const tenantId = branch.tenantId;
  const branchIdObj = new Types.ObjectId(branchId);
  const tenantIdObj = new Types.ObjectId(tenantId);

  // 3. Verify employee belongs to this organization
  const { EmployeeProfile } =
    await import("@/database/models/employeeProfile.model");
  const employeeProfile = await EmployeeProfile.findOne({
    userId: new Types.ObjectId(userId),
  }).lean();

  if (!employeeProfile) {
    throw new AppError("Employee profile not found", 404);
  }

  const EmployeeModel = (await import("@/database/models/employee.model"))
    .default;
  const employee = await EmployeeModel.findOne({
    employeeProfile: employeeProfile._id,
    tenantId: tenantIdObj,
    branchId: branchIdObj,
    isDeleted: false,
  }).lean();

  if (!employee) {
    throw new AppError("Employee not found in this organization", 403);
  }

  // 4. Get aggregated roles and permissions
  const { aggregatedRoles, permissions } = await getEmployeePermissions(
    new Types.ObjectId(userId),
    tenantIdObj,
    branchIdObj
  );

  // 5. Verify employee has at least one role
  if (aggregatedRoles.roleIds.length === 0) {
    throw new AppError(
      "No roles assigned. Please contact your administrator.",
      403
    );
  }

  // 6. Update user's activeAssignment
  await User.findByIdAndUpdate(userId, {
    activeAssignment: {
      tenantId: tenantIdObj,
      branchId: branchIdObj,
      role: "employee", // Always employee for this flow
    },
  });

  return {
    activeAssignment: {
      tenantId: tenantId.toString(),
      branchId: branchId,
      role: "employee" as const,
    },
    aggregatedRoles,
    permissions,
  };
};

export const resetPassword = async (
  email: string,
  code: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> => {
  const { verifyOTP, incrementOTPAttempts } =
    await import("@/services/otp.service");
  const { User } = await import("@/database/models/user.model");

  // Verify OTP
  const result = await verifyOTP(email, code, "password_reset");

  if (!result.valid) {
    // Increment attempts for failed verification
    await incrementOTPAttempts(email, code, "password_reset");
    return {
      success: false,
      message: result.message,
    };
  }

  // Find user
  const user = await User.findOne({
    email: email.toLowerCase(),
    isDeleted: false,
  });
  if (!user) {
    return {
      success: false,
      message: "User not found",
    };
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, 10);

  // Update password
  await User.updateOne(
    { email: email.toLowerCase() },
    { $set: { passwordHash } }
  );

  // Delete the verified OTP
  const { default: OTPModel } = await import("@/database/models/OTP.model");
  await OTPModel.deleteOne({
    email: email.toLowerCase(),
    code,
    purpose: "password_reset",
  });

  return {
    success: true,
    message:
      "Password has been reset successfully. Please login with your new password.",
  };
};

// import { createStripeCustomer } from '@/services/stripe.service';

// export const registerTenant = async (data: RegisterTenantInput) => {
//   const {
//     fullName,
//     email,
//     password,
//     companyName,
//     companyLocation,
//     employeeCount,
//     businessCategory,
//   } = data;

//   // Check if a tenant already exists with the same email
//   const existingTenant = await Tenant.findOne({ email });
//   if (existingTenant) throw new AppError("Tenant already registered", 409);

//   const passwordHash = await bcrypt.hash(password, 10);

//   // const stripeCustomerId = await createStripeCustomer(email, companyName);

//   const tenant = await Tenant.create({
//     name: companyName,
//     email,
//     stripeCustomerId: "mock-stripe-customer-id", // Replace with real stripeCustomerId
//     trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
//   });

//   const branch = await Branch.create({
//     tenantId: tenant._id,
//     name: companyName,
//     location: companyLocation,
//     employeeCount,
//     businessCategory,
//   });

//   const user = await User.create({
//     fullName,
//     email,
//     passwordHash,
//     assignments: [
//       {
//         tenantId: tenant._id,
//         branchId: branch._id,
//         role: "tenant-owner",
//       },
//     ],
//     activeAssignment: {
//       tenantId: tenant._id,
//       branchId: branch._id,
//       role: "tenant-owner",
//     },
//   });

//   return {
//     tenant: {
//       id: tenant._id,
//       name: tenant.name,
//       email: tenant.email,
//       trialEndsAt: tenant.trialEndsAt,
//     },
//     branch: {
//       id: branch._id,
//       name: branch.name,
//       location: branch.location,
//     },
//     user: {
//       id: user._id,
//       fullName: user.fullName,
//       email: user.email,
//       role: "tenant-owner",
//     },
//   };
// };

// export const login = async (data: LoginInput): Promise<AuthResponse> => {
//   const { email, password } = data;

//   const user = await User.findOne({ email, isDeleted: false }).lean<IUser>();
//   if (!user) throw new AppError("Invalid credentials", 400);

//   const isMatch = await bcrypt.compare(password, user.passwordHash);
//   if (!isMatch) throw new AppError("Invalid credentials", 400);

//   const [defaultAssignment] = user.assignments;
//   if (!defaultAssignment)
//     throw new AppError("No tenant-branch assignment found for user", 400);

//   const payload: AuthTokenPayload = {
//     userId: user._id.toString(),
//     tenantId: defaultAssignment.tenantId.toString(),
//     branchId: defaultAssignment.branchId.toString(),
//     role: defaultAssignment.role,
//   };

//   const { accessToken, refreshToken } = await generateTokens(payload);

//   return {
//     accessToken,
//     refreshToken,
//     user: {
//       id: user._id.toString(),
//       fullName: user.fullName,
//       email: user.email,
//       role: payload.role,
//       activeAssignment: user.activeAssignment as any,
//       tenantId: payload.tenantId,
//       branchId: payload.branchId,
//     },
//   };
// };
