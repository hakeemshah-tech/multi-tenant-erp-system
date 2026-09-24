import axiosInstance from "@/app/lib/axios";

export interface FieldChangeRequest {
  _id: string;
  employeeId: string;
  tenantId: string;
  branchId: string;
  sectionKey: string;
  fieldKey: string;
  fieldLabel: string;
  innerSectionKey?: string;
  oldValue: any;
  newValue: any;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  requestedBy: {
    _id: string;
    fullName: string;
    email: string;
  };
  reviewedBy?: {
    _id: string;
    fullName: string;
    email: string;
  };
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFieldChangeRequestParams {
  employeeId: string;
  sectionKey: string;
  fieldKey: string;
  fieldLabel: string;
  oldValue: any;
  newValue: any;
}

export interface ApproveRejectParams {
  requestId: string;
  status: "approved" | "rejected";
  rejectionReason?: string;
}

/**
 * Create a field change request
 */
export const createFieldChangeRequest = async (
  params: CreateFieldChangeRequestParams
) => {
  const response = await axiosInstance.post("/field-change-requests", params);
  return response.data;
};

/**
 * Get field change requests for an employee
 */
export const getFieldChangeRequests = async (
  params: {
    employeeId?: string;
    status?: "pending" | "approved" | "rejected";
    limit?: number;
    skip?: number;
  } = {}
) => {
  const response = await axiosInstance.get("/field-change-requests", {
    params,
  });
  return response.data;
};

/**
 * Approve or reject a field change request
 */
export const approveRejectFieldChangeRequest = async (
  params: ApproveRejectParams
) => {
  const { requestId, ...body } = params;
  const response = await axiosInstance.put(
    `/field-change-requests/${requestId}/approve-reject`,
    body
  );
  return response.data;
};

/**
 * Get pending requests count for an employee
 */
export const getPendingRequestsCount = async (employeeId: string) => {
  const response = await axiosInstance.get(
    `/field-change-requests/pending-count/${employeeId}`
  );
  return response.data;
};
