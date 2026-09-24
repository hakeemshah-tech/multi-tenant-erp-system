import { Request, Response } from "express";
import { Types } from "mongoose";
import {
  getNotifications,
  markNotificationsAsRead,
  deleteOldNotifications,
} from "../../services/notification.service";
import { WithUser } from "../../common/middlewares/authMiddleware";

/**
 * Get notifications for the current user's tenant and branch
 */
export const getNotificationsController = async (
  req: WithUser,
  res: Response
) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    let tenantId: string;
    let branchId: string;

    // For employees, try to get tenant/branch from active assignment first
    if (user.activeAssignment) {
      tenantId = user.activeAssignment.tenantId;
      branchId = user.activeAssignment.branchId;
    } else {
      // If no active assignment, try to get from user's assignments
      const assignment = user.assignments?.[0];
      if (assignment) {
        tenantId = assignment.tenantId.toString();
        branchId = assignment.branchId.toString();
      } else {
        return res.status(400).json({
          success: false,
          message: "No tenant/branch context found for user",
        });
      }
    }

    const { limit = 50, skip = 0, isRead, type } = req.query;

    // Determine if this user should see all notifications or only targeted ones
    // Employers (tenant-owner role) see all notifications in their tenant/branch
    // Employees see only notifications targeted to them
    const isEmployer = user.role === "tenant-owner" || user.role === "admin";

    // Normalize user.userId to ObjectId for comparison
    // user.userId is a string from JWT, convert to ObjectId for database query
    const targetUserIdForQuery = isEmployer
      ? undefined
      : new Types.ObjectId(user.userId);

    console.log(
      `[NOTIFICATIONS] Fetching notifications for user ${user.userId} (${typeof user.userId}), isEmployer: ${isEmployer}, targetUserId: ${targetUserIdForQuery?.toString() || "undefined"}, tenantId: ${tenantId}, branchId: ${branchId}`
    );

    const result = await getNotifications({
      tenantId,
      branchId,
      targetUserId: targetUserIdForQuery, // Only filter by user if not employer
      limit: parseInt(String(limit), 10),
      skip: parseInt(String(skip), 10),
      isRead: isRead === "true" ? true : isRead === "false" ? false : undefined,
      type: type as string,
    });

    console.log(
      `[NOTIFICATIONS] Query result - Found ${result.notifications.length} notifications, total: ${result.total}, unread: ${result.unreadCount}`
    );

    return res.status(200).json({
      success: true,
      data: result.notifications,
      total: result.total,
      unreadCount: result.unreadCount,
    });
  } catch (error: any) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

/**
 * Mark notifications as read
 */
export const markNotificationsAsReadController = async (
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

    const { tenantId, branchId } = user.activeAssignment;
    const { notificationIds } = req.body;

    const result = await markNotificationsAsRead(
      tenantId,
      branchId,
      notificationIds
    );

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error: any) {
    console.error("Error marking notifications as read:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark notifications as read",
      error: error.message,
    });
  }
};

/**
 * Get notification statistics
 */
export const getNotificationStatsController = async (
  req: WithUser,
  res: Response
) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    let tenantId: string;
    let branchId: string;

    // For employees, try to get tenant/branch from active assignment first
    if (user.activeAssignment) {
      tenantId = user.activeAssignment.tenantId;
      branchId = user.activeAssignment.branchId;
    } else {
      // If no active assignment, try to get from user's assignments
      const assignment = user.assignments?.[0];
      if (assignment) {
        tenantId = assignment.tenantId.toString();
        branchId = assignment.branchId.toString();
      } else {
        return res.status(400).json({
          success: false,
          message: "No tenant/branch context found for user",
        });
      }
    }

    // Determine if this user should see all notifications or only targeted ones
    // Employers (tenant-owner role) see all notifications in their tenant/branch
    // Employees see only notifications targeted to them
    const isEmployer = user.role === "tenant-owner" || user.role === "admin";

    // Get total notifications
    const totalResult = await getNotifications({
      tenantId,
      branchId,
      targetUserId: isEmployer ? undefined : user.userId, // Only filter by user if not employer
      limit: 1,
      skip: 0,
    });

    // Get unread notifications
    const unreadResult = await getNotifications({
      tenantId,
      branchId,
      targetUserId: isEmployer ? undefined : user.userId, // Only filter by user if not employer
      limit: 1,
      skip: 0,
      isRead: false,
    });

    // Get employee data change notifications
    const employeeChangeResult = await getNotifications({
      tenantId,
      branchId,
      targetUserId: isEmployer ? undefined : user.userId, // Only filter by user if not employer
      limit: 1,
      skip: 0,
      type: "employee_data_change",
    });

    // Get field change request notifications (only for employers)
    const fieldChangeRequestResult = await getNotifications({
      tenantId,
      branchId,
      targetUserId: isEmployer ? undefined : user.userId, // Only filter by user if not employer
      limit: 1,
      skip: 0,
      type: "field_change_request",
    });

    // Get field change approved notifications (only for employees)
    const fieldChangeApprovedResult = await getNotifications({
      tenantId,
      branchId,
      targetUserId: isEmployer ? undefined : user.userId, // Only filter by user if not employer
      limit: 1,
      skip: 0,
      type: "field_change_approved",
    });

    // Get field change rejected notifications (only for employees)
    const fieldChangeRejectedResult = await getNotifications({
      tenantId,
      branchId,
      targetUserId: isEmployer ? undefined : user.userId, // Only filter by user if not employer
      limit: 1,
      skip: 0,
      type: "field_change_rejected",
    });

    return res.status(200).json({
      success: true,
      data: {
        total: totalResult.total,
        unread: unreadResult.total,
        employeeDataChanges: employeeChangeResult.total,
        fieldChangeRequests: fieldChangeRequestResult.total,
        fieldChangeApproved: fieldChangeApprovedResult.total,
        fieldChangeRejected: fieldChangeRejectedResult.total,
      },
    });
  } catch (error: any) {
    console.error("Error fetching notification stats:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notification statistics",
      error: error.message,
    });
  }
};

/**
 * Clean up old notifications (admin only)
 */
export const cleanupOldNotificationsController = async (
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
        message: "Insufficient permissions to cleanup notifications",
      });
    }

    const { daysOld = 30 } = req.body;

    const result = await deleteOldNotifications(daysOld);

    return res.status(200).json({
      success: true,
      message: `${result.deletedCount} old notifications deleted`,
      deletedCount: result.deletedCount,
    });
  } catch (error: any) {
    console.error("Error cleaning up old notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cleanup old notifications",
      error: error.message,
    });
  }
};
