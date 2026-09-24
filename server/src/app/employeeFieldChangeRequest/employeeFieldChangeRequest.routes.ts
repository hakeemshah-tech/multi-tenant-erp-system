import { Router } from "express";
import { authenticate } from "../../common/middlewares/authMiddleware";
import {
  createFieldChangeRequestController,
  getFieldChangeRequestsController,
  approveRejectFieldChangeRequestController,
  getPendingRequestsCountController,
  cleanupOldRequestsController,
} from "./employeeFieldChangeRequest.controller";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create a new field change request
router.post("/", createFieldChangeRequestController);

// Get field change requests
router.get("/", getFieldChangeRequestsController);

// Approve or reject a field change request
router.put(
  "/:requestId/approve-reject",
  approveRejectFieldChangeRequestController
);

// Get pending requests count for an employee
router.get("/pending-count/:employeeId", getPendingRequestsCountController);

// Cleanup old processed requests (admin only)
router.post("/cleanup", cleanupOldRequestsController);

export default router;
