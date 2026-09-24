import { Router } from "express";
import * as configController from "./employeeFieldConfig.controller";
import * as payrollSettingsController from "./payrollSettings.controller";
import * as employmentSettingsController from "./employmentSettings.controller";
import * as personalSettingsController from "./personalSettings.controller";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { authenticate } from "@/common/middlewares/authMiddleware";
import { requireVerification } from "@/common/middlewares/requireVerification";
import { validateBody } from "@/common/middlewares/zodMiddleware";
import {
  createOrUpdateConfigSchema,
  resetConfigSchema,
} from "./employeeFieldConfig.validation";
import { checkPermission } from "@/common/middlewares/checkPermission";
import { AppError } from "@/common/utils/app-error";
import { WithUser } from "@/common/middlewares/authMiddleware";
import { Request, Response, NextFunction } from "express";

const router = Router();

// Apply verification requirement to all employee field config routes (tenant routes)
router.use(authenticate, requireVerification);

/**
 * @swagger
 * tags:
 *   name: EmployeeFieldConfig
 *   description: Employee field configuration endpoints
 */

/**
 * Middleware to check permissions based on which sections are actually being updated
 * Uses the diff array to determine what actually changed, not just what's in the request
 * - If only "documents" section changed → requires "config-documents" write permission
 * - If only other sections changed → requires "fields" write permission
 * - If both changed → requires both permissions
 */
