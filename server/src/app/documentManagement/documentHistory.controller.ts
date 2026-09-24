import { Request, Response } from "express";
import { documentHistoryService } from "../../services/documentHistory.service";
import mongoose from "mongoose";
import { asyncHandler } from "../../common/middlewares/asyncHandler";

/**
 * Get document history for a specific document
 */
export const getDocumentHistory = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { documentId } = req.params;
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      if (!mongoose.Types.ObjectId.isValid(documentId)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }

      const filters = {
        documentId: new mongoose.Types.ObjectId(documentId),
      };

      const pagination = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        sortBy: sortBy as string,
        sortOrder: sortOrder as "asc" | "desc",
      };

      const result = await documentHistoryService.getDocumentHistory(
        filters,
        pagination
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Error fetching document history:", error);
      res.status(500).json({ error: "Failed to fetch document history" });
    }
  }
);

/**
 * Get document history for a specific employee's document field
 */
export const getEmployeeDocumentHistory = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { employeeId, sectionKey, fieldKey } = req.params;
      const {
        innerSectionKey,
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      if (!mongoose.Types.ObjectId.isValid(employeeId)) {
        return res.status(400).json({ error: "Invalid employee ID" });
      }

      const [histories, currentDocumentStatus] = await Promise.all([
        documentHistoryService.getEmployeeDocumentHistory(
          new mongoose.Types.ObjectId(employeeId),
          sectionKey,
          fieldKey,
          innerSectionKey as string | undefined
        ),
        documentHistoryService.getCurrentDocumentStatus(
          new mongoose.Types.ObjectId(employeeId),
          sectionKey,
          fieldKey,
          innerSectionKey as string | undefined
        ),
      ]);

      res.json({
        success: true,
        histories: histories,
        currentStatus: currentDocumentStatus,
      });
    } catch (error) {
      console.error("Error fetching employee document history:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch employee document history" });
    }
  }
);

/**
 * Get document history with advanced filtering
 */
export const getDocumentHistoryWithFilters = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const {
        employeeId,
        tenantId,
        branchId,
        sectionKey,
        fieldKey,
        changeType,
        status,
        actorType,
        dateFrom,
        dateTo,
        search,
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const filters: any = {};

      if (employeeId && mongoose.Types.ObjectId.isValid(employeeId as string)) {
        filters.employeeId = new mongoose.Types.ObjectId(employeeId as string);
      }
      if (tenantId && mongoose.Types.ObjectId.isValid(tenantId as string)) {
        filters.tenantId = new mongoose.Types.ObjectId(tenantId as string);
      }
      if (branchId && mongoose.Types.ObjectId.isValid(branchId as string)) {
        filters.branchId = new mongoose.Types.ObjectId(branchId as string);
      }
      if (sectionKey) filters.sectionKey = sectionKey;
      if (fieldKey) filters.fieldKey = fieldKey;
      if (changeType) filters.changeType = changeType;
      if (status) filters.status = status;
      if (actorType) filters.actorType = actorType;
      if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
      if (dateTo) filters.dateTo = new Date(dateTo as string);
      if (search) filters.search = search;

      const pagination = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        sortBy: sortBy as string,
        sortOrder: sortOrder as "asc" | "desc",
      };

      const result = await documentHistoryService.getDocumentHistory(
        filters,
        pagination
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Error fetching document history with filters:", error);
      res.status(500).json({ error: "Failed to fetch document history" });
    }
  }
);

/**
 * Get document history statistics
 */
export const getDocumentHistoryStats = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { employeeId, tenantId, dateFrom, dateTo } = req.query;

      const filters: any = {};

      if (employeeId && mongoose.Types.ObjectId.isValid(employeeId as string)) {
        filters.employeeId = new mongoose.Types.ObjectId(employeeId as string);
      }
      if (tenantId && mongoose.Types.ObjectId.isValid(tenantId as string)) {
        filters.tenantId = new mongoose.Types.ObjectId(tenantId as string);
      }
      if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
      if (dateTo) filters.dateTo = new Date(dateTo as string);

      const stats = await documentHistoryService.getDocumentHistoryStats(
        filters.employeeId,
        filters.tenantId,
        filters.dateFrom,
        filters.dateTo
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Error fetching document history stats:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch document history statistics" });
    }
  }
);

/**
 * Get recent document changes for dashboard
 */
export const getRecentDocumentChanges = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      const { limit = 10 } = req.query;

      if (!mongoose.Types.ObjectId.isValid(tenantId)) {
        return res.status(400).json({ error: "Invalid tenant ID" });
      }

      const changes = await documentHistoryService.getRecentDocumentChanges(
        new mongoose.Types.ObjectId(tenantId),
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: changes,
      });
    } catch (error) {
      console.error("Error fetching recent document changes:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch recent document changes" });
    }
  }
);

/**
 * Clean up old document history entries (admin only)
 */
export const cleanupOldDocumentHistory = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { olderThanDays = 365 } = req.body;

      const deletedCount = await documentHistoryService.cleanupOldHistory(
        parseInt(olderThanDays)
      );

      res.json({
        success: true,
        message: `Cleaned up ${deletedCount} old document history entries`,
        deletedCount,
      });
    } catch (error) {
      console.error("Error cleaning up old document history:", error);
      res.status(500).json({ error: "Failed to cleanup old document history" });
    }
  }
);
