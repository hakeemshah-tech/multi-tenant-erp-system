/**
 * Shared types for notifications across the application
 */

export interface NotificationMetadata {
  employeeId?: string;
  employeeName?: string;
  fieldChanged?: string;
  fieldLabel?: string;
  oldValue?: unknown;
  newValue?: unknown;
  actorUserId?: string;
  actorName?: string;
  requestId?: string;
  rejectionReason?: string;
}

export interface Notification {
  _id: string;
  tenantId: string;
  branchId: string;
  message: string;
  type:
    | "employee_data_change"
    | "field_change_request"
    | "field_change_approved"
    | "field_change_rejected"
    | "system"
    | "invitation"
    | "other";
  isRead: boolean;
  metadata?: NotificationMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  employeeDataChanges: number;
  fieldChangeRequests: number;
  fieldChangeApproved: number;
  fieldChangeRejected: number;
}

export type NotificationFilter = "unread";