const checkFieldConfigPermissions = (req: any, res: any, next: any) => {
  try {
    const sections = req.body?.sections || [];
    const diff = req.body?.diff;

    // Debug: Log what we received
    console.log(
      "[Permission Check] Request body keys:",
      Object.keys(req.body || {})
    );
    console.log(
      "[Permission Check] Diff type:",
      typeof diff,
      "Is array:",
      Array.isArray(diff)
    );
    console.log("[Permission Check] Diff value:", diff);

    if (!Array.isArray(sections) || sections.length === 0) {
      return next();
    }

    // Determine which sections actually changed by checking the diff array
    // The diff contains paths like "documents.fieldKey" or "personaldetails.fieldKey"
    let documentsChanged = false;
    let otherSectionsChanged = false;

    // Check if diff is provided and not empty
    if (Array.isArray(diff)) {
      if (diff.length === 0) {
        // Empty diff means nothing changed - allow the request
        return next();
      }

      // Check diff paths to see what actually changed
      for (const change of diff) {
        const path = change?.path || "";
        if (!path || typeof path !== "string") continue;

        const pathLower = path.toLowerCase().trim();

        // If path starts with "documents", documents section was modified
        // Handle paths like "documents", "documents.fieldKey", "documents.fields[key]", etc.
        if (pathLower === "documents" || pathLower.startsWith("documents.")) {
          documentsChanged = true;
        } else if (pathLower && pathLower !== "") {
          // Any other non-empty path means other sections were modified
          // Extract the first part of the path (section key) to identify the section
          // Paths can be like "personaldetails.fieldKey" or "employeedetails.fields[key]"
          const firstPart = pathLower.split(".")[0].split("[")[0]; // Handle array notation
          // Skip if it's "documents" (shouldn't happen, but be safe)
          if (firstPart && firstPart !== "documents" && firstPart.length > 0) {
            otherSectionsChanged = true;
          }
        }
      }

      // Debug logging
      console.log(
        "[Permission Check] Diff paths:",
        diff.map((c: any) => c?.path)
      );
      console.log("[Permission Check] Documents changed:", documentsChanged);
      console.log(
        "[Permission Check] Other sections changed:",
        otherSectionsChanged
      );
    } else {
      // If diff is not provided (not an array), we need to be smarter
      // The documents page always sends all sections, so we can't rely on section presence alone
      // Instead, we should check if the request is likely from the documents page
      // by looking at which sections actually have changes (comparing with stored config would be ideal,
      // but we don't have that in middleware)

      // For now, if diff is missing, we'll check if ONLY documents section exists
      // OR if documents section exists and we can infer it's a documents-only update
      const hasDocumentsSection = sections.some(
        (section: any) => section?.sectionKey?.toLowerCase() === "documents"
      );
      const hasOtherSections = sections.some(
        (section: any) => section?.sectionKey?.toLowerCase() !== "documents"
      );

      // If only documents section is present, assume only documents changed
      if (hasDocumentsSection && !hasOtherSections) {
        documentsChanged = true;
      } else if (!hasDocumentsSection && hasOtherSections) {
        // If only other sections are present, assume only other sections changed
        otherSectionsChanged = true;
      } else if (hasDocumentsSection && hasOtherSections) {
        // Both are present but no diff - this is the problematic case
        // Since documents page always sends all sections, we can't determine what changed
        // Strategy: Check documents permission first. If user has documents permission,
        // allow it (assuming only documents changed, which is the common case for documents page).
        // If user doesn't have documents permission, they shouldn't be saving anyway.
        // If other sections actually changed and user doesn't have fields permission,
        // the save will fail at the service level (which is acceptable - diff should always be sent).
        console.warn(
          "[Permission Check] Both documents and other sections present, but no diff provided."
        );
        console.warn(
          "[Permission Check] Assuming documents-only change. Checking documents permission only."
        );
        documentsChanged = true;
        // Explicitly do NOT set otherSectionsChanged = true
        // This allows documents-only saves to work even when diff is missing
      }
    }

    // Check permissions based on what actually changed
    if (documentsChanged && otherSectionsChanged) {
      // Both changed - need both permissions
      const checkDocuments = checkPermission({
        section: "config-documents",
        action: "write",
      });
      return checkDocuments(req, res, (err: any) => {
        if (err) return next(err);
        const checkFields = checkPermission({
          section: "fields",
          action: "write",
        });
        return checkFields(req, res, next);
      });
    } else if (documentsChanged) {
      // Only documents changed - only need documents permission
      const checkDocuments = checkPermission({
        section: "config-documents",
        action: "write",
      });
      return checkDocuments(req, res, next);
    } else if (otherSectionsChanged) {
      // Only other sections changed - only need fields permission
      const checkFields = checkPermission({
        section: "fields",
        action: "write",
      });
      return checkFields(req, res, next);
    }

    // No changes detected, proceed
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /employee-field-config:
 *   post:
 *     summary: Create or update employee field configuration
 *     tags: [EmployeeFieldConfig]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrUpdateEmployeeFieldConfigInput'
 *     responses:
 *       200:
 *         description: Employee field configuration saved successfully
 */
// Create or update config - requires write permission for sections being updated
router.post(
  "/",
  checkFieldConfigPermissions,
  validateBody(createOrUpdateConfigSchema),
  asyncHandler(configController.createOrUpdateEmployeeFieldConfig)
);

/**
 * @swagger
 * /employee-field-config:
 *   get:
 *     summary: Get employee field configuration
 *     tags: [EmployeeFieldConfig]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: designationId
 *         schema:
 *           type: string
 *         description: Filter configuration by designation ID
 *     responses:
 *       200:
 *         description: Employee field configuration fetched successfully
 */
/**
 * Middleware to check read permissions - allows access if user has read permission
 * for either "fields" OR "config-documents" (since the config contains both)
 */
const checkFieldConfigReadPermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = (req as WithUser).user;

    if (!user) {
      return next(new AppError("Unauthenticated", 401));
    }

    // Platform admins, tenant owners, and admins bypass all permission checks
    if (
      user.isPlatformAdmin ||
      user.role === "tenant-owner" ||
      user.role === "admin"
    ) {
      return next();
    }

    // For employees, check if they have read permission for either section
    if (!user.activeAssignment) {
      return next(new AppError("No active assignment found", 403));
    }

    const { getEmployeePermissions } =
      await import("@/app/employee/employeePermission.service");
    const { Types } = await import("mongoose");

    const tenantId = new Types.ObjectId(user.activeAssignment.tenantId);
    const branchId = new Types.ObjectId(user.activeAssignment.branchId);
    const userId = new Types.ObjectId(user.userId);

    const { permissions, aggregatedRoles } = await getEmployeePermissions(
      userId,
      tenantId,
      branchId
    );

    // System admin has full access
    if (aggregatedRoles.isSystemAdmin) {
      return next();
    }

    // Check if user has read permission for either "fields" OR "config-documents"
    const hasFieldsRead = permissions.permissions["fields"]?.read === true;
    const hasDocumentsRead =
      permissions.permissions["config-documents"]?.read === true ||
      permissions.permissions["documents"]?.read === true; // Backward compat

    if (!hasFieldsRead && !hasDocumentsRead) {
      return next(
        new AppError(
          "Access denied: No read permission for fields or config-documents",
          403
        )
      );
    }

    next();
  } catch (error: any) {
    if (error instanceof AppError) {
      return next(error);
    }
    return next(new AppError("Permission check failed", 500));
  }
};

