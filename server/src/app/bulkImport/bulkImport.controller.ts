import { Request, Response } from "express";
import { Types } from "mongoose";
import { WithUser } from "@/common/middlewares/authMiddleware";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as bulkImportService from "./bulkImport.service";
import * as templateService from "./template.service";
import { TEMP_UPLOAD_DIR, ensureUploadDir } from "@/config/storage";

// Configure multer for file uploads.
//
// The directory is resolved from the process working directory (see
// config/storage.ts), not from __dirname, because the bundled build collapses
// the module path and a source-relative hop escapes to the filesystem root.
const uploadDir = TEMP_UPLOAD_DIR;
ensureUploadDir(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "bulk-import-" + uniqueSuffix + path.extname(file.originalname));
  },
});

export const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".xlsx" || ext === ".xls") {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files (.xlsx, .xls) are allowed"));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/**
 * @desc Generate Excel template for bulk import
 * @route GET /bulk-import/template
 */
export const generateTemplate = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);

  try {
    const buffer = await templateService.generateEmployeeImportTemplate(
      tenantId,
      branchId
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="employee-import-template.xlsx"`
    );

    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to generate template",
      error: error.message,
    });
  }
};

/**
 * @desc Generate Excel file with 500 dummy records for testing
 * @route GET /bulk-import/dummy-data
 */
export const generateDummyData = async (req: WithUser, res: Response) => {
  try {
    const buffer = await templateService.generateDummyDataExcel();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="500-dummy-employees.xlsx"`
    );

    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to generate dummy data",
      error: error.message,
    });
  }
};

/**
 * @desc Generate Excel file with 1000 dummy records for testing
 * @route GET /bulk-import/dummy-data-1000
 */
export const generateDummyData1000 = async (req: WithUser, res: Response) => {
  try {
    const buffer = await templateService.generateDummyDataExcel1000();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="1000-dummy-employees.xlsx"`
    );

    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to generate dummy data",
      error: error.message,
    });
  }
};

/**
 * @desc Upload and process bulk import file
 * @route POST /bulk-import/upload
 */
export const uploadAndProcess = async (req: WithUser, res: Response) => {
  if (!req.file) {
    return res.status(400).json({
      message: "No file uploaded",
    });
  }

  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const filePath = req.file.path;

  try {
    const result = await bulkImportService.processBulkImport(
      filePath,
      tenantId,
      branchId
    );

    // Clean up uploaded file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({
      message: "Bulk import completed",
      data: result,
    });
  } catch (error: any) {
    // Clean up uploaded file on error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(500).json({
      message: "Failed to process bulk import",
      error: error.message,
    });
  }
};
