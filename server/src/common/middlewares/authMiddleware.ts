// import { Request, Response, NextFunction } from "express";
// import { verifyAccessToken } from "@/app/auth/token.service";
// import { AppError } from "@/common/utils/app-error";

// export interface AuthenticatedRequest extends Request {
//   user?: {
//     userId: string;
//     tenantId: string;
//     branchId: string;
//     role: "admin" | "employee" | "tenant-owner";
//   };
// }

// export const authenticate = async (
//   req: AuthenticatedRequest,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     // Check Authorization header
//     let token = req.headers.authorization?.split(" ")[1];

//     // Fallback: Check cookies
//     if (!token && req.cookies?.accessToken) {
//       token = req.cookies.accessToken;
//     }

//     if (!token) {
//       throw new AppError("Authorization token missing", 401);
//     }

//     const decoded = verifyAccessToken(token) as AuthenticatedRequest["user"];

//     if (!decoded?.userId || !decoded?.tenantId || !decoded?.branchId) {
//       throw new AppError("Invalid token payload", 401);
//     }

//     req.user = decoded;
//     next();
//   } catch (err) {
//     console.log(err);
//     next(new AppError("Invalid or expired token", 401));
//   }
// };

// export const authenticate = async (
//   req: AuthenticatedRequest,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const authHeader = req.headers.authorization;

//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//       throw new AppError("Authorization token missing", 401);
//     }

//     const token = authHeader.split(" ")[1];

//     const decoded = verifyAccessToken(token) as AuthenticatedRequest["user"];

//     if (!decoded?.userId || !decoded?.tenantId || !decoded?.branchId) {
//       throw new AppError("Invalid token payload", 401);
//     }

//     req.user = decoded;
//     next();
//   } catch (err) {
//     next(new AppError("Invalid or expired token", 401));
//   }
// };

// -------------new--------------

// import { Request, Response, NextFunction } from "express";
// import { verifyAccessToken } from "@/app/auth/token.service";
// import { AppError } from "@/common/utils/app-error";
// import { User } from "@/database/models/user.model";
// import { Types } from "mongoose";

// export interface AuthenticatedUser {
//   userId: string;
//   fullName: string;
//   email: string;
//   role: "admin" | "employee" | "tenant-owner";
//   tenantId: string;
//   branchId: string;
//   assignments: any[];
//   activeAssignment: {
//     tenantId: string;
//     branchId: string;
//     role: "admin" | "employee" | "tenant-owner";
//   };
// }

// // This is only for casting, not for middleware signature
// export interface WithUser extends Request {
//   user: AuthenticatedUser;
// }

// export const authenticate = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     let token: string | undefined;

//     if (req.headers.authorization?.startsWith("Bearer ")) {
//       token = req.headers.authorization.split(" ")[1];
//     }

//     // if (!token && req.cookies?.accessToken) {
//     //   token = req.cookies.accessToken;
//     // }

//     if (!token) {
//       throw new AppError("Authorization token missing", 401);
//     }

//     const payload = verifyAccessToken(token) as {
//       userId: string;
//       tenantId: string;
//       branchId: string;
//       role: "admin" | "employee" | "tenant-owner";
//     };

//     if (
//       !payload.userId ||
//       !payload.tenantId ||
//       !payload.branchId ||
//       !payload.role
//     ) {
//       throw new AppError("Invalid token payload", 401);
//     }

//     const user = await User.findById(payload.userId).lean();
//     if (!user) throw new AppError("User not found", 404);

//     const assignment = user.assignments.find(
//       (a) =>
//         a.tenantId.toString() === payload.tenantId &&
//         a.branchId.toString() === payload.branchId &&
//         a.role === payload.role
//     );

//     if (!assignment) {
//       throw new AppError("Invalid tenant/branch assignment", 403);
//     }

