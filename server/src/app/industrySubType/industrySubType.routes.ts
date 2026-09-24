import { Router } from "express";
import * as industrySubTypeController from "./industrySubType.controller";
import { validateBody } from "@/common/middlewares/zodMiddleware";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { requireAdmin } from "@/common/middlewares/adminMiddleware";
import {
  createIndustrySubTypeSchema,
  updateIndustrySubTypeSchema,
} from "./industrySubType.validation";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: IndustrySubTypes
 *   description: Industry Sub Type management endpoints (Admin only)
 */

router.post(
  "/",
  requireAdmin,
  validateBody(createIndustrySubTypeSchema),
  asyncHandler(industrySubTypeController.createIndustrySubType)
);

router.get(
  "/",
  requireAdmin,
  asyncHandler(industrySubTypeController.getIndustrySubTypes)
);

router.get(
  "/:id",
  requireAdmin,
  asyncHandler(industrySubTypeController.getIndustrySubTypeById)
);

router.put(
  "/:id",
  requireAdmin,
  validateBody(updateIndustrySubTypeSchema),
  asyncHandler(industrySubTypeController.updateIndustrySubType)
);

router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(industrySubTypeController.deleteIndustrySubType)
);

export default router;
