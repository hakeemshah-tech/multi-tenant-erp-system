import bcrypt from "bcryptjs";
import { User } from "@/database/models/user.model";
import type { IUser } from "@/database/models/user.model";
import { AppError } from "@/common/utils/app-error";
import { generateTokens } from "./token.service";
import type { AuthTokenPayload, AuthResponse } from "./auth.types";
import type { Request } from "express";
import { logLoginSuccess, logLoginFailure } from "@/audit/auth-audit";

/**
 * Admin login service - specifically for platform admins
 */
export const adminLogin = async (
  data: { email: string; password: string },
  req?: Request
): Promise<AuthResponse> => {
  const { email, password } = data;

  const user = await User.findOne({ email, isDeleted: false }).lean<IUser>();
  if (!user) {
    await logLoginFailure({ req, email, reason: "User not found or deleted" });
    throw new AppError("Invalid credentials", 400);
  }

  // Check if user is platform admin
  if (!user.isPlatformAdmin) {
    await logLoginFailure({
      req,
      email,
      reason: "User is not a platform admin",
    });
    throw new AppError("Access denied. Admin privileges required.", 403);
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    await logLoginFailure({ req, email, reason: "Bad password" });
    throw new AppError("Invalid credentials", 400);
  }

  const payload: AuthTokenPayload = {
    userId: user._id.toString(),
    role: "platform-admin",
  };

  const tokens = await generateTokens(payload);

  // 🔐 AUDIT: success
  await logLoginSuccess({
    req,
    userId: user._id.toString(),
    actorEmail: user.email,
    actorName: user.fullName ?? null,
    tenantId: null,
    branchId: null,
  });

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      role: "platform-admin",
      activeAssignment: {
        tenantId: "",
        branchId: "",
        role: "admin", // Default role for admin
      },
    },
  };
};
