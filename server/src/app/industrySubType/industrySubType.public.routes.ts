import { Router } from "express";
import * as industrySubTypeController from "./industrySubType.controller";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { authenticate } from "@/common/middlewares/authMiddleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: IndustrySubTypes (Public)
 *   description: Public read-only industry sub type endpoints (accessible to authenticated users)
 */

/**
 * @swagger
 * /industry-sub-types:
 *   get:
 *     summary: Get all industry sub types (read-only, for reference fields)
 *     tags: [IndustrySubTypes (Public)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Industry sub types fetched successfully
 */
router.get(
  "/",
  authenticate,
  asyncHandler(industrySubTypeController.getIndustrySubTypes)
);

export default router;
