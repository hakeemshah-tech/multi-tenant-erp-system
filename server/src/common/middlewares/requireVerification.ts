import { Response, NextFunction } from "express";
import { AppError } from "@/common/utils/app-error";
import { WithUser } from "./authMiddleware";

/**
 * Middleware to require email verification
 * Blocks access if user is not verified
 * Must be used after authenticate middleware
 */
export const requireVerification = async (
  req: WithUser,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if user is verified
    // Allow platform admins to bypass verification
    if (!req.user.isVerified && !req.user.isPlatformAdmin) {
      throw new AppError(
        "Email verification required. Please verify your email to access this resource.",
        403
      );
    }

    next();
  } catch (err: any) {
    if (err instanceof AppError) {
      next(err);
    } else {
      next(new AppError("Verification check failed", 500));
    }
  }
};
