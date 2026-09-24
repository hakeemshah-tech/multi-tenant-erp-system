import { Router } from "express";
import * as industryTypeController from "./industryType.controller";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { authenticate } from "@/common/middlewares/authMiddleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: IndustryTypes (Public)
 *   description: Public read-only industry type endpoints (accessible to authenticated users)
 */

/**
 * @swagger
 * /industry-types:
 *   get:
 *     summary: Get all industry types (read-only, for reference fields)
 *     tags: [IndustryTypes (Public)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Industry types fetched successfully
 */
router.get(
  "/",
  authenticate,
  asyncHandler(industryTypeController.getIndustryTypes)
);

export default router;
