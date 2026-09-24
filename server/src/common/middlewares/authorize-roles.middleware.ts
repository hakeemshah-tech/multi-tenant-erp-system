// src/app/auth/authorize-roles.middleware.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "@/common/utils/app-error";
import { WithUser, AuthenticatedUser } from "./authMiddleware";

// Reuse the same role union you already use
export type Role = NonNullable<AuthenticatedUser["activeAssignment"]>["role"]; // "admin" | "employee" | "tenant-owner"

/**
 * Check whether a user has at least one of the allowed roles.
 * Prefers activeAssignment.role; falls back to any assignment if active missing.
 */
function userHasAllowedRole(user: AuthenticatedUser, allowed: Role[]): boolean {
  const activeRole: any = user.activeAssignment?.role ?? user.role ?? null;
  if (activeRole && allowed.includes(activeRole)) return true;

  // Fallback: if no active role (or not matched), check any assignment role
  if (Array.isArray(user.assignments) && user.assignments.length > 0) {
    return user.assignments.some(
      (a: any) => allowed.includes(a?.role) // roles are already constrained in your schema
    );
  }

  return false;
}

/**
 * Express middleware factory to authorize by role.
 * Usage: authorizeRoles("admin", "tenant-owner")
 */
export const authorizeRoles =
  (...allowed: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as WithUser).user;

    if (!user) {
      return next(new AppError("Unauthenticated", 401));
    }

    if (!allowed || allowed.length === 0) {
      // Defensive: if someone wires it up without roles, deny
      return next(new AppError("Forbidden", 403));
    }

    const ok = userHasAllowedRole(user, allowed);
    if (!ok) {
      return next(new AppError("Forbidden: insufficient role", 403));
    }

    return next();
  };
