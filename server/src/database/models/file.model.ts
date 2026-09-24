// models/File.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IFile extends Document {
  key: string; // 'uploads/employees/uuid-filename.ext'
  bucket: string; // object-storage bucket, from S3_BUCKET
  originalName: string;
  contentType: string;
  size?: number;
  etag?: string;
  uploadedBy?: string;
  status: "uploaded" | "pending";
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const FileSchema = new Schema<IFile>(
  {
    key: { type: String, required: true, index: true, unique: true },
    bucket: { type: String, required: true },
    originalName: { type: String, required: true },
    contentType: { type: String, required: true },
    size: Number,
    etag: String,
    uploadedBy: String,
    status: {
      type: String,
      enum: ["uploaded", "pending"],
      default: "uploaded",
    },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true }
);

export default mongoose.models.File ||
  mongoose.model<IFile>("File", FileSchema);
