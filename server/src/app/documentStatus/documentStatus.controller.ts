import { Request, Response } from "express";
import { DocumentStatusService } from "../../services/documentStatus.service";
import { asyncHandler } from "@/common/middlewares/asyncHandler";

const documentStatusService = new DocumentStatusService();

export const createDocumentStatusController = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      employeeId,
      documentType,
      documentId,
      sectionKey,
      fieldKey,
      expiryDate,
      metadata,
    } = req.body;

    const userId = (req as any).user?.id;
    const tenantId = (req as any).user?.tenantId;
    const branchId = (req as any).user?.branchId;

    if (!userId || !tenantId || !branchId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const documentStatus = await documentStatusService.createDocumentStatus({
      employeeId,
      documentType,
      documentId,
      sectionKey,
      fieldKey,
      uploadedBy: userId,
      tenantId,
      branchId,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      metadata,
    });

    res.status(201).json({
      success: true,
      message: "Document status created successfully",
      data: documentStatus,
    });
  }
);

export const updateDocumentStatusController = asyncHandler(
  async (req: Request, res: Response) => {
    const { status, rejectionReason, employeeId, sectionKey, fieldKey } =
      req.body;

    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    if (!employeeId || !sectionKey || !fieldKey) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: employeeId, sectionKey, fieldKey",
      });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'approved' or 'rejected'",
      });
    }

    if (status === "rejected" && !rejectionReason?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required when rejecting a document",
      });
    }

    const documentStatus = await documentStatusService.updateDocumentStatus({
      employeeId,
      sectionKey,
      fieldKey,
      status,
      reviewedBy: userId,
      rejectionReason: status === "rejected" ? rejectionReason : undefined,
    });

    res.status(200).json({
      success: true,
      message: `Document ${status} successfully`,
      data: documentStatus,
    });
  }
);

export const getDocumentStatusesController = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      employeeId,
      status,
      documentType,
      page = 1,
      limit = 10,
    } = req.query;

    const tenantId = (req as any).user?.tenantId;
    const branchId = (req as any).user?.branchId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const result = await documentStatusService.getDocumentStatuses({
      employeeId: employeeId as string,
      tenantId,
      branchId: branchId as string,
      status: status as string,
      documentType: documentType as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });

    res.status(200).json({
      success: true,
      message: "Document statuses retrieved successfully",
      data: result,
    });
  }
);

export const getDocumentStatusByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const { employeeId, sectionKey, fieldKey } = req.query;

    if (!employeeId || !sectionKey || !fieldKey) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required parameters: employeeId, sectionKey, fieldKey",
      });
    }

    const documentStatus = await documentStatusService.getDocumentStatusById(
      employeeId as string,
      sectionKey as string,
      fieldKey as string
    );

    if (!documentStatus) {
      return res.status(404).json({
        success: false,
        message: "Document status not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Document status retrieved successfully",
      data: documentStatus,
    });
  }
);

export const getPendingDocumentsCountController = asyncHandler(
  async (req: Request, res: Response) => {
    const tenantId = (req as any).user?.tenantId;
    const branchId = (req as any).user?.branchId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const count = await documentStatusService.getPendingDocumentsCount(
      tenantId,
      branchId
    );

    res.status(200).json({
      success: true,
      message: "Pending documents count retrieved successfully",
      data: { count },
    });
  }
);

export const markExpiredDocumentsController = asyncHandler(
  async (req: Request, res: Response) => {
    const modifiedCount = await documentStatusService.markExpiredDocuments();

    res.status(200).json({
      success: true,
      message: "Expired documents marked successfully",
      data: { modifiedCount },
    });
  }
);
