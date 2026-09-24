import { Router } from "express";
import * as awardEmployeeTypeController from "./awardEmployeeType.controller";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { authenticate } from "@/common/middlewares/authMiddleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Award Employee Types (Public)
 *   description: Public read-only award employee type endpoints (accessible to authenticated users)
 */

/**
 * @swagger
 * /award-employee-types:
 *   get:
 *     summary: Get all award employee types (read-only, for reference fields)
 *     tags: [Award Employee Types (Public)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Award employee types fetched successfully
 */
router.get(
  "/",
  authenticate,
  asyncHandler(awardEmployeeTypeController.getAwardEmployeeTypes)
);

export default router;
