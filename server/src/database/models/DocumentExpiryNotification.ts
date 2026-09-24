import mongoose, { Schema } from "mongoose";

export interface IDocumentExpiryNotification {
  _id: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  documentId: string; // fileId
  sectionKey: string;
  fieldKey: string;
  innerSectionKey?: string;
  expiryDate: Date;
  notificationType: "pre_expiry" | "expired";
  notificationDate: Date;
  sentTo: {
    employee: boolean;
    employer: boolean;
  };
  emailStatus: "pending" | "sent" | "failed" | "retry";
  retryCount: number;
  lastRetryAt?: Date;
  errorMessage?: string;
  tenantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentExpiryNotificationSchema =
  new Schema<IDocumentExpiryNotification>(
    {
      employeeId: {
        type: Schema.Types.ObjectId,
        ref: "Employee",
        required: true,
        index: true,
      },
      documentId: {
        type: String,
        required: true,
        index: true,
      },
      sectionKey: {
        type: String,
        required: true,
      },
      fieldKey: {
        type: String,
        required: true,
      },
      innerSectionKey: {
        type: String,
      },
      expiryDate: {
        type: Date,
        required: true,
        index: true,
      },
      notificationType: {
        type: String,
        enum: ["pre_expiry", "expired"],
        required: true,
        index: true,
      },
      notificationDate: {
        type: Date,
        required: true,
        index: true,
      },
      sentTo: {
        employee: {
          type: Boolean,
          default: false,
        },
        employer: {
          type: Boolean,
          default: false,
        },
      },
      emailStatus: {
        type: String,
        enum: ["pending", "sent", "failed", "retry"],
        default: "pending",
        index: true,
      },
      retryCount: {
        type: Number,
        default: 0,
      },
      lastRetryAt: {
        type: Date,
      },
      errorMessage: {
        type: String,
      },
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
    },
    {
      timestamps: true,
    }
  );

// Compound indexes for better query performance
DocumentExpiryNotificationSchema.index({
  notificationDate: 1,
  emailStatus: 1,
});

DocumentExpiryNotificationSchema.index({
  employeeId: 1,
  expiryDate: 1,
});

DocumentExpiryNotificationSchema.index({
  tenantId: 1,
  branchId: 1,
});

DocumentExpiryNotificationSchema.index({
  documentId: 1,
  notificationType: 1,
});

const DocumentExpiryNotificationModel =
  mongoose.model<IDocumentExpiryNotification>(
    "DocumentExpiryNotification",
    DocumentExpiryNotificationSchema
  );

export default DocumentExpiryNotificationModel;
