import { Request, Response } from "express";
import { DocumentManagementService } from "../../services/documentManagement.service";
import { asyncHandler } from "../../common/middlewares/asyncHandler";
import { WithUser } from "../../common/middlewares/authMiddleware";
import EmployeeModel from "../../database/models/employee.model";
import { EmployeeProfile } from "../../database/models/employeeProfile.model";
import { Types } from "mongoose";

const documentManagementService = new DocumentManagementService();

/**
 * Upload a document (new or update existing)
 * This will mark the document as "pendingToApprove"
 */
export const uploadDocumentController = asyncHandler(
  async (req: WithUser, res: Response) => {
    const {
      employeeId: rawEmployeeId,
      sectionKey,
      innerSectionKey,
      fieldKey,
      fileId,
      key,
      expiryDate,
      issuingDate,
      referenceNumber,
      countryOfIssue,
      metadata,
    } = req.body;

    const userId = req.user?.userId;
    const tenantId = req.user?.activeAssignment?.tenantId;
    const branchId = req.user?.activeAssignment?.branchId;
    const userRole = req.user?.activeAssignment?.role || req.user?.role;
    const isPlatformAdmin = req.user?.isPlatformAdmin === true;

    if (!userId || !tenantId || !branchId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    // Handle "self" employeeId by resolving to current user's employee ID
    // This needs to happen BEFORE permission checks to determine if user is updating their own profile
    let employeeId = rawEmployeeId;
    let isOwnProfile = false;

    if (employeeId === "self") {
      // First find the EmployeeProfile by userId
      const employeeProfile = await EmployeeProfile.findOne({
        userId: new Types.ObjectId(userId),
      });

      if (!employeeProfile) {
        return res.status(400).json({
          success: false,
          message: "Employee profile not found for current user",
        });
      }

      // Then find the Employee by employeeProfile reference
      const employee = await EmployeeModel.findOne({
        employeeProfile: employeeProfile._id,
        tenantId: new Types.ObjectId(tenantId),
        branchId: new Types.ObjectId(branchId),
        isDeleted: false,
      });

      if (!employee) {
        return res.status(400).json({
          success: false,
          message:
            "Employee record not found for current user in this organization",
        });
      }

      employeeId = employee._id.toString();
      isOwnProfile = true;
    } else if (employeeId) {
      // Check if the provided employeeId belongs to the current user
      const employeeProfile = await EmployeeProfile.findOne({
        userId: new Types.ObjectId(userId),
      });
      if (employeeProfile) {
        const employee = await EmployeeModel.findOne({
          _id: new Types.ObjectId(employeeId),
          employeeProfile: employeeProfile._id,
          tenantId: new Types.ObjectId(tenantId),
          branchId: new Types.ObjectId(branchId),
          isDeleted: false,
        });
        isOwnProfile = !!employee;
      }
    }

    // Check if user is tenant-owner, admin, platform admin, or system admin - if so, grant full access
    const isTenantOwnerOrAdmin =
      userRole === "tenant-owner" || userRole === "admin" || isPlatformAdmin;

    let isSystemAdmin = false;
    if (!isTenantOwnerOrAdmin) {
      try {
        const { getAggregatedRoles } =
          await import("../employee/employeePermission.service");
        const aggregatedRoles = await getAggregatedRoles(
          new Types.ObjectId(userId),
          new Types.ObjectId(tenantId),
          new Types.ObjectId(branchId)
        );
        isSystemAdmin = aggregatedRoles.isSystemAdmin;
      } catch (error) {
        console.warn("Could not get aggregated roles for user:", error);
      }
    }

    // For non-full-access users, check write permission for documents section
    // BUT skip this check if user is updating their own profile
    if (!isTenantOwnerOrAdmin && !isSystemAdmin && !isOwnProfile) {
      const { getEmployeePermissions } =
        await import("../employee/employeePermission.service");
      const { permissions: userPermissions } = await getEmployeePermissions(
        new Types.ObjectId(userId),
        new Types.ObjectId(tenantId),
        new Types.ObjectId(branchId)
      );

      const documentsPerm = userPermissions.permissions["documents"];
      const canWrite = documentsPerm?.write === true;

      if (!canWrite) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied: You don't have write permission for documents section",
        });
      }
    }

    if (
      !employeeId ||
      !sectionKey ||
      !fieldKey ||
      !fileId ||
      !key ||
      !metadata
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: employeeId, sectionKey, fieldKey, fileId, key, metadata",
      });
    }

    // Check if user is an employer (admin or tenant-owner)
    const isEmployer = userRole === "admin" || userRole === "tenant-owner";

    const documentInfo = isEmployer
      ? await documentManagementService.uploadDocumentAsEmployer({
          employeeId,
          sectionKey,
          innerSectionKey,
          fieldKey,
          fileId,
          key,
          uploadedBy: userId,
          tenantId,
          branchId,
          expiryDate: expiryDate ? new Date(expiryDate) : undefined,
          issuingDate: issuingDate ? new Date(issuingDate) : undefined,
          referenceNumber,
          countryOfIssue,
          metadata,
        })
      : await documentManagementService.uploadDocument({
          employeeId,
          sectionKey,
          innerSectionKey,
          fieldKey,
          fileId,
          key,
          uploadedBy: userId,
          tenantId,
          branchId,
          expiryDate: expiryDate ? new Date(expiryDate) : undefined,
          issuingDate: issuingDate ? new Date(issuingDate) : undefined,
          referenceNumber,
          countryOfIssue,
          metadata,
        });

    res.status(201).json({
      success: true,
      message: isEmployer
        ? "Document uploaded and approved"
        : "Document uploaded and sent for approval",
      data: documentInfo,
    });
  }
);

