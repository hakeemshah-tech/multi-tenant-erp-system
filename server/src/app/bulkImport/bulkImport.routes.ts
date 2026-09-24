import { Router } from "express";
import { authenticate } from "@/common/middlewares/authMiddleware";
import { authorizeRoles } from "@/common/middlewares/authorize-roles.middleware";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import * as bulkImportController from "./bulkImport.controller";

const router = Router();

/**
 * @swagger
 * /bulk-import/template:
 *   get:
 *     summary: Download Excel template for bulk employee import
 *     tags: [BulkImport]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel template file
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  "/template",
  authenticate,
  authorizeRoles("tenant-owner"),
  asyncHandler(bulkImportController.generateTemplate)
);

/**
 * @swagger
 * /bulk-import/dummy-data:
 *   get:
 *     summary: Download Excel file with 500 dummy employee records for testing
 *     tags: [BulkImport]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel file with 500 dummy records
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  "/dummy-data",
  authenticate,
  authorizeRoles("tenant-owner"),
  asyncHandler(bulkImportController.generateDummyData)
);

/**
 * @swagger
 * /bulk-import/dummy-data-1000:
 *   get:
 *     summary: Download Excel file with 1000 dummy employee records for testing
 *     tags: [BulkImport]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel file with 1000 dummy records
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  "/dummy-data-1000",
  authenticate,
  authorizeRoles("tenant-owner"),
  asyncHandler(bulkImportController.generateDummyData1000)
);

/**
 * @swagger
 * /bulk-import/upload:
 *   post:
 *     summary: Upload and process bulk employee import Excel file
 *     tags: [BulkImport]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Bulk import completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: number
 *                     failed:
 *                       type: number
 *                     errors:
 *                       type: array
 */
router.post(
  "/upload",
  authenticate,
  authorizeRoles("tenant-owner"),
  bulkImportController.upload.single("file"),
  asyncHandler(bulkImportController.uploadAndProcess)
);

export default router;
