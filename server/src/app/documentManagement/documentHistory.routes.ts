import { Router } from "express";
import {
  getDocumentHistory,
  getEmployeeDocumentHistory,
  getDocumentHistoryWithFilters,
  getDocumentHistoryStats,
  getRecentDocumentChanges,
  cleanupOldDocumentHistory,
} from "./documentHistory.controller";
import { authenticate } from "../../common/middlewares/authMiddleware";
import { authorizeRoles } from "../../common/middlewares/authorize-roles.middleware";

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @swagger
 * /api/document-history/{documentId}:
 *   get:
 *     summary: Get document history for a specific document
 *     tags: [Document History]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Document history retrieved successfully
 *       400:
 *         description: Invalid document ID
 *       500:
 *         description: Internal server error
 */
router.get("/:documentId", getDocumentHistory);

/**
 * @swagger
 * /api/document-history/employee/{employeeId}/{sectionKey}/{fieldKey}:
 *   get:
 *     summary: Get document history for a specific employee's document field
 *     tags: [Document History]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee ID
 *       - in: path
 *         name: sectionKey
 *         required: true
 *         schema:
 *           type: string
 *         description: Section key
 *       - in: path
 *         name: fieldKey
 *         required: true
 *         schema:
 *           type: string
 *         description: Field key
 *       - in: query
 *         name: innerSectionKey
 *         schema:
 *           type: string
 *         description: Inner section key (optional)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Employee document history retrieved successfully
 *       400:
 *         description: Invalid employee ID
 *       500:
 *         description: Internal server error
 */
router.get(
  "/employee/:employeeId/:sectionKey/:fieldKey",
  getEmployeeDocumentHistory
);

/**
 * @swagger
 * /api/document-history/filters:
 *   get:
 *     summary: Get document history with advanced filtering
 *     tags: [Document History]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: employeeId
 *         schema:
 *           type: string
 *         description: Employee ID
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         description: Tenant ID
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *         description: Branch ID
 *       - in: query
 *         name: sectionKey
 *         schema:
 *           type: string
 *         description: Section key
 *       - in: query
 *         name: fieldKey
 *         schema:
 *           type: string
 *         description: Field key
 *       - in: query
 *         name: changeType
 *         schema:
 *           type: string
 *           enum: [upload, date_update, status_change, rejection, approval]
 *         description: Change type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [uploaded, updated, approved, rejected, expired]
 *         description: Document status
 *       - in: query
 *         name: actorType
 *         schema:
 *           type: string
 *           enum: [employee, employer, system]
 *         description: Actor type
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Text search
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Filtered document history retrieved successfully
 *       500:
 *         description: Internal server error
 */
router.get("/filters", getDocumentHistoryWithFilters);

/**
 * @swagger
 * /api/document-history/stats:
 *   get:
 *     summary: Get document history statistics
 *     tags: [Document History]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: employeeId
 *         schema:
 *           type: string
 *         description: Employee ID
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         description: Tenant ID
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter
 *     responses:
 *       200:
 *         description: Document history statistics retrieved successfully
 *       500:
 *         description: Internal server error
 */
router.get("/stats", getDocumentHistoryStats);

/**
 * @swagger
 * /api/document-history/recent/{tenantId}:
 *   get:
 *     summary: Get recent document changes for dashboard
 *     tags: [Document History]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of recent changes to retrieve
 *     responses:
 *       200:
 *         description: Recent document changes retrieved successfully
 *       400:
 *         description: Invalid tenant ID
 *       500:
 *         description: Internal server error
 */
router.get("/recent/:tenantId", getRecentDocumentChanges);

/**
 * @swagger
 * /api/document-history/cleanup:
 *   post:
 *     summary: Clean up old document history entries (admin only)
 *     tags: [Document History]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               olderThanDays:
 *                 type: integer
 *                 default: 365
 *                 description: Number of days to keep history entries
 *     responses:
 *       200:
 *         description: Old document history entries cleaned up successfully
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Internal server error
 */
router.post("/cleanup", authorizeRoles("admin"), cleanupOldDocumentHistory);

export default router;
