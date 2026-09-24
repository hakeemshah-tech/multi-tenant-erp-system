import { Request, Response, NextFunction } from "express";
import { WithUser } from "./authMiddleware";
import { AppError } from "@/common/utils/app-error";
import { Types } from "mongoose";
import { getEmployeePermissions } from "@/app/employee/employeePermission.service";

/**
 * Permission action types
 */
type PermissionAction = "read" | "write" | "delete";

/**
 * Options for permission checking middleware
 */
interface CheckPermissionOptions {
  section: string;
  action: PermissionAction;
}

/**
 * Middleware to check if user has permission for a specific section and action
 *
 * Usage:
 * router.get("/employees", authenticate, checkPermission({ section: "employees", action: "read" }), getEmployees);
 * router.post("/employees", authenticate, checkPermission({ section: "employees", action: "write" }), createEmployee);
 * router.delete("/employees/:id", authenticate, checkPermission({ section: "employees", action: "delete" }), deleteEmployee);
 */
export const checkPermission = (options: CheckPermissionOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as WithUser).user;

      if (!user) {
        return next(new AppError("Unauthenticated", 401));
      }

      // Platform admins bypass all permission checks
      if (user.isPlatformAdmin) {
        return next();
      }

      // Tenant owners and admins bypass permission checks (they have full access)
      if (user.role === "tenant-owner" || user.role === "admin") {
        return next();
      }

      // For employees, check permissions
      // Special case: Allow access to branch details without activeAssignment
      // This is needed for accept-invite page where user hasn't accepted invitation yet
      if (!user.activeAssignment) {
        // Allow read access to organisation-details without activeAssignment
        // This enables accept-invite page to fetch branch details for display
        if (
          options.section === "organisation-details" &&
          options.action === "read"
        ) {
          return next();
        }
        return next(new AppError("No active assignment found", 403));
      }

      const tenantId = new Types.ObjectId(user.activeAssignment.tenantId);
      const branchId = new Types.ObjectId(user.activeAssignment.branchId);
      const userId = new Types.ObjectId(user.userId);

      // Get employee permissions
      const { permissions, aggregatedRoles } = await getEmployeePermissions(
        userId,
        tenantId,
        branchId
      );

      // System admin has full access
      if (aggregatedRoles.isSystemAdmin) {
        return next();
      }

      // Check if employee has at least one role
      if (aggregatedRoles.roleIds.length === 0) {
        return next(
          new AppError(
            "No roles assigned. Please contact your administrator.",
            403
          )
        );
      }

      // Check permission for the requested section and action
      let sectionPermissions = permissions.permissions[options.section];

      // Backward compatibility: If checking "job-titles" and not found, also check "positions"
      // This handles cases where permissions were saved with the old "positions" key
      if (!sectionPermissions && options.section === "job-titles") {
        sectionPermissions = permissions.permissions["positions"];
        if (sectionPermissions) {
          console.warn(
            `[checkPermission] Found permissions under old "positions" key for section "job-titles". Please re-save permissions in RBAC page to use "job-titles".`
          );
        }
      }

      // Backward compatibility: If checking "config-documents" and not found, also check "documents"
      // This handles cases where permissions were saved with the old "documents" key
      if (!sectionPermissions && options.section === "config-documents") {
        sectionPermissions = permissions.permissions["documents"];
        if (sectionPermissions) {
          console.warn(
            `[checkPermission] Found permissions under old "documents" key for section "config-documents". Please re-save permissions in RBAC page to use "config-documents".`
          );
        }
      }

      if (!sectionPermissions) {
        return next(
          new AppError(
            `Access denied: No permission for section "${options.section}"`,
            403
          )
        );
      }

      // Check the specific action
      if (!sectionPermissions[options.action]) {
        return next(
          new AppError(
            `Access denied: No ${options.action} permission for section "${options.section}"`,
            403
          )
        );
      }

      // Permission granted, proceed
      next();
    } catch (error: any) {
      console.error("Permission check error:", error);
      if (error instanceof AppError) {
        return next(error);
      }
      return next(new AppError("Permission check failed", 500));
    }
  };
};
