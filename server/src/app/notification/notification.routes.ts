import { Router } from "express";
import { authenticate } from "../../common/middlewares/authMiddleware";
import {
  getNotificationsController,
  markNotificationsAsReadController,
  getNotificationStatsController,
  cleanupOldNotificationsController,
} from "./notification.controller";

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @route GET /notifications
 * @desc Get notifications for the current user's tenant and branch
 * @access Private
 */
router.get("/", getNotificationsController);

/**
 * @route POST /notifications/mark-read
 * @desc Mark notifications as read
 * @access Private
 */
router.post("/mark-read", markNotificationsAsReadController);

/**
 * @route GET /notifications/stats
 * @desc Get notification statistics
 * @access Private
 */
router.get("/stats", getNotificationStatsController);

/**
 * @route POST /notifications/cleanup
 * @desc Clean up old notifications (admin only)
 * @access Private (Admin/Tenant Owner)
 */
router.post("/cleanup", cleanupOldNotificationsController);

export default router;
