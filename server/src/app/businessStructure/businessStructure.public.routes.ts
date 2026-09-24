import { Router } from "express";
import * as businessStructureController from "./businessStructure.controller";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { authenticate } from "@/common/middlewares/authMiddleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: BusinessStructures (Public)
 *   description: Public read-only business structure endpoints (accessible to authenticated users)
 */

/**
 * @swagger
 * /business-structures:
 *   get:
 *     summary: Get all business structures (read-only, for reference fields)
 *     tags: [BusinessStructures (Public)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Business structures fetched successfully
 */
router.get(
  "/",
  authenticate,
  asyncHandler(businessStructureController.getBusinessStructures)
);

export default router;
