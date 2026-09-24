import mongoose, { Document, Schema, Types } from "mongoose";

export interface INotification extends Document {
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  targetUserId?: Types.ObjectId; // Who should receive this notification
  message: string;
  type:
    | "employee_data_change"
    | "field_change_request"
    | "field_change_approved"
    | "field_change_rejected"
    | "document_uploaded"
    | "document_updated"
    | "document_approved"
    | "document_rejected"
    | "document_expired"
    | "contract_template_approval"
    | "contract_approved"
    | "contract_resent"
    | "contract_accepted"
    | "contract_rejected"
    | "system"
    | "invitation"
    | "other";
  isRead: boolean;
  metadata?: {
    employeeId?: Types.ObjectId;
    employeeName?: string;
    fieldChanged?: string;
    fieldLabel?: string;
    oldValue?: any;
    newValue?: any;
    actorUserId?: Types.ObjectId;
    actorName?: string;
    requestId?: Types.ObjectId;
    rejectionReason?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "employee_data_change",
        "field_change_request",
        "field_change_approved",
        "field_change_rejected",
        "document_uploaded",
        "document_updated",
        "document_approved",
        "document_rejected",
        "document_expired",
        "contract_template_approval",
        "contract_approved",
        "contract_resent",
        "contract_accepted",
        "contract_rejected",
        "system",
        "invitation",
        "other",
      ],
      default: "employee_data_change",
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      employeeId: { type: Schema.Types.ObjectId, ref: "Employee" },
      employeeName: { type: String },
      fieldChanged: { type: String },
      fieldLabel: { type: String },
      oldValue: { type: Schema.Types.Mixed },
      newValue: { type: Schema.Types.Mixed },
      actorUserId: { type: Schema.Types.ObjectId, ref: "User" },
      actorName: { type: String },
      requestId: {
        type: Schema.Types.ObjectId,
        ref: "EmployeeFieldChangeRequest",
      },
      rejectionReason: { type: String },
      documentType: { type: String },
      sectionKey: { type: String },
      fieldKey: { type: String },
      innerSectionKey: { type: String },
      documentStatusId: { type: Schema.Types.ObjectId, ref: "DocumentStatus" },
      documentId: { type: String }, // fileId
      previousStatus: { type: String },
      newStatus: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient querying
notificationSchema.index({ tenantId: 1, branchId: 1, isRead: 1 });
notificationSchema.index({ tenantId: 1, branchId: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ targetUserId: 1, isRead: 1 });
notificationSchema.index({ targetUserId: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>(
  "Notification",
  notificationSchema
);