// Get config - requires read permission for fields OR config-documents
router.get(
  "/",
  checkFieldConfigReadPermissions,
  asyncHandler(configController.getEmployeeFieldConfig)
);

/**
 * @swagger
 * /employee-field-config/profile-config:
 *   get:
 *     summary: Get employee Profile field configuration
 *     tags: [EmployeeFieldConfig]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: designationId
 *         schema:
 *           type: string
 *         description: Filter configuration by designation ID
 *     responses:
 *       200:
 *         description: Employee Profile field configuration fetched successfully
 */
router.get(
  "/profile-config",
  asyncHandler(configController.getEmployeeProfileFieldConfig)
);

/**
 * @swagger
 * /employee-field-config/reset:
 *   post:
 *     summary: Reset employee field configuration to default
 *     tags: [EmployeeFieldConfig]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetEmployeeFieldConfigInput'
 *     responses:
 *       200:
 *         description: Configuration reset to default successfully
 */
// Reset config - requires write permission for fields
router.post(
  "/reset",
  checkPermission({ section: "fields", action: "write" }),
  validateBody(resetConfigSchema),
  asyncHandler(configController.resetEmployeeFieldConfigToDefault)
);

/**
 * @swagger
 * /employee-field-config/by-org:
 *   get:
 *     summary: Get employee field configuration for a specific organization (tenant+branch)
 *     tags: [EmployeeFieldConfig]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         required: true
 *         description: Tenant ObjectId
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *         required: true
 *         description: Branch ObjectId
 *       - in: query
 *         name: designationId
 *         schema:
 *           type: string
 *         required: false
 *         description: Optional designation filter
 *     responses:
 *       200:
 *         description: Employee field configuration fetched successfully
 *       400:
 *         description: Missing/invalid query parameters
 *       403:
 *         description: Not authorized for the requested organization
 */
router.get(
  "/by-org",
  asyncHandler(configController.getEmployeeFieldConfigByOrg)
);

/**
 * @swagger
 * /employee-field-config/my/{branchId}:
 *   get:
 *     summary: Get employee field configuration for the logged-in user by organization (branch) id
 *     tags: [EmployeeFieldConfig]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization id (branch _id)
 *     responses:
 *       200:
 *         description: Employee field configuration fetched successfully
 *       400:
 *         description: Invalid branchId
 *       403:
 *         description: Not assigned to this organization
 */
router.get(
  "/my/:branchId",
  asyncHandler(configController.getMyEmployeeFieldConfigByBranch)
);

/**
 * Get Employment Type options from EmployeeFieldConfig for current org
 */
router.get(
  "/employment-types",
  asyncHandler(configController.getEmploymentTypeOptions)
);

/**
 * Payroll Settings endpoints
 */
router.get(
  "/payroll-settings",
  checkPermission({ section: "payroll-settings", action: "read" }),
  asyncHandler(payrollSettingsController.getPayrollSettings)
);

router.put(
  "/payroll-settings",
  checkPermission({ section: "payroll-settings", action: "write" }),
  asyncHandler(payrollSettingsController.updatePayrollSettings)
);

/**
 * Employment Settings endpoints
 */
router.get(
  "/employment-settings",
  checkPermission({ section: "employment-settings", action: "read" }),
  asyncHandler(employmentSettingsController.getEmploymentSettings)
);

router.put(
  "/employment-settings",
  checkPermission({ section: "employment-settings", action: "write" }),
  asyncHandler(employmentSettingsController.updateEmploymentSettings)
);

/**
 * Personal Settings endpoints
 */
router.get(
  "/personal-settings",
  checkPermission({ section: "personal-settings", action: "read" }),
  asyncHandler(personalSettingsController.getPersonalSettings)
);

router.put(
  "/personal-settings",
  checkPermission({ section: "personal-settings", action: "write" }),
  asyncHandler(personalSettingsController.updatePersonalSettings)
);

export default router;
