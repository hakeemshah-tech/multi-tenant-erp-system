// import axios from "axios";
import axios from "../lib/axios";

export interface DocumentStatus {
  _id?: string;
  employeeId: string;
  sectionKey: string;
  innerSectionKey?: string;
  fieldKey: string;
  fileId?: string;
  key?: string;
  status: "pendingToApprove" | "approved" | "rejected" | "expired";
  uploadedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  reviewedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  reviewedAt?: string;
  rejectionReason?: string;
  expiryDate?: string;
  issuingDate?: string;
  referenceNumber?: string;
  countryOfIssue?: string;
  metadata?: {
    originalFileName?: string;
    fileSize?: number;
    mimeType?: string;
    uploadDate?: string;
    previousStatus?: string;
    changeReason?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentStatusParams {
  employeeId: string;
  documentType: string;
  documentId: string;
  sectionKey: string;
  fieldKey: string;
  expiryDate?: string;
  metadata?: {
    originalFileName?: string;
    fileSize?: number;
    mimeType?: string;
  };
}

export interface UpdateDocumentStatusParams {
  employeeId: string;
  sectionKey: string;
  innerSectionKey?: string;
  fieldKey: string;
  status: "approved" | "rejected";
  rejectionReason?: string;
}

export interface GetDocumentStatusesParams {
  employeeId?: string;
  status?: string;
  documentType?: string;
  page?: number;
  limit?: number;
}

export interface DocumentStatusResponse {
  documentStatuses: DocumentStatus[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class DocumentStatusService {
  private baseURL = "/documents";

  async createDocumentStatus(
    params: CreateDocumentStatusParams
  ): Promise<DocumentStatus> {
    const response = await axios.post(`${this.baseURL}/upload`, params);
    return response.data.data;
  }

  async updateDocumentStatus(
    params: UpdateDocumentStatusParams
  ): Promise<DocumentStatus> {
    const {
      employeeId,
      sectionKey,
      innerSectionKey,
      fieldKey,
      status,
      rejectionReason,
    } = params;
    const response = await axios.put(`${this.baseURL}/approve`, {
      employeeId,
      sectionKey,
      innerSectionKey,
      fieldKey,
      status,
      rejectionReason,
    });
    return response.data.data;
  }

  async getDocumentStatuses(
    params: GetDocumentStatusesParams = {}
  ): Promise<DocumentStatusResponse> {
    // If we have an employeeId, use the specific pending documents endpoint
    if (params.employeeId) {
      const response = await axios.get(
        `${this.baseURL}/pending/${params.employeeId}`,
        {
          params: { limit: params.limit },
        }
      );
      return {
        documentStatuses: response.data.data,
        total: response.data.data.length,
        page: 1,
        limit: params.limit || 10,
        totalPages: 1,
      };
    }

    // For general queries without employeeId, we might need a different endpoint
    // For now, return empty result
    return {
      documentStatuses: [],
      total: 0,
      page: 1,
      limit: params.limit || 10,
      totalPages: 0,
    };
  }

  async getDocumentStatusById(
    employeeId: string,
    sectionKey: string,
    fieldKey: string
  ): Promise<DocumentStatus> {
    // This endpoint doesn't exist in our backend yet
    // For now, we'll get all pending documents for the employee and filter
    const response = await axios.get(`${this.baseURL}/pending/${employeeId}`);
    const documents = response.data.data;

    // Find the specific document
    const document = documents.find(
      (doc: DocumentStatus) =>
        doc.sectionKey === sectionKey && doc.fieldKey === fieldKey
    );

    if (!document) {
      throw new Error("Document not found");
    }

    return document;
  }

  async getPendingDocumentsCount(): Promise<{ count: number }> {
    const response = await axios.get(`${this.baseURL}/pending-count`);
    return response.data.data;
  }

  async markExpiredDocuments(): Promise<{ modifiedCount: number }> {
    const response = await axios.post(`${this.baseURL}/mark-expired`);
    return response.data.data;
  }
}

export const documentStatusService = new DocumentStatusService();
