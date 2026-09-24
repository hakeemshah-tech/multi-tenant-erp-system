import axiosInstance from "@/app/lib/axios";

export interface DocumentUploadParams {
  employeeId: string;
  sectionKey: string;
  innerSectionKey?: string;
  fieldKey: string;
  fileId: string;
  key: string;
  expiryDate?: string;
  issuingDate?: string;
  metadata: {
    originalFileName: string;
    fileSize: number;
    mimeType: string;
  };
}

export interface DocumentDatesUpdateParams {
  employeeId: string;
  sectionKey: string;
  innerSectionKey?: string;
  fieldKey: string;
  expiryDate?: string;
  issuingDate?: string;
}

export interface DocumentApprovalParams {
  employeeId: string;
  sectionKey: string;
  innerSectionKey?: string;
  fieldKey: string;
  status: "approved" | "rejected";
  rejectionReason?: string;
}

export interface DocumentInfo {
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

/**
 * Upload a document (new or update existing)
 * This will mark the document as "pendingToApprove"
 */
export const uploadDocument = async (
  params: DocumentUploadParams
): Promise<DocumentInfo> => {
  const response = await axiosInstance.post("/documents/upload", params);
  return response.data.data;
};

/**
 * Update document expiry or issue date
 * This will mark the document as "pendingToApprove"
 */
export const updateDocumentDates = async (
  params: DocumentDatesUpdateParams
): Promise<DocumentInfo> => {
  const response = await axiosInstance.put("/documents/update-dates", params);
  return response.data.data;
};

/**
 * Approve or reject a document
 */
export const updateDocumentStatus = async (
  params: DocumentApprovalParams
): Promise<DocumentInfo> => {
  const response = await axiosInstance.put("/documents/approve", params);
  return response.data.data;
};

/**
 * Get all pending documents for an employee
 */
export const getPendingDocumentsByEmployee = async (
  employeeId: string
): Promise<DocumentInfo[]> => {
  const response = await axiosInstance.get(`/documents/pending/${employeeId}`);
  return response.data.data;
};

/**
 * Get count of pending documents
 */
export const getPendingDocumentsCount = async (): Promise<{
  count: number;
}> => {
  const response = await axiosInstance.get("/documents/pending-count");
  return response.data.data;
};

/**
 * Mark expired documents
 */
export const markExpiredDocuments = async (): Promise<{
  modifiedCount: number;
}> => {
  const response = await axiosInstance.post("/documents/mark-expired");
  return response.data.data;
};

// Legacy compatibility - keeping old function names for backward compatibility
export const createPendingDocument = uploadDocument;
export const updatePendingDocumentStatus = updateDocumentStatus;
