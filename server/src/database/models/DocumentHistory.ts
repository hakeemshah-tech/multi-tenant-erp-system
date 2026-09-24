import mongoose, { Document, Schema } from "mongoose";

export interface IDocumentHistory extends Document {
  _id: mongoose.Types.ObjectId;
  documentId: mongoose.Types.ObjectId; // Reference to the current document
  employeeId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;

  // Document identification
  sectionKey: string;
  innerSectionKey?: string;
  fieldKey: string;

  // Document details at the time of change
  fileName: string;
  fileId: mongoose.Types.ObjectId;
  fileSize: number;
  mimeType: string;
  issuingDate?: Date;
  expiryDate?: Date;

  // Status and metadata
  status:
    | "uploaded"
    | "updated"
    | "approved"
    | "rejected"
    | "expired"
    | "pendingToApprove";
  previousStatus?: string;
  rejectionReason?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;

  // Change tracking
  changeType:
    "upload" | "date_update" | "status_change" | "rejection" | "approval";
  changeDescription: string;

  // Actor information
  actorId: mongoose.Types.ObjectId;
  actorType: "employee" | "employer" | "system";
  actorName: string;
  actorEmail: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Additional metadata
  metadata?: {
    originalFileName?: string;
    previousIssuingDate?: Date;
    previousExpiryDate?: Date;
    previousFileId?: mongoose.Types.ObjectId;
    ipAddress?: string;
    userAgent?: string;
  };
}

const DocumentHistorySchema = new Schema<IDocumentHistory>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    sectionKey: {
      type: String,
      required: true,
      index: true,
    },
    innerSectionKey: {
      type: String,
      index: true,
    },
    fieldKey: {
      type: String,
      required: true,
      index: true,
    },

    fileName: {
      type: String,
      required: true,
    },
    fileId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    issuingDate: {
      type: Date,
      index: true,
    },
    expiryDate: {
      type: Date,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "uploaded",
        "updated",
        "approved",
        "rejected",
        "expired",
        "pendingToApprove",
      ],
      required: true,
      index: true,
    },
    previousStatus: {
      type: String,
    },
    rejectionReason: {
      type: String,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },

    changeType: {
      type: String,
      enum: ["upload", "date_update", "status_change", "rejection", "approval"],
      required: true,
      index: true,
    },
    changeDescription: {
      type: String,
      required: true,
    },

    actorId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    actorType: {
      type: String,
      enum: ["employee", "employer", "system"],
      required: true,
      index: true,
    },
    actorName: {
      type: String,
      required: true,
    },
    actorEmail: {
      type: String,
      required: true,
    },

    metadata: {
      originalFileName: String,
      previousIssuingDate: Date,
      previousExpiryDate: Date,
      previousFileId: Schema.Types.ObjectId,
      ipAddress: String,
      userAgent: String,
    },
  },
  {
    timestamps: true,
    collection: "document_histories",
  }
);

// Compound indexes for efficient querying
DocumentHistorySchema.index({ documentId: 1, createdAt: -1 });
DocumentHistorySchema.index({
  employeeId: 1,
  sectionKey: 1,
  fieldKey: 1,
  createdAt: -1,
});
DocumentHistorySchema.index({ tenantId: 1, branchId: 1, createdAt: -1 });
DocumentHistorySchema.index({ actorId: 1, actorType: 1, createdAt: -1 });
DocumentHistorySchema.index({ changeType: 1, status: 1, createdAt: -1 });
DocumentHistorySchema.index({ expiryDate: 1, status: 1 });

// Text index for search functionality
DocumentHistorySchema.index({
  fileName: "text",
  changeDescription: "text",
  actorName: "text",
});

export const DocumentHistoryModel = mongoose.model<IDocumentHistory>(
  "DocumentHistory",
  DocumentHistorySchema
);
