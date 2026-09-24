import { Router } from "express";
import { previewPropagation, applyPropagation } from "./propagation.controller";
import { authenticate } from "@/common/middlewares/authMiddleware";

const router = Router();

router.post(
  "/employee-profiles/self/preview-propagation",
  authenticate,
  previewPropagation
);
router.post(
  "/employee-profiles/self/apply-propagation",
  authenticate,
  applyPropagation
);

export default router;