/**
 * Update document expiry or issuing date
 * This will mark the document as "pendingToApprove"
 */
export const updateDocumentDatesController = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      employeeId,
      sectionKey,
      innerSectionKey,
      fieldKey,
      expiryDate,
      issuingDate,
    } = req.body;

    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    if (!employeeId || !sectionKey || !fieldKey) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: employeeId, sectionKey, fieldKey",
      });
    }

    if (!expiryDate && !issuingDate) {
      return res.status(400).json({
        success: false,
        message:
          "At least one date (expiryDate or issuingDate) must be provided",
      });
    }

    // Check if user is an employer (admin or tenant-owner)
    const isEmployer = userRole === "admin" || userRole === "tenant-owner";

    const documentInfo = isEmployer
      ? await documentManagementService.updateDocumentDatesAsEmployer(
          employeeId,
          sectionKey,
          fieldKey,
          userId,
          innerSectionKey,
          {
            expiryDate: expiryDate ? new Date(expiryDate) : undefined,
            issuingDate: issuingDate ? new Date(issuingDate) : undefined,
          }
        )
      : await documentManagementService.updateDocumentDates(
          employeeId,
          sectionKey,
          fieldKey,
          userId,
          innerSectionKey,
          {
            expiryDate: expiryDate ? new Date(expiryDate) : undefined,
            issuingDate: issuingDate ? new Date(issuingDate) : undefined,
          }
        );

    res.status(200).json({
      success: true,
      message: isEmployer
        ? "Document dates updated and approved"
        : "Document dates updated and sent for approval",
      data: documentInfo,
    });
  }
);

/**
 * Approve or reject a document
 */
export const updateDocumentStatusController = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      employeeId,
      sectionKey,
      innerSectionKey,
      fieldKey,
      status,
      rejectionReason,
    } = req.body;

    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    if (!employeeId || !sectionKey || !fieldKey || !status) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: employeeId, sectionKey, fieldKey, status",
      });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'approved' or 'rejected'",
      });
    }

    if (status === "rejected" && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required when rejecting a document",
      });
    }

    const documentInfo = await documentManagementService.updateDocumentStatus({
      employeeId,
      sectionKey,
      innerSectionKey,
      fieldKey,
      status,
      reviewedBy: userId,
      rejectionReason,
    });

    res.status(200).json({
      success: true,
      message: `Document ${status} successfully`,
      data: documentInfo,
    });
  }
);

/**
 * Get all pending documents for an employee
 */
export const getPendingDocumentsByEmployeeController = asyncHandler(
  async (req: Request, res: Response) => {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    const pendingDocuments =
      await documentManagementService.getPendingDocumentsByEmployee(employeeId);

    res.status(200).json({
      success: true,
      data: pendingDocuments,
    });
  }
);

/**
 * Get count of pending documents
 */
export const getPendingDocumentsCountController = asyncHandler(
  async (req: Request, res: Response) => {
    const tenantId = (req as any).user?.tenantId;
    const branchId = (req as any).user?.branchId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const count = await documentManagementService.getPendingDocumentsCount(
      tenantId,
      branchId
    );

    res.status(200).json({
      success: true,
      data: { count },
    });
  }
);

/**
 * Mark expired documents
 */
export const markExpiredDocumentsController = asyncHandler(
  async (req: Request, res: Response) => {
    const modifiedCount =
      await documentManagementService.markExpiredDocuments();

    res.status(200).json({
      success: true,
      message: `Marked ${modifiedCount} documents as expired`,
      data: { modifiedCount },
    });
  }
);
