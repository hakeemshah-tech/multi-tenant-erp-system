import axiosInstance from "@/app/lib/axios";

export interface CreatePendingDocumentParams {
  employeeId: string;
  sectionKey: string;
  innerSectionKey?: string;
  fieldKey: string;
  fileId: string;
  key: string;
  expiryDate?: string;
  issuingDate?: string;
  referenceNumber?: string;
  countryOfIssue?: string;
  metadata: {
    originalFileName: string;
    fileSize: number;
    mimeType: string;
  };
}

export interface UpdatePendingDocumentStatusParams {
  employeeId: string;
  sectionKey: string;
  innerSectionKey?: string;
  fieldKey: string;
  status: "approved" | "rejected";
  rejectionReason?: string;
}

export interface PendingDocumentInfo {
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

export const createPendingDocument = async (
  params: CreatePendingDocumentParams
): Promise<PendingDocumentInfo> => {
  const response = await axiosInstance.post("/documents/upload", params);
  return response.data.data;
};

export const updatePendingDocumentStatus = async (
  params: UpdatePendingDocumentStatusParams
): Promise<PendingDocumentInfo> => {
  const response = await axiosInstance.put("/documents/approve", params);
  return response.data.data;
};

export const getPendingDocumentsByEmployee = async (
  employeeId: string
): Promise<PendingDocumentInfo[]> => {
  const response = await axiosInstance.get(`/documents/pending/${employeeId}`);
  return response.data.data;
};

export const getPendingDocumentsCount = async (): Promise<{
  count: number;
}> => {
  const response = await axiosInstance.get("/documents/pending-count");
  return response.data.data;
};
