import { Router } from "express";
import { authenticate } from "@/common/middlewares/authMiddleware";
import { authorizeRoles } from "@/common/middlewares/authorize-roles.middleware";
import { requireOrganizationMode } from "@/common/middlewares/require-organization-mode.middleware";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import * as controller from "./contractTemplate.controller";
import { checkPermission } from "@/common/middlewares/checkPermission";

const router = Router();

router.post(
  "/",
  authenticate,
  requireOrganizationMode,
  checkPermission({ section: "contracts", action: "write" }),
  asyncHandler(controller.create)
);

router.get(
  "/",
  authenticate,
  requireOrganizationMode,
  checkPermission({ section: "contracts", action: "read" }),
  asyncHandler(controller.list)
);

router.get(
  "/my-contracts",
  authenticate,
  // Allow all authenticated users (Nexus profiles and employees)
  asyncHandler(controller.getMyContracts)
);

router.post(
  "/:id/accept-reject",
  authenticate,
  // Allow all authenticated users (applicants can accept/reject their contracts)
  asyncHandler(controller.acceptOrRejectContract)
);

router.get(
  "/:id",
  authenticate,
  requireOrganizationMode,
  // No permission check - applicants need to view templates for contracts sent to them
  // Controller handles authorization for admin-only template details
  asyncHandler(controller.get)
);

router.put(
  "/:id",
  authenticate,
  requireOrganizationMode,
  checkPermission({ section: "contracts", action: "write" }),
  asyncHandler(controller.update)
);

router.post(
  "/:id/publish",
  authenticate,
  requireOrganizationMode,
  authorizeRoles("tenant-owner"),
  asyncHandler(controller.publish)
);

router.post(
  "/:id/duplicate",
  authenticate,
  requireOrganizationMode,
  authorizeRoles("tenant-owner"),
  asyncHandler(controller.duplicate)
);

router.get(
  "/:id/export",
  authenticate,
  requireOrganizationMode,
  authorizeRoles("tenant-owner"),
  asyncHandler(controller.exportPdf)
);

router.delete(
  "/:id",
  authenticate,
  requireOrganizationMode,
  checkPermission({ section: "contracts", action: "delete" }),
  asyncHandler(controller.remove)
);

router.post(
  "/:id/send-approval",
  authenticate,
  requireOrganizationMode,
  checkPermission({ section: "contracts", action: "write" }),
  asyncHandler(controller.sendApproval)
);

router.get(
  "/approvals/my-approvals",
  authenticate,
  requireOrganizationMode,
  // Allow employees to view their own approvals
  asyncHandler(controller.getEmployeeApprovals)
);

router.get(
  "/approvals/all",
  authenticate,
  requireOrganizationMode,
  checkPermission({ section: "contracts", action: "read" }),
  asyncHandler(controller.getAllApprovals)
);

// Get single approval by ID (for viewing contract with all signatures)
router.get(
  "/approvals/:approvalId",
  authenticate,
  requireOrganizationMode,
  asyncHandler(controller.getApprovalById)
);

// Sender signs the contract (for selfSignRequired approvals)
router.post(
  "/approvals/:approvalId/sender-sign",
  authenticate,
  requireOrganizationMode,
  asyncHandler(controller.senderSign)
);

router.get(
  "/:id/approvals",
  authenticate,
  requireOrganizationMode,
  // Allow employees to view approvals for contracts where they are applicants
  // Controller checks if user has permission or is the applicant
  asyncHandler(controller.getApprovals)
);

router.post(
  "/:id/send-approval/:employeeId",
  authenticate,
  requireOrganizationMode,
  checkPermission({ section: "contracts", action: "write" }),
  asyncHandler(controller.sendSingleApproval)
);

router.post(
  "/:id/send-approval-all",
  authenticate,
  requireOrganizationMode,
  checkPermission({ section: "contracts", action: "write" }),
  asyncHandler(controller.sendAllApprovals)
);

router.put(
  "/approvals/:approvalId/employee/:employeeId",
  authenticate,
  requireOrganizationMode,
  // Allow both tenant-owners and employees (employees can approve their own)
  asyncHandler(controller.updateApprovalById)
);

router.put(
  "/:id/approval/:employeeId",
  authenticate,
  requireOrganizationMode,
  // Allow both tenant-owners and employees (employees can approve their own)
  asyncHandler(controller.updateApproval)
);

router.post(
  "/:id/send-to-applicant",
  authenticate,
  requireOrganizationMode,
  checkPermission({ section: "contracts", action: "write" }),
  asyncHandler(controller.sendToApplicant)
);

// Self-sign route for employers to sign contracts when no approvers are configured
router.post(
  "/:id/self-sign",
  authenticate,
  requireOrganizationMode,
  checkPermission({ section: "generate-contract", action: "write" }),
  asyncHandler(controller.selfSign)
);

// Public routes (no authentication required)
router.get(
  "/public/contract/:templateId/:applicantId",
  asyncHandler(controller.getPublicContract)
);

router.post(
  "/public/contract/:templateId/:applicantId/generate-otp",
  asyncHandler(controller.generatePublicOTP)
);

router.post(
  "/public/contract/:templateId/:applicantId/accept-reject",
  asyncHandler(controller.publicAcceptOrRejectContract)
);

// Get contract snapshot by approval ID
router.get(
  "/approvals/:approvalId/snapshot",
  authenticate,
  asyncHandler(controller.getSnapshot)
);

// ========== PDF Download and Tamper Detection Routes ==========
import multer from "multer";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

// Download PDF (authenticated)
router.get(
  "/approvals/:approvalId/download-pdf",
  authenticate,
  asyncHandler(controller.downloadSnapshotPdf)
);

// Verify PDF integrity (authenticated)
router.post(
  "/approvals/:approvalId/verify-pdf",
  authenticate,
  upload.single("pdf"),
  asyncHandler(controller.verifyPdfIntegrity)
);

// Download PDF (public)
router.get(
  "/public/contract/:templateId/:applicantId/download-pdf",
  asyncHandler(controller.downloadPublicSnapshotPdf)
);

// Verify PDF integrity (public)
router.post(
  "/public/contract/:templateId/:applicantId/verify-pdf",
  upload.single("pdf"),
  asyncHandler(controller.verifyPublicPdfIntegrity)
);

// Save client-side generated PDF hash (authenticated)
router.post(
  "/approvals/:approvalId/save-pdf-hash",
  authenticate,
  asyncHandler(controller.saveClientPdfHash)
);

// Save client-side generated PDF hash (public)
router.post(
  "/public/contract/:templateId/:applicantId/save-pdf-hash",
  asyncHandler(controller.savePublicClientPdfHash)
);

// Cache PDF and save hash (authenticated)
router.post(
  "/approvals/:approvalId/cache-pdf",
  authenticate,
  upload.single("pdf"),
  asyncHandler(controller.cachePdfAndHash)
);

// Get cached PDF (authenticated)
router.get(
  "/approvals/:approvalId/cached-pdf",
  authenticate,
  asyncHandler(controller.getCachedPdf)
);

// Cache PDF and save hash (public)
router.post(
  "/public/contract/:templateId/:applicantId/cache-pdf",
  upload.single("pdf"),
  asyncHandler(controller.cachePublicPdfAndHash)
);

// Get cached PDF (public)
router.get(
  "/public/contract/:templateId/:applicantId/cached-pdf",
  asyncHandler(controller.getPublicCachedPdf)
);

export default router;
