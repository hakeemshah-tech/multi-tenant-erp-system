import { Router } from "express";
import { authenticate } from "@/common/middlewares/authMiddleware";
import { authorizeRoles } from "@/common/middlewares/authorize-roles.middleware";
import { requireOrganizationMode } from "@/common/middlewares/require-organization-mode.middleware";
import { validateBody } from "@/common/middlewares/zodMiddleware";
import * as controller from "./contractType.controller";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import {
  createContractTypeSchema,
  updateContractTypeSchema,
} from "./contractType.validation";
import { checkPermission } from "@/common/middlewares/checkPermission";

const router = Router();

router.post(
  "/",
  authenticate,
  requireOrganizationMode,
  checkPermission({ section: "contracts", action: "write" }),
  validateBody(createContractTypeSchema),
  asyncHandler(controller.create)
);

router.get(
  "/",
  authenticate,
  requireOrganizationMode,
  checkPermission({ section: "contracts", action: "read" }),
  asyncHandler(controller.list)
);

router.patch(
  "/:id",
  authenticate,
  requireOrganizationMode,
  checkPermission({ section: "contracts", action: "write" }),
  validateBody(updateContractTypeSchema),
  asyncHandler(controller.update)
);

export default router;
