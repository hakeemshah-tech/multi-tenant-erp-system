import { Router } from "express";
import * as awardController from "./award.controller";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { authenticate } from "@/common/middlewares/authMiddleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Awards (Public)
 *   description: Public read-only award endpoints (accessible to authenticated users)
 */

/**
 * @swagger
 * /awards:
 *   get:
 *     summary: Get all awards (read-only, for reference fields)
 *     tags: [Awards (Public)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Awards fetched successfully
 */
router.get("/", authenticate, asyncHandler(awardController.getAwards));

export default router;
