import { Router } from "express";
import { authenticate } from "@/common/middlewares/authMiddleware";
import { authorizeRoles } from "@/common/middlewares/authorize-roles.middleware";
import { requireOrganizationMode } from "@/common/middlewares/require-organization-mode.middleware";
import { validateBody } from "@/common/middlewares/zodMiddleware";
import * as controller from "./templateType.controller";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import {
  createTemplateTypeSchema,
  updateTemplateTypeSchema,
} from "./templateType.validation";

const router = Router();

router.post(
  "/",
  authenticate,
  requireOrganizationMode,
  authorizeRoles("tenant-owner"),
  validateBody(createTemplateTypeSchema),
  asyncHandler(controller.create)
);

router.get(
  "/",
  authenticate,
  requireOrganizationMode,
  authorizeRoles("tenant-owner"),
  asyncHandler(controller.list)
);

router.patch(
  "/:id",
  authenticate,
  requireOrganizationMode,
  authorizeRoles("tenant-owner"),
  validateBody(updateTemplateTypeSchema),
  asyncHandler(controller.update)
);

export default router;