//     (req as WithUser).user = {
//       userId: user._id.toString(),
//       fullName: user.fullName,
//       email: user.email,
//       role: assignment.role,
//       tenantId: assignment.tenantId.toString(),
//       branchId: assignment.branchId.toString(),
//       assignments: user.assignments,
//       activeAssignment: {
//         tenantId: assignment.tenantId.toString(),
//         branchId: assignment.branchId.toString(),
//         role: assignment.role,
//       },
//     };

//     next();
//   } catch (err) {
//     console.error("Authentication Error:", err);
//     next(new AppError("Invalid or expired token", 401));
//   }
// };

import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "@/app/auth/token.service";
import { AppError } from "@/common/utils/app-error";
import { User } from "@/database/models/user.model";
import { EmployeeProfile } from "@/database/models/employeeProfile.model";

/**
 * Interface for decoded user payload from JWT
 */
export interface AuthenticatedUser {
  userId: string;
  fullName: string;
  email: string;
  role: "admin" | "employee" | "tenant-owner" | "newbie" | "platform-admin";
  tenantId: string | null;
  branchId: string | null;
  assignments: any[];
  activeAssignment: {
    tenantId: string;
    branchId: string;
    role: "admin" | "employee" | "tenant-owner";
  } | null;
  currentMode: "nexus-profile" | "organization" | "newbie";
  isEmployeeProfileCreated: boolean;
  isOrganizationFound: boolean;
  isPlatformAdmin?: boolean;
  isVerified?: boolean;
}

export interface WithUser extends Request {
  user: AuthenticatedUser;
}

export const authenticate = async (
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
      tenantId?: string;
      branchId?: string;
      role?: "admin" | "employee" | "tenant-owner" | "platform-admin";
    };

    if (!payload.userId) {
      throw new AppError("Invalid token payload", 401);
    }

    const user = await User.findById(payload.userId).lean();
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // If user is platform admin, return early with admin role
    if (user.isPlatformAdmin && payload.role === "platform-admin") {
      const enrichedUser: AuthenticatedUser = {
        userId: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
        role: "platform-admin",
        tenantId: null,
        branchId: null,
        currentMode: user.currentMode,
        assignments: [],
        activeAssignment: null,
        isEmployeeProfileCreated: false,
        isOrganizationFound: false,
        isPlatformAdmin: true,
        isVerified: user.isVerified || false,
      };
      (req as WithUser).user = enrichedUser;
      next();
      return;
    }

    // 🔍 Check if employee profile exists
    const profile = await EmployeeProfile.findOne({ userId: user._id }).lean();
    const isEmployeeProfileCreated = Boolean(profile);

    // 🔍 Check if user has at least one tenant-owner assignment
    const isOrganizationFound =
      user.assignments?.some((a) => a.role === "tenant-owner") ?? false;

    const assignment = user.activeAssignment || null;

    // Serialize assignments to ensure ObjectIds are converted to strings
    const serializedAssignments = (user.assignments || []).map((a: any) => ({
      tenantId: a.tenantId?.toString
        ? a.tenantId.toString()
        : String(a.tenantId),
      branchId: a.branchId?.toString
        ? a.branchId.toString()
        : String(a.branchId),
      role: a.role,
    }));

    const enrichedUser: AuthenticatedUser = {
      userId: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      role: assignment?.role || (payload.role as any) || "newbie",
      tenantId: assignment?.tenantId?.toString() || null,
      branchId: assignment?.branchId?.toString() || null,
      currentMode: user.currentMode,
      assignments: serializedAssignments,
      activeAssignment: assignment
        ? {
            tenantId: assignment.tenantId.toString(),
            branchId: assignment.branchId.toString(),
            role: assignment.role,
          }
        : null,
      isEmployeeProfileCreated,
      isOrganizationFound,
      isPlatformAdmin: user.isPlatformAdmin || false,
      isVerified: user.isVerified || false,
    };

    (req as WithUser).user = enrichedUser;
    next();
  } catch (err) {
    console.error("Authentication Error:", err);
    next(new AppError("Invalid or expired token", 401));
  }
};
