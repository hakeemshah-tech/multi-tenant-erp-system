import {
  DocumentHistoryModel,
  IDocumentHistory,
} from "../database/models/DocumentHistory";
import mongoose from "mongoose";

export interface CreateDocumentHistoryParams {
  documentId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  sectionKey: string;
  innerSectionKey?: string;
  fieldKey: string;
  fileName: string;
  fileId: mongoose.Types.ObjectId;
  fileSize: number;
  mimeType: string;
  issuingDate?: Date;
  expiryDate?: Date;
  status: "uploaded" | "updated" | "approved" | "rejected" | "expired";
  previousStatus?: string;
  rejectionReason?: string;
  changeType:
    "upload" | "date_update" | "status_change" | "rejection" | "approval";
  changeDescription: string;
  actorId: mongoose.Types.ObjectId;
  actorType: "employee" | "employer" | "system";
  actorName: string;
  actorEmail: string;
  metadata?: {
    originalFileName?: string;
    previousIssuingDate?: Date;
    previousExpiryDate?: Date;
    previousFileId?: mongoose.Types.ObjectId;
    ipAddress?: string;
    userAgent?: string;
  };
}

export interface DocumentHistoryFilters {
  documentId?: mongoose.Types.ObjectId;
  employeeId?: mongoose.Types.ObjectId;
  tenantId?: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  sectionKey?: string;
  fieldKey?: string;
  changeType?: string;
  status?: string;
  actorType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface DocumentHistoryResponse {
  histories: IDocumentHistory[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

class DocumentHistoryService {
  /**
   * Create a new document history entry
   */
  async createDocumentHistory(
    params: CreateDocumentHistoryParams
  ): Promise<IDocumentHistory> {
    try {
      const history = new DocumentHistoryModel(params);
      return await history.save();
    } catch (error) {
      console.error("Error creating document history:", error);
      throw new Error("Failed to create document history");
    }
  }

  /**
   * Get document history with pagination and filtering
   */
  async getDocumentHistory(
    filters: DocumentHistoryFilters,
    pagination: PaginationOptions
  ): Promise<DocumentHistoryResponse> {
    try {
      const {
        page,
        limit,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = pagination;
      const skip = (page - 1) * limit;

      // Build query
      const query: any = {};

      if (filters.documentId) query.documentId = filters.documentId;
      if (filters.employeeId) query.employeeId = filters.employeeId;
      if (filters.tenantId) query.tenantId = filters.tenantId;
      if (filters.branchId) query.branchId = filters.branchId;
      if (filters.sectionKey) query.sectionKey = filters.sectionKey;
      if (filters.fieldKey) query.fieldKey = filters.fieldKey;
      if (filters.changeType) query.changeType = filters.changeType;
      if (filters.status) query.status = filters.status;
      if (filters.actorType) query.actorType = filters.actorType;

      // Date range filter
      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) query.createdAt.$gte = filters.dateFrom;
        if (filters.dateTo) query.createdAt.$lte = filters.dateTo;
      }

      // Text search
      if (filters.search) {
        query.$text = { $search: filters.search };
      }

      // Execute query with pagination
      const [histories, totalItems] = await Promise.all([
        DocumentHistoryModel.find(query)
          .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        DocumentHistoryModel.countDocuments(query),
      ]);

      const totalPages = Math.ceil(totalItems / limit);

      return {
        histories: histories as IDocumentHistory[],
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      console.error("Error fetching document history:", error);
      throw new Error("Failed to fetch document history");
    }
  }

  /**
   * Get history for a specific document
   */
  async getDocumentHistoryById(
    documentId: mongoose.Types.ObjectId
  ): Promise<IDocumentHistory[]> {
    try {
      return await DocumentHistoryModel.find({ documentId })
        .sort({ createdAt: -1 })
        .lean();
    } catch (error) {
      console.error("Error fetching document history by ID:", error);
      throw new Error("Failed to fetch document history");
    }
  }

  /**
   * Get history for a specific employee's document field
   */
  async getEmployeeDocumentHistory(
    employeeId: mongoose.Types.ObjectId,
    sectionKey: string,
    fieldKey: string,
    innerSectionKey?: string
  ): Promise<IDocumentHistory[]> {
    try {
      const query: any = {
        employeeId,
        sectionKey,
        fieldKey,
      };

      if (innerSectionKey) {
        query.innerSectionKey = innerSectionKey;
      }

      return await DocumentHistoryModel.find(query)
        .sort({ createdAt: -1 })
        .lean();
    } catch (error) {
      console.error("Error fetching employee document history:", error);
      throw new Error("Failed to fetch employee document history");
    }
  }

  /**
   * Get document history statistics
   */
  async getDocumentHistoryStats(
    employeeId?: mongoose.Types.ObjectId,
    tenantId?: mongoose.Types.ObjectId,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<any> {
    try {
      const matchQuery: any = {};

      if (employeeId) matchQuery.employeeId = employeeId;
      if (tenantId) matchQuery.tenantId = tenantId;

      if (dateFrom || dateTo) {
        matchQuery.createdAt = {};
        if (dateFrom) matchQuery.createdAt.$gte = dateFrom;
        if (dateTo) matchQuery.createdAt.$lte = dateTo;
      }

      const stats = await DocumentHistoryModel.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalChanges: { $sum: 1 },
            uploads: {
              $sum: { $cond: [{ $eq: ["$changeType", "upload"] }, 1, 0] },
            },
            dateUpdates: {
              $sum: { $cond: [{ $eq: ["$changeType", "date_update"] }, 1, 0] },
            },
            approvals: {
              $sum: { $cond: [{ $eq: ["$changeType", "approval"] }, 1, 0] },
            },
            rejections: {
              $sum: { $cond: [{ $eq: ["$changeType", "rejection"] }, 1, 0] },
            },
            statusChanges: {
              $sum: {
                $cond: [{ $eq: ["$changeType", "status_change"] }, 1, 0],
              },
            },
          },
        },
      ]);

      return (
        stats[0] || {
          totalChanges: 0,
          uploads: 0,
          dateUpdates: 0,
          approvals: 0,
          rejections: 0,
          statusChanges: 0,
        }
      );
    } catch (error) {
      console.error("Error fetching document history stats:", error);
      throw new Error("Failed to fetch document history statistics");
    }
  }

