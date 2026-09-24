import { Router } from "express";
import {
  uploadDocumentController,
  updateDocumentDatesController,
  updateDocumentStatusController,
  getPendingDocumentsByEmployeeController,
  getPendingDocumentsCountController,
  markExpiredDocumentsController,
} from "./documentManagement.controller";
import {
  testPreExpiryNotificationsController,
  testExpiredDocumentsController,
  testMarkExpiredDocumentsController,
} from "./documentExpiryTest.controller";
import { authenticate } from "../../common/middlewares/authMiddleware";

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Document upload/update routes
router.post("/upload", uploadDocumentController);
router.put("/update-dates", updateDocumentDatesController);

// Document approval routes (typically for employers)
router.put("/approve", updateDocumentStatusController);

// Query routes
router.get("/pending/:employeeId", getPendingDocumentsByEmployeeController);
router.get("/pending-count", getPendingDocumentsCountController);

// Utility routes
router.post("/mark-expired", markExpiredDocumentsController);

// Test routes for document expiry system (for development/testing)
router.post("/test/pre-expiry", testPreExpiryNotificationsController);
router.post("/test/expired", testExpiredDocumentsController);
router.post("/test/mark-expired", testMarkExpiredDocumentsController);

export default router;
