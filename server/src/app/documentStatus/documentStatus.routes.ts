import { Router } from "express";
import {
  createDocumentStatusController,
  updateDocumentStatusController,
  getDocumentStatusesController,
  getDocumentStatusByIdController,
  getPendingDocumentsCountController,
  markExpiredDocumentsController,
} from "./documentStatus.controller";
import { authenticate } from "@/common/middlewares/authMiddleware";
import { authorizeRoles } from "@/common/middlewares/authorize-roles.middleware";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create document status (when employee uploads document)
router.post("/", createDocumentStatusController);

// Get document statuses with filters
router.get("/", getDocumentStatusesController);

// Get pending documents count
router.get("/pending-count", getPendingDocumentsCountController);

// Get specific document status by employee, section, and field
router.get("/status", getDocumentStatusByIdController);

// Update document status (approve/reject) - only for employers/admins
router.patch(
  "/update",
  // authorizeRoles("tenant-owner"),
  updateDocumentStatusController
);

// Mark expired documents (for cron job)
router.post("/mark-expired", markExpiredDocumentsController);

export default router;
