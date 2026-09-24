import { Router } from "express";
import * as industryTypeController from "./industryType.controller";
import { validateBody } from "@/common/middlewares/zodMiddleware";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { requireAdmin } from "@/common/middlewares/adminMiddleware";
import {
  createIndustryTypeSchema,
  updateIndustryTypeSchema,
} from "./industryType.validation";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: IndustryTypes
 *   description: Industry Type management endpoints (Admin only)
 */

router.post(
  "/",
  requireAdmin,
  validateBody(createIndustryTypeSchema),
  asyncHandler(industryTypeController.createIndustryType)
);

router.get(
  "/",
  requireAdmin,
  asyncHandler(industryTypeController.getIndustryTypes)
);

router.get(
  "/:id",
  requireAdmin,
  asyncHandler(industryTypeController.getIndustryTypeById)
);

router.put(
  "/:id",
  requireAdmin,
  validateBody(updateIndustryTypeSchema),
  asyncHandler(industryTypeController.updateIndustryType)
);

router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(industryTypeController.deleteIndustryType)
);

export default router;
