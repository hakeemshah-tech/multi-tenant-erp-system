import { Router } from "express";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { authenticate } from "@/common/middlewares/authMiddleware";
import * as invitationController from "./employeeInvitation.controller";

const router = Router();

router.post(
  "/invite",
  authenticate,
  asyncHandler(invitationController.createInvitation)
);
router.post(
  "/accept",
  authenticate,
  asyncHandler(invitationController.acceptInvitation)
);

/**
 * @swagger
 * /employee-invitations:
 *   get:
 *     summary: Get all employee invitations
 *     tags: [Employee Invitations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of employee invitations
 */
router.get(
  "/",
  authenticate,
  asyncHandler(invitationController.getInvitations)
);

// Public endpoint - no auth required for preview
router.get("/preview", asyncHandler(invitationController.getInvitationPreview));

export default router;