  /**
   * Clean up old document history entries (for maintenance)
   */
  async cleanupOldHistory(olderThanDays: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await DocumentHistoryModel.deleteMany({
        createdAt: { $lt: cutoffDate },
      });

      return result.deletedCount || 0;
    } catch (error) {
      console.error("Error cleaning up old document history:", error);
      throw new Error("Failed to cleanup old document history");
    }
  }

  /**
   * Get recent document changes for dashboard
   */
  async getRecentDocumentChanges(
    tenantId: mongoose.Types.ObjectId,
    limit: number = 10
  ): Promise<IDocumentHistory[]> {
    try {
      return await DocumentHistoryModel.find({ tenantId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("employeeId", "fullName email")
        .populate("actorId", "fullName email")
        .lean();
    } catch (error) {
      console.error("Error fetching recent document changes:", error);
      throw new Error("Failed to fetch recent document changes");
    }
  }

  /**
   * Helper method to create history entry for document upload
   */
  async createUploadHistory(
    documentId: mongoose.Types.ObjectId,
    employeeId: mongoose.Types.ObjectId,
    tenantId: mongoose.Types.ObjectId,
    branchId: mongoose.Types.ObjectId,
    sectionKey: string,
    fieldKey: string,
    innerSectionKey: string | undefined,
    fileName: string,
    fileId: mongoose.Types.ObjectId,
    fileSize: number,
    mimeType: string,
    issuingDate: Date | undefined,
    expiryDate: Date | undefined,
    actorId: mongoose.Types.ObjectId,
    actorType: "employee" | "employer",
    actorName: string,
    actorEmail: string,
    metadata?: any
  ): Promise<IDocumentHistory> {
    const changeDescription =
      actorType === "employee"
        ? `Document uploaded by employee and sent for approval`
        : `Document uploaded by employer and approved`;

    return this.createDocumentHistory({
      documentId,
      employeeId,
      tenantId,
      branchId,
      sectionKey,
      innerSectionKey,
      fieldKey,
      fileName,
      fileId,
      fileSize,
      mimeType,
      issuingDate,
      expiryDate,
      status: actorType === "employee" ? "pendingToApprove" : "approved",
      changeType: "upload",
      changeDescription,
      actorId,
      actorType,
      actorName,
      actorEmail,
      metadata,
    });
  }

  /**
   * Helper method to create history entry for date update
   */
  async createDateUpdateHistory(
    documentId: mongoose.Types.ObjectId,
    employeeId: mongoose.Types.ObjectId,
    tenantId: mongoose.Types.ObjectId,
    branchId: mongoose.Types.ObjectId,
    sectionKey: string,
    fieldKey: string,
    innerSectionKey: string | undefined,
    fileName: string,
    fileId: mongoose.Types.ObjectId,
    fileSize: number,
    mimeType: string,
    issuingDate: Date | undefined,
    expiryDate: Date | undefined,
    previousIssuingDate: Date | undefined,
    previousExpiryDate: Date | undefined,
    actorId: mongoose.Types.ObjectId,
    actorType: "employee" | "employer",
    actorName: string,
    actorEmail: string,
    metadata?: any
  ): Promise<IDocumentHistory> {
    const changeDescription =
      actorType === "employee"
        ? `Document dates updated by employee and sent for approval`
        : `Document dates updated by employer and approved`;

    return this.createDocumentHistory({
      documentId,
      employeeId,
      tenantId,
      branchId,
      sectionKey,
      innerSectionKey,
      fieldKey,
      fileName,
      fileId,
      fileSize,
      mimeType,
      issuingDate,
      expiryDate,
      status: actorType === "employee" ? "pendingToApprove" : "approved",
      changeType: "date_update",
      changeDescription,
      actorId,
      actorType,
      actorName,
      actorEmail,
      metadata: {
        ...metadata,
        previousIssuingDate,
        previousExpiryDate,
      },
    });
  }

  /**
   * Helper method to create history entry for status change
   */
  async createStatusChangeHistory(
    documentId: mongoose.Types.ObjectId,
    employeeId: mongoose.Types.ObjectId,
    tenantId: mongoose.Types.ObjectId,
    branchId: mongoose.Types.ObjectId,
    sectionKey: string,
    fieldKey: string,
    innerSectionKey: string | undefined,
    fileName: string,
    fileId: mongoose.Types.ObjectId,
    fileSize: number,
    mimeType: string,
    issuingDate: Date | undefined,
    expiryDate: Date | undefined,
    status:
      | "uploaded"
      | "updated"
      | "approved"
      | "rejected"
      | "expired"
      | "pendingToApprove",
    previousStatus: string,
    changeType: "approval" | "rejection" | "status_change",
    rejectionReason: string | undefined,
    actorId: mongoose.Types.ObjectId,
    actorType: "employee" | "employer" | "system",
    actorName: string,
    actorEmail: string,
    metadata?: any
  ): Promise<IDocumentHistory> {
    let changeDescription = "";

    switch (changeType) {
      case "approval":
        changeDescription = `Document approved by ${actorType}`;
        break;
      case "rejection":
        changeDescription = `Document rejected by ${actorType}${
          rejectionReason ? `: ${rejectionReason}` : ""
        }`;
        break;
      case "status_change":
        changeDescription = `Document status changed from ${previousStatus} to ${status}`;
        break;
    }

    return this.createDocumentHistory({
      documentId,
      employeeId,
      tenantId,
      branchId,
      sectionKey,
      innerSectionKey,
      fieldKey,
      fileName,
      fileId,
      fileSize,
      mimeType,
      issuingDate,
      expiryDate,
      status,
      previousStatus,
      rejectionReason,
      changeType,
      changeDescription,
      actorId,
      actorType,
      actorName,
      actorEmail,
      metadata,
    });
  }

  /**
   * Get current document status from the employee record
   */
  async getCurrentDocumentStatus(
    employeeId: mongoose.Types.ObjectId,
    sectionKey: string,
    fieldKey: string,
    innerSectionKey?: string
  ): Promise<{
    status: string;
    fileId?: string;
    reviewedBy?:
      string | { firstName: string; lastName: string; email: string };
    reviewedAt?: Date;
    rejectionReason?: string;
  } | null> {
    try {
      console.log(`🔍 [DEBUG] getCurrentDocumentStatus called:`, {
        employeeId: employeeId.toString(),
        sectionKey,
        fieldKey,
        innerSectionKey,
      });

      const EmployeeModel = (await import("../database/models/employee.model"))
        .default;

      const employee = await EmployeeModel.findById(employeeId);
      if (!employee) {
        console.log(`❌ [DEBUG] Employee not found: ${employeeId}`);
        return null;
      }

      console.log(`✅ [DEBUG] Employee found. Checking document location...`);

      let documentData: any = null;

      // Check if this is an additional field first
      const additionalField = employee.employeeFields?.additionalFields?.find(
        (field: any) =>
          field.sectionKey === sectionKey &&
          field.fieldKey === fieldKey &&
          (field.innerSectionKey || null) === (innerSectionKey || null)
      );

      console.log(
        `🔍 [DEBUG] Additional field search result:`,
        additionalField ? "FOUND" : "NOT FOUND"
      );

      if (additionalField?.value) {
        // This is an additional field
        documentData = additionalField.value;
        console.log(`✅ [DEBUG] Found additional field data:`, {
          status: documentData.status,
          reviewedBy: documentData.reviewedBy,
          reviewedAt: documentData.reviewedAt,
        });
      } else if (sectionKey === "documents" && innerSectionKey) {
        // For regular documents section, check the specific inner section
        console.log(
          `🔍 [DEBUG] Checking regular document: employeeFields.documents.${innerSectionKey}.${fieldKey}`
        );
        documentData =
          employee.employeeFields?.documents?.[innerSectionKey]?.[fieldKey];
        console.log(
          `🔍 [DEBUG] Regular document data:`,
          documentData
            ? {
                status: documentData.status,
                reviewedBy: documentData.reviewedBy,
                reviewedAt: documentData.reviewedAt,
              }
            : "NOT FOUND"
        );
      } else {
        // For other sections
        console.log(
          `🔍 [DEBUG] Checking other section: employeeFields.${sectionKey}.${fieldKey}`
        );
        documentData = employee.employeeFields?.[sectionKey]?.[fieldKey];
        console.log(
          `🔍 [DEBUG] Other section data:`,
          documentData
            ? {
                status: documentData.status,
                reviewedBy: documentData.reviewedBy,
                reviewedAt: documentData.reviewedAt,
              }
            : "NOT FOUND"
        );
      }

      if (!documentData || !documentData.status) {
        console.log(`❌ [DEBUG] No document data or status found`);
        return null;
      }

      // Populate reviewedBy with user details if it exists
      let reviewedByData:
        | { firstName: string; lastName: string; email: string }
        | string
        | undefined;

      if (documentData.reviewedBy) {
        try {
          const { User } = await import("../database/models/user.model");
          const reviewedByUser = await User.findById(documentData.reviewedBy);
          if (reviewedByUser) {
            const nameParts = reviewedByUser.fullName?.split(" ") || [];
            reviewedByData = {
              firstName: nameParts[0] || "",
              lastName: nameParts.slice(1).join(" ") || "",
              email: reviewedByUser.email || "",
            };
          } else {
            reviewedByData = documentData.reviewedBy?.toString();
          }
        } catch (error) {
          console.error("Error fetching reviewedBy user:", error);
          reviewedByData = documentData.reviewedBy?.toString();
        }
      }

      const result = {
        status: documentData.status,
        fileId: documentData.fileId?.toString(),
        reviewedBy: reviewedByData,
        reviewedAt: documentData.reviewedAt,
        rejectionReason: documentData.rejectionReason,
      };

      console.log(`✅ [DEBUG] Returning current status:`, result);
      return result;
    } catch (error) {
      console.error("❌ Error fetching current document status:", error);
      return null;
    }
  }
}

export const documentHistoryService = new DocumentHistoryService();
