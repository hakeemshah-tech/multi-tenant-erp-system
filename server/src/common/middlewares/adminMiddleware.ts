import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "@/app/auth/token.service";
import { AppError } from "@/common/utils/app-error";
import { User } from "@/database/models/user.model";

export interface AdminUser {
  userId: string;
  fullName: string;
  email: string;
  role: "platform-admin";
}

export interface WithAdmin extends Request {
  user: AdminUser;
}

/**
 * Middleware to authenticate and authorize platform admins only
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      throw new AppError("Authorization token missing", 401);
    }

    const payload = verifyAccessToken(token) as {
      userId: string;
      role?: string;
    };

    if (!payload.userId) {
      throw new AppError("Invalid token payload", 401);
    }

    // Check if user is platform admin
    if (payload.role !== "platform-admin") {
      throw new AppError("Access denied. Admin privileges required.", 403);
    }

    const user = await User.findById(payload.userId).lean();
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Double-check isPlatformAdmin flag
    if (!user.isPlatformAdmin) {
      throw new AppError("Access denied. Admin privileges required.", 403);
    }

    (req as WithAdmin).user = {
      userId: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      role: "platform-admin",
    };

    next();
  } catch (err) {
    console.error("Admin Authentication Error:", err);
    if (err instanceof AppError) {
      next(err);
    } else {
      next(new AppError("Invalid or expired token", 401));
    }
  }
};
