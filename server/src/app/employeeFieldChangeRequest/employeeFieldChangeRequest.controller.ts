import { Request, Response } from "express";
import { Types } from "mongoose";
import {
  createFieldChangeRequest,
  getFieldChangeRequests,
  approveRejectFieldChangeRequest,
  getPendingRequestsCount,
  deleteOldProcessedRequests,
} from "../../services/employeeFieldChangeRequest.service";
import { WithUser } from "../../common/middlewares/authMiddleware";

/**
 * Create a new field change request
 */
export const createFieldChangeRequestController = async (
  req: WithUser,
  res: Response
) => {
  try {
    const user = req.user;
    if (!user || !user.activeAssignment) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated or no active assignment",
      });
    }

    const { employeeId, sectionKey, fieldKey, fieldLabel, oldValue, newValue } =
      req.body;

    if (!employeeId || !sectionKey || !fieldKey || !fieldLabel) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const { tenantId, branchId } = user.activeAssignment;

    const request = await createFieldChangeRequest({
      employeeId,
      tenantId,
      branchId,
      sectionKey,
      fieldKey,
      fieldLabel,
      oldValue,
      newValue,
      requestedBy: user.userId,
    });

    return res.status(201).json({
      success: true,
      data: request,
      message: "Field change request created successfully",
    });
  } catch (error: any) {
    console.error("Error creating field change request:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create field change request",
      error: error.message,
    });
  }
};

/**
 * Get field change requests
 */
export const getFieldChangeRequestsController = async (
  req: WithUser,
  res: Response
) => {
  try {
    const user = req.user;
    if (!user || !user.activeAssignment) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated or no active assignment",
      });
    }

    const { employeeId, status, limit, skip } = req.query;
    const { tenantId, branchId } = user.activeAssignment;

    console.log("🔍 DEBUG: getFieldChangeRequestsController called with:", {
      employeeId,
      status,
      tenantId,
      branchId,
    });

    const result = await getFieldChangeRequests({
      employeeId: employeeId as string,
      tenantId,
      branchId,
      status: status as "pending" | "approved" | "rejected",
      limit: limit ? parseInt(String(limit), 10) : undefined,
      skip: skip ? parseInt(String(skip), 10) : undefined,
    });

    console.log("🔍 DEBUG: getFieldChangeRequests result:", {
      requests: result.requests?.length || 0,
      total: result.total,
    });

    return res.status(200).json({
      success: true,
      data: result.requests,
      total: result.total,
      hasMore: result.hasMore,
    });
  } catch (error: any) {
    console.error("Error fetching field change requests:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch field change requests",
      error: error.message,
    });
  }
};

/**
 * Approve or reject a field change request
 */
export const approveRejectFieldChangeRequestController = async (
  req: WithUser,
  res: Response
) => {
  try {
    const user = req.user;
    if (!user || !user.activeAssignment) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated or no active assignment",
      });
    }

    const { requestId } = req.params;
    const { status, rejectionReason } = req.body;

    console.log(
      "🔍 DEBUG: approveRejectFieldChangeRequestController called with:",
      {
        requestId,
        status,
        rejectionReason,
        userId: user.userId,
      }
    );

    if (!requestId || !status || !["approved", "rejected"].includes(status)) {
      console.log("🔍 DEBUG: Invalid request parameters");
      return res.status(400).json({
        success: false,
        message: "Invalid request parameters",
      });
    }

    if (status === "rejected" && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required when rejecting a request",
      });
    }

    console.log("🔍 DEBUG: Calling approveRejectFieldChangeRequest service");
    const request = await approveRejectFieldChangeRequest({
      requestId,
      status,
      rejectionReason,
      reviewedBy: user.userId,
    });

    console.log(
      "🔍 DEBUG: approveRejectFieldChangeRequest completed successfully"
    );

    return res.status(200).json({
      success: true,
      data: request,
      message: `Field change request ${status} successfully`,
    });
  } catch (error: any) {
    console.error("Error processing field change request:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process field change request",
      error: error.message,
    });
  }
};

/**
 * Get pending requests count
 */
export const getPendingRequestsCountController = async (
  req: WithUser,
  res: Response
) => {
  try {
    const user = req.user;
    if (!user || !user.activeAssignment) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated or no active assignment",
      });
    }

    const { employeeId } = req.params;
    const { tenantId, branchId } = user.activeAssignment;

    const count = await getPendingRequestsCount(employeeId, tenantId, branchId);

    return res.status(200).json({
      success: true,
      data: { count },
    });
  } catch (error: any) {
    console.error("Error fetching pending requests count:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending requests count",
      error: error.message,
    });
  }
};

/**
 * Cleanup old processed requests
 */
export const cleanupOldRequestsController = async (
  req: WithUser,
  res: Response
) => {
  try {
    const user = req.user;
    if (!user || !user.activeAssignment) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated or no active assignment",
      });
    }

    // Check if user is admin or tenant owner
    const { role } = user.activeAssignment;
    if (role !== "admin" && role !== "tenant-owner") {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions to cleanup requests",
      });
    }

    const { daysOld = 30 } = req.body;

    const result = await deleteOldProcessedRequests(daysOld);

    return res.status(200).json({
      success: true,
      message: `${result.deletedCount} old requests deleted`,
      deletedCount: result.deletedCount,
    });
  } catch (error: any) {
    console.error("Error cleaning up old requests:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cleanup old requests",
      error: error.message,
    });
  }
};
