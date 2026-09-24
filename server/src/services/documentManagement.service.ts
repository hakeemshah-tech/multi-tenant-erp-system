import EmployeeModel from "../database/models/employee.model";
import { createNotification } from "./notification.service";
import { documentNotificationService } from "./documentNotification.service";
import { documentHistoryService } from "./documentHistory.service";
import { DocumentHistoryModel } from "../database/models/DocumentHistory";

import { logCustom } from "../audit/logger";
import { User } from "../database/models/user.model";
import mongoose, { Types } from "mongoose";

export interface DocumentUploadParams {
  employeeId: string;
  sectionKey: string;
  innerSectionKey?: string;
  fieldKey: string;
  fileId: string;
  key: string;
  uploadedBy: string;
  tenantId: string;
  branchId: string;
  expiryDate?: Date;
  issuingDate?: Date;
  referenceNumber?: string;
  countryOfIssue?: string;
  metadata: {
    originalFileName: string;
    fileSize: number;
    mimeType: string;
  };
}

export interface DocumentApprovalParams {
  employeeId: string;
  sectionKey: string;
  fieldKey: string;
  status: "approved" | "rejected";
  reviewedBy: string;
  innerSectionKey?: string;
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
  uploadedBy?:
    | {
        _id: string;
        firstName: string;
        lastName: string;
        email: string;
      }
    | Types.ObjectId;
  reviewedBy?:
    | {
        _id: string;
        firstName: string;
        lastName: string;
        email: string;
      }
    | Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  expiryDate?: Date;
  issuingDate?: Date;
  referenceNumber?: string;
  countryOfIssue?: string;
  metadata?: {
    originalFileName?: string;
    fileSize?: number;
    mimeType?: string;
    uploadDate?: Date;
    previousStatus?: string;
    changeReason?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class DocumentManagementService {
  /**
   * Helper function to get user details for audit logging
   */
  private async getUserDetailsForAudit(userId: string) {
    try {
      const user = await User.findById(userId).lean();
      return {
        actorEmail: user?.email || "",
        actorName: user?.fullName || "",
        actorUserId: userId,
      };
    } catch (error) {
      console.error("Error getting user details for audit:", error);
      return {
        actorEmail: "",
        actorName: "",
        actorUserId: userId,
      };
    }
  }

  /**
   * Helper function to get employee details for audit logging
   */
  private async getEmployeeDetailsForAudit(employeeId: string) {
    try {
      const employee = await EmployeeModel.findById(employeeId)
        .populate("employeeProfile", "userId")
        .lean();

      if (
        !employee?.employeeProfile ||
        !(employee.employeeProfile as any)?.userId
      ) {
        return {
          subjectUserId: employeeId,
          subjectUserName: "Unknown Employee",
        };
      }

      const user = await User.findById(
        (employee.employeeProfile as any).userId
      ).lean();
      return {
        subjectUserId: (employee.employeeProfile as any).userId,
        subjectUserName: user?.fullName || "Unknown Employee",
      };
    } catch (error) {
      console.error("Error getting employee details for audit:", error);
      return {
        subjectUserId: employeeId,
        subjectUserName: "Unknown Employee",
      };
    }
  }
  /**
   * Upload a new document or update existing document (for employees)
   * This will mark the document as "pendingToApprove"
   */
  /**
   * Extract filename from S3 key and use it as originalFileName if it follows custom naming format
   * Key format: "uploads/employees/{uuid}-{customFilename}"
   * Custom filename format: "firstname_documenttype_dd-mm-yyyy-hhmmss.ext"
   * Returns the custom filename without the UUID prefix, or the provided originalFileName if no custom format detected
   */
  private getOriginalFileName(key: string, originalFileName: string): string {
    // Remove folder prefix if present
    const withoutFolder = key.includes("/") ? key.split("/").pop() || key : key;

    // Check if the key contains a UUID pattern (custom naming was applied)
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;

    if (uuidPattern.test(withoutFolder)) {
      // Custom naming was applied - extract the filename after UUID
      // UUID is 36 chars + 1 hyphen = 37 chars
      const customFileName = withoutFolder.substring(37);

      // Verify it follows the custom format (has underscores and date pattern)
      // Format: firstname_documenttype_dd-mm-yyyy-hhmmss.ext
      if (
        customFileName.includes("_") &&
        /\d{2}-\d{2}-\d{4}-\d{6}/.test(customFileName)
      ) {
        return customFileName;
      }
    }

    // If no custom format detected, return the original filename
    return originalFileName;
  }

  async uploadDocument(params: DocumentUploadParams): Promise<DocumentInfo> {
    const {
      employeeId,
      sectionKey,
      innerSectionKey,
      fieldKey,
      fileId,
      key,
      uploadedBy,
      tenantId,
      branchId,
      expiryDate,
      issuingDate,
      referenceNumber,
      countryOfIssue,
      metadata,
    } = params;

    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) {
      throw new Error("Employee not found");
    }

    // Check if this is an additional field
    const isAdditionalField =
      !employee.employeeFields?.[sectionKey]?.[fieldKey] &&
      !(
        innerSectionKey &&
        employee.employeeFields?.[sectionKey]?.[innerSectionKey]?.[fieldKey]
      );

    let updateData: any = {};

    if (isAdditionalField) {
      // Handle additional field update
      const additionalFieldIndex =
        employee.employeeFields?.additionalFields?.findIndex(
          (field: any) =>
            field.sectionKey === sectionKey &&
            field.fieldKey === fieldKey &&
            (field.innerSectionKey || null) === (innerSectionKey || null)
        );

      if (additionalFieldIndex !== undefined && additionalFieldIndex >= 0) {
        // Update existing additional field
        const updatePath = `employeeFields.additionalFields.${additionalFieldIndex}.value`;
        updateData = {
          [`${updatePath}.fileId`]: new mongoose.Types.ObjectId(fileId),
          [`${updatePath}.key`]: key,
          [`${updatePath}.status`]: "pendingToApprove",
          [`${updatePath}.uploadedBy`]: new mongoose.Types.ObjectId(uploadedBy),
          [`${updatePath}.reviewedBy`]: undefined,
          [`${updatePath}.reviewedAt`]: undefined,
          [`${updatePath}.rejectionReason`]: undefined,
          [`${updatePath}.metadata.originalFileName`]: this.getOriginalFileName(
            key,
            metadata.originalFileName
          ),
          [`${updatePath}.metadata.fileSize`]: metadata.fileSize,
          [`${updatePath}.metadata.mimeType`]: metadata.mimeType,
          [`${updatePath}.metadata.uploadDate`]: new Date(),
          [`${updatePath}.metadata.previousStatus`]: this.getDocumentStatus(
            employee,
            sectionKey,
            fieldKey,
            innerSectionKey
          ),
          [`${updatePath}.metadata.changeReason`]: this.getDocumentStatus(
            employee,
            sectionKey,
            fieldKey,
            innerSectionKey
          )
            ? "fileUpdate"
            : "newUpload",
        };

        if (expiryDate) {
          updateData[`${updatePath}.expiryDate`] = expiryDate;
        }

        if (issuingDate) {
          updateData[`${updatePath}.issuingDate`] = issuingDate;
        }

        if (referenceNumber !== undefined) {
          updateData[`${updatePath}.referenceNumber`] = referenceNumber;
        }

        if (countryOfIssue !== undefined) {
          updateData[`${updatePath}.countryOfIssue`] = countryOfIssue;
        }
      } else {
        // Create new additional field
        const newAdditionalField = {
          sectionKey,
          innerSectionKey: innerSectionKey || null,
          fieldKey,
          value: {
            fileId: new mongoose.Types.ObjectId(fileId),
            key,
            status: "pendingToApprove",
            uploadedBy: new mongoose.Types.ObjectId(uploadedBy),
            reviewedBy: undefined,
            reviewedAt: undefined,
            rejectionReason: undefined,
            metadata: {
              originalFileName: this.getOriginalFileName(
                key,
                metadata.originalFileName
              ),
              fileSize: metadata.fileSize,
              mimeType: metadata.mimeType,
              uploadDate: new Date(),
              previousStatus: this.getDocumentStatus(
                employee,
                sectionKey,
                fieldKey,
                innerSectionKey
              ),
              changeReason: this.getDocumentStatus(
                employee,
                sectionKey,
                fieldKey,
                innerSectionKey
              )
                ? "fileUpdate"
                : "newUpload",
            },
            ...(expiryDate && { expiryDate }),
            ...(issuingDate && { issuingDate }),
            ...(referenceNumber !== undefined && { referenceNumber }),
            ...(countryOfIssue !== undefined && { countryOfIssue }),
          },
        };

        updateData = {
          $push: {
            "employeeFields.additionalFields": newAdditionalField,
          },
        };
      }
    } else {
      // Handle main field update
      const updatePath = innerSectionKey
        ? `employeeFields.${sectionKey}.${innerSectionKey}.${fieldKey}`
        : `employeeFields.${sectionKey}.${fieldKey}`;

      // Get previous status for tracking
      const previousStatus = this.getDocumentStatus(
        employee,
        sectionKey,
        fieldKey,
        innerSectionKey
      );

      // Extract custom filename from S3 key if custom naming was applied
      const finalFileName = this.getOriginalFileName(
        key,
        metadata.originalFileName
      );

      updateData = {
        [`${updatePath}.fileId`]: new mongoose.Types.ObjectId(fileId),
        [`${updatePath}.key`]: key,
        [`${updatePath}.status`]: "pendingToApprove",
        [`${updatePath}.uploadedBy`]: new mongoose.Types.ObjectId(uploadedBy),
        [`${updatePath}.reviewedBy`]: undefined,
        [`${updatePath}.reviewedAt`]: undefined,
        [`${updatePath}.rejectionReason`]: undefined,
        [`${updatePath}.metadata.originalFileName`]: finalFileName,
        [`${updatePath}.metadata.fileSize`]: metadata.fileSize,
        [`${updatePath}.metadata.mimeType`]: metadata.mimeType,
        [`${updatePath}.metadata.uploadDate`]: new Date(),
        [`${updatePath}.metadata.previousStatus`]: previousStatus,
        [`${updatePath}.metadata.changeReason`]: previousStatus
          ? "fileUpdate"
          : "newUpload",
      };

      if (expiryDate) {
        updateData[`${updatePath}.expiryDate`] = expiryDate;
      }

      if (issuingDate) {
        updateData[`${updatePath}.issuingDate`] = issuingDate;
      }

      if (referenceNumber !== undefined) {
        updateData[`${updatePath}.referenceNumber`] = referenceNumber;
      }

      if (countryOfIssue !== undefined) {
        updateData[`${updatePath}.countryOfIssue`] = countryOfIssue;
      }
    }

    // Get previous status BEFORE updating (for history logic)
    const previousStatus = this.getDocumentStatus(
      employee,
      sectionKey,
      fieldKey,
      innerSectionKey
    );

    const updatedEmployee = await EmployeeModel.findByIdAndUpdate(
      employeeId,
      isAdditionalField && updateData.$push ? updateData : { $set: updateData },
      { new: true }
    );

    if (!updatedEmployee) {
      throw new Error("Failed to update employee document");
    }

    // Create notification for employer
    await documentNotificationService.createDocumentUpdateNotification({
      employeeId,
      tenantId,
      branchId,
      sectionKey,
      fieldKey,
      innerSectionKey,
      documentId: fileId,
      uploadedBy,
      isUpdate: !!previousStatus, // true if updating existing document
    });

    // Log audit event
    const [actorDetails, employeeDetails] = await Promise.all([
      this.getUserDetailsForAudit(uploadedBy),
      this.getEmployeeDetailsForAudit(employeeId),
    ]);

    await logCustom({
      op: "document-uploaded",
      aggregateType: "Employee",
      aggregateId: employeeId,
      subjectUserId: employeeDetails.subjectUserId,
      subjectUserName: employeeDetails.subjectUserName,
      tenantId,
      branchId,
      summary: `Document uploaded: ${fieldKey}`,
      audit: {
        actorUserId: actorDetails.actorUserId,
        actorEmail: actorDetails.actorEmail,
        actorName: actorDetails.actorName,
      },
      meta: {
        sectionKey,
        innerSectionKey,
        fieldKey,
        status: "pendingToApprove",
        changeReason: previousStatus ? "fileUpdate" : "newUpload",
      },
    });

    // Check previous document status - if it was pendingToApprove, replace the latest history entry
    // Otherwise, create a new history entry
    if (previousStatus === "pendingToApprove") {
      // Current document is pending - replace the latest history entry
      const latestHistoryEntry = await DocumentHistoryModel.findOne({
        employeeId: new mongoose.Types.ObjectId(employeeId),
        sectionKey,
        fieldKey,
        innerSectionKey: innerSectionKey || null,
      }).sort({ createdAt: -1 });

      if (latestHistoryEntry) {
        await DocumentHistoryModel.findByIdAndUpdate(latestHistoryEntry._id, {
          $set: {
            documentId: new mongoose.Types.ObjectId(fileId),
            fileName: this.getOriginalFileName(key, metadata.originalFileName),
            fileId: new mongoose.Types.ObjectId(fileId),
            fileSize: metadata.fileSize,
            mimeType: metadata.mimeType,
            issuingDate,
            expiryDate,
            actorId: new mongoose.Types.ObjectId(uploadedBy),
            actorType: "employee",
            actorName: actorDetails.actorName,
            actorEmail: actorDetails.actorEmail,
            changeDescription: `Document uploaded by employee and sent for approval`,
            status: "pendingToApprove",
            metadata: {
              originalFileName: this.getOriginalFileName(
                key,
                metadata.originalFileName
              ),
              previousStatus,
              changeReason: previousStatus ? "fileUpdate" : "newUpload",
            },
            updatedAt: new Date(),
          },
        });
        console.log(
          `✅ [DEBUG] Replaced existing history entry (previous status: pendingToApprove) for document: ${fieldKey}`
        );
      }
    } else {
      // Previous document was approved, rejected, or doesn't exist - create new history entry
      await documentHistoryService.createUploadHistory(
        new mongoose.Types.ObjectId(fileId),
        new mongoose.Types.ObjectId(employeeId),
        new mongoose.Types.ObjectId(tenantId),
        new mongoose.Types.ObjectId(branchId),
        sectionKey,
        fieldKey,
        innerSectionKey,
        this.getOriginalFileName(key, metadata.originalFileName),
        new mongoose.Types.ObjectId(fileId),
        metadata.fileSize,
        metadata.mimeType,
        issuingDate,
        expiryDate,
        new mongoose.Types.ObjectId(uploadedBy),
        "employee",
        actorDetails.actorName,
        actorDetails.actorEmail,
        {
          originalFileName: this.getOriginalFileName(
            key,
            metadata.originalFileName
          ),
          previousStatus,
          changeReason: previousStatus ? "fileUpdate" : "newUpload",
        }
      );
      console.log(
        `✅ [DEBUG] Created new history entry (previous status: ${
          previousStatus || "none"
        }) for document: ${fieldKey}`
      );
    }

    return await this.getDocumentInfo(
      updatedEmployee,
      sectionKey,
      fieldKey,
      innerSectionKey
    );
  }

  /**
   * Upload a new document or update existing document (for employers)
   * This will mark the document as "approved" automatically
   */
  async uploadDocumentAsEmployer(
    params: DocumentUploadParams
  ): Promise<DocumentInfo> {
    const {
      employeeId,
      sectionKey,
      innerSectionKey,
      fieldKey,
      fileId,
      key,
      uploadedBy,
      tenantId,
      branchId,
      expiryDate,
      issuingDate,
      referenceNumber,
      countryOfIssue,
      metadata,
    } = params;

    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) {
      throw new Error("Employee not found");
    }

    // Check if this is an additional field
    const isAdditionalField =
      !employee.employeeFields?.[sectionKey]?.[fieldKey] &&
      !(
        innerSectionKey &&
        employee.employeeFields?.[sectionKey]?.[innerSectionKey]?.[fieldKey]
      );

    let updateData: any = {};

    if (isAdditionalField) {
      // Handle additional field update
      const additionalFieldIndex =
        employee.employeeFields?.additionalFields?.findIndex(
          (field: any) =>
            field.sectionKey === sectionKey &&
            field.fieldKey === fieldKey &&
            (field.innerSectionKey || null) === (innerSectionKey || null)
        );

      if (additionalFieldIndex !== undefined && additionalFieldIndex >= 0) {
        // Update existing additional field
        const updatePath = `employeeFields.additionalFields.${additionalFieldIndex}.value`;
        updateData = {
          [`${updatePath}.fileId`]: new mongoose.Types.ObjectId(fileId),
          [`${updatePath}.key`]: key,
          [`${updatePath}.status`]: "approved", // Automatically approved for employers
          [`${updatePath}.uploadedBy`]: new mongoose.Types.ObjectId(uploadedBy),
          [`${updatePath}.reviewedBy`]: new mongoose.Types.ObjectId(uploadedBy), // Same as uploadedBy for employer uploads
          [`${updatePath}.reviewedAt`]: new Date(), // Set review date to now
          [`${updatePath}.rejectionReason`]: undefined,
          [`${updatePath}.metadata.originalFileName`]: this.getOriginalFileName(
            key,
            metadata.originalFileName
          ),
          [`${updatePath}.metadata.fileSize`]: metadata.fileSize,
          [`${updatePath}.metadata.mimeType`]: metadata.mimeType,
          [`${updatePath}.metadata.uploadDate`]: new Date(),
          [`${updatePath}.metadata.previousStatus`]: this.getDocumentStatus(
            employee,
            sectionKey,
            fieldKey,
            innerSectionKey
          ),
          [`${updatePath}.metadata.changeReason`]: this.getDocumentStatus(
            employee,
            sectionKey,
            fieldKey,
            innerSectionKey
          )
            ? "fileUpdate"
            : "newUpload",
        };

        if (expiryDate) {
          updateData[`${updatePath}.expiryDate`] = expiryDate;
        }

        if (issuingDate) {
          updateData[`${updatePath}.issuingDate`] = issuingDate;
        }

        if (referenceNumber !== undefined) {
          updateData[`${updatePath}.referenceNumber`] = referenceNumber;
        }

        if (countryOfIssue !== undefined) {
          updateData[`${updatePath}.countryOfIssue`] = countryOfIssue;
        }
      } else {
        // Create new additional field
        const newAdditionalField = {
          sectionKey,
          innerSectionKey: innerSectionKey || null,
          fieldKey,
          value: {
            fileId: new mongoose.Types.ObjectId(fileId),
            key,
            status: "approved", // Automatically approved for employers
            uploadedBy: new mongoose.Types.ObjectId(uploadedBy),
            reviewedBy: new mongoose.Types.ObjectId(uploadedBy), // Same as uploadedBy for employer uploads
            reviewedAt: new Date(), // Set review date to now
            rejectionReason: undefined,
            metadata: {
              originalFileName: this.getOriginalFileName(
                key,
                metadata.originalFileName
              ),
              fileSize: metadata.fileSize,
              mimeType: metadata.mimeType,
              uploadDate: new Date(),
              previousStatus: this.getDocumentStatus(
                employee,
                sectionKey,
                fieldKey,
                innerSectionKey
              ),
              changeReason: this.getDocumentStatus(
                employee,
                sectionKey,
                fieldKey,
                innerSectionKey
              )
                ? "fileUpdate"
                : "newUpload",
            },
            ...(expiryDate && { expiryDate }),
            ...(issuingDate && { issuingDate }),
            ...(referenceNumber !== undefined && { referenceNumber }),
            ...(countryOfIssue !== undefined && { countryOfIssue }),
          },
        };

        updateData = {
          $push: {
            "employeeFields.additionalFields": newAdditionalField,
          },
        };
      }
    } else {
      // Handle main field update
      const updatePath = innerSectionKey
        ? `employeeFields.${sectionKey}.${innerSectionKey}.${fieldKey}`
        : `employeeFields.${sectionKey}.${fieldKey}`;

      // Get previous status for tracking
      const previousStatus = this.getDocumentStatus(
        employee,
        sectionKey,
        fieldKey,
        innerSectionKey
      );

      updateData = {
        [`${updatePath}.fileId`]: new mongoose.Types.ObjectId(fileId),
        [`${updatePath}.key`]: key,
        [`${updatePath}.status`]: "approved", // Automatically approved for employers
        [`${updatePath}.uploadedBy`]: new mongoose.Types.ObjectId(uploadedBy),
        [`${updatePath}.reviewedBy`]: new mongoose.Types.ObjectId(uploadedBy), // Same as uploadedBy for employer uploads
        [`${updatePath}.reviewedAt`]: new Date(), // Set review date to now
        [`${updatePath}.rejectionReason`]: undefined,
        [`${updatePath}.metadata.originalFileName`]: this.getOriginalFileName(
          key,
          metadata.originalFileName
        ),
        [`${updatePath}.metadata.fileSize`]: metadata.fileSize,
        [`${updatePath}.metadata.mimeType`]: metadata.mimeType,
        [`${updatePath}.metadata.uploadDate`]: new Date(),
        [`${updatePath}.metadata.previousStatus`]: previousStatus,
        [`${updatePath}.metadata.changeReason`]: previousStatus
          ? "fileUpdate"
          : "newUpload",
      };

      if (expiryDate) {
        updateData[`${updatePath}.expiryDate`] = expiryDate;
      }

      if (issuingDate) {
        updateData[`${updatePath}.issuingDate`] = issuingDate;
      }

      if (referenceNumber !== undefined) {
        updateData[`${updatePath}.referenceNumber`] = referenceNumber;
      }

      if (countryOfIssue !== undefined) {
        updateData[`${updatePath}.countryOfIssue`] = countryOfIssue;
      }
    }

    const updatedEmployee = await EmployeeModel.findByIdAndUpdate(
      employeeId,
      isAdditionalField && updateData.$push ? updateData : { $set: updateData },
      { new: true }
    );

    if (!updatedEmployee) {
      throw new Error("Failed to update employee document");
    }

    // Create notification for employee about employer upload/approval
    await documentNotificationService.createDocumentApprovalNotification({
      employeeId,
      tenantId,
      branchId,
      sectionKey,
      fieldKey,
      innerSectionKey,
      documentId: fileId,
      status: "approved",
      reviewedBy: uploadedBy,
    });

    // Get previous status for audit logging
    const previousStatus = this.getDocumentStatus(
      employee,
      sectionKey,
      fieldKey,
      innerSectionKey
    );

    // Log audit event for employer upload
    const [actorDetails, employeeDetails] = await Promise.all([
      this.getUserDetailsForAudit(uploadedBy),
      this.getEmployeeDetailsForAudit(employeeId),
    ]);

    await logCustom({
      op: "document-uploaded",
      aggregateType: "Employee",
      aggregateId: employeeId,
      subjectUserId: employeeDetails.subjectUserId,
      subjectUserName: employeeDetails.subjectUserName,
      tenantId,
      branchId,
      summary: `Document uploaded and approved by employer: ${fieldKey}`,
      audit: {
        actorUserId: actorDetails.actorUserId,
        actorEmail: actorDetails.actorEmail,
        actorName: actorDetails.actorName,
      },
      meta: {
        sectionKey,
        innerSectionKey,
        fieldKey,
        status: "approved",
        changeReason: previousStatus ? "fileUpdate" : "newUpload",
        uploadedByEmployer: true,
      },
    });

    // Create document history entry for employer upload
    await documentHistoryService.createUploadHistory(
      new mongoose.Types.ObjectId(fileId),
      new mongoose.Types.ObjectId(employeeId),
      new mongoose.Types.ObjectId(tenantId),
      new mongoose.Types.ObjectId(branchId),
      sectionKey,
      fieldKey,
      innerSectionKey,
      this.getOriginalFileName(key, metadata.originalFileName),
      new mongoose.Types.ObjectId(fileId),
      metadata.fileSize,
      metadata.mimeType,
      issuingDate,
      expiryDate,
      new mongoose.Types.ObjectId(uploadedBy),
      "employer",
      actorDetails.actorName,
      actorDetails.actorEmail,
      {
        originalFileName: this.getOriginalFileName(
          key,
          metadata.originalFileName
        ),
        previousStatus,
        changeReason: previousStatus ? "fileUpdate" : "newUpload",
        uploadedByEmployer: true,
      }
    );

    return await this.getDocumentInfo(
      updatedEmployee,
      sectionKey,
      fieldKey,
      innerSectionKey
    );
  }

  /**
   * Update document expiry or issuing date
   * This will mark the document as "pendingToApprove"
   */
  async updateDocumentDates(
    employeeId: string,
    sectionKey: string,
    fieldKey: string,
    uploadedBy: string,
    innerSectionKey: string | undefined,
    updates: {
      expiryDate?: Date;
      issuingDate?: Date;
    }
  ): Promise<DocumentInfo> {
    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) {
      throw new Error("Employee not found");
    }

    // Check if this is an additional field by looking in additionalFields array first
    const additionalField = employee.employeeFields?.additionalFields?.find(
      (field: any) =>
        field.sectionKey === sectionKey &&
        field.fieldKey === fieldKey &&
        (field.innerSectionKey || null) === (innerSectionKey || null)
    );

    const isAdditionalField = !!additionalField;

    let updateData: any = {};

    if (isAdditionalField) {
      // Handle additional field update
      const additionalFieldIndex =
        employee.employeeFields?.additionalFields?.findIndex(
          (field: any) =>
            field.sectionKey === sectionKey &&
            field.fieldKey === fieldKey &&
            (field.innerSectionKey || null) === (innerSectionKey || null)
        );

      if (additionalFieldIndex !== undefined && additionalFieldIndex >= 0) {
        // Update existing additional field
        const updatePath = `employeeFields.additionalFields.${additionalFieldIndex}.value`;
        updateData = {
          [`${updatePath}.status`]: "pendingToApprove",
          [`${updatePath}.uploadedBy`]: new mongoose.Types.ObjectId(uploadedBy),
          [`${updatePath}.reviewedBy`]: undefined,
          [`${updatePath}.reviewedAt`]: undefined,
          [`${updatePath}.rejectionReason`]: undefined,
          [`${updatePath}.metadata.uploadDate`]: new Date(),
          [`${updatePath}.metadata.changeReason`]: updates.expiryDate
            ? "expiryChange"
            : "issuingDateChange",
        };

        if (updates.expiryDate) {
          updateData[`${updatePath}.expiryDate`] = updates.expiryDate;
        }

        if (updates.issuingDate) {
          updateData[`${updatePath}.issuingDate`] = updates.issuingDate;
        }
      } else {
        throw new Error(
          `Additional field ${fieldKey} not found in section ${sectionKey}`
        );
      }
    } else {
      // Handle main field update
      const updatePath = innerSectionKey
        ? `employeeFields.${sectionKey}.${innerSectionKey}.${fieldKey}`
        : `employeeFields.${sectionKey}.${fieldKey}`;

      updateData = {
        [`${updatePath}.status`]: "pendingToApprove",
        [`${updatePath}.uploadedBy`]: new mongoose.Types.ObjectId(uploadedBy),
        [`${updatePath}.reviewedBy`]: undefined,
        [`${updatePath}.reviewedAt`]: undefined,
        [`${updatePath}.rejectionReason`]: undefined,
        [`${updatePath}.metadata.uploadDate`]: new Date(),
        [`${updatePath}.metadata.changeReason`]: updates.expiryDate
          ? "expiryChange"
          : "issuingDateChange",
      };

      if (updates.expiryDate) {
        updateData[`${updatePath}.expiryDate`] = updates.expiryDate;
      }

      if (updates.issuingDate) {
        updateData[`${updatePath}.issuingDate`] = updates.issuingDate;
      }
    }

    const updatedEmployee = await EmployeeModel.findByIdAndUpdate(
      employeeId,
      { $set: updateData },
      { new: true }
    );

    if (!updatedEmployee) {
      throw new Error("Failed to update employee document");
    }

    // Create notification for employer about date update
    await documentNotificationService.createDocumentUpdateNotification({
      employeeId,
      tenantId: employee.tenantId.toString(),
      branchId: employee.branchId.toString(),
      sectionKey,
      fieldKey,
      innerSectionKey,
      uploadedBy,
      isUpdate: true, // This is an update to existing document
    });

    // Log audit event
    const [actorDetails, employeeDetails] = await Promise.all([
      this.getUserDetailsForAudit(uploadedBy),
      this.getEmployeeDetailsForAudit(employeeId),
    ]);

    await logCustom({
      op: "document-updated",
      aggregateType: "Employee",
      aggregateId: employeeId,
      subjectUserId: employeeDetails.subjectUserId,
      subjectUserName: employeeDetails.subjectUserName,
      tenantId: employee.tenantId.toString(),
      branchId: employee.branchId.toString(),
      summary: `Document dates updated: ${fieldKey}`,
      audit: {
        actorUserId: actorDetails.actorUserId,
        actorEmail: actorDetails.actorEmail,
        actorName: actorDetails.actorName,
      },
      meta: {
        sectionKey,
        innerSectionKey,
        fieldKey,
        status: "pendingToApprove",
        changeReason: updates.expiryDate ? "expiryChange" : "issuingDateChange",
      },
    });

    // Get current document info for history tracking
    const currentDocInfo = await this.getDocumentInfo(
      updatedEmployee,
      sectionKey,
      fieldKey,
      innerSectionKey
    );

    // Get previous dates for history tracking
    const previousIssuingDate = isAdditionalField
      ? additionalField?.value?.issuingDate
      : this.getDocumentIssuingDate(
          employee,
          sectionKey,
          fieldKey,
          innerSectionKey
        );
    const previousExpiryDate = isAdditionalField
      ? additionalField?.value?.expiryDate
      : this.getDocumentExpiryDate(
          employee,
          sectionKey,
          fieldKey,
          innerSectionKey
        );

    // Update the latest document history entry with new dates and set status to "pendingToApprove"
    try {
      const latestHistoryEntry = await DocumentHistoryModel.findOne({
        employeeId: new mongoose.Types.ObjectId(employeeId),
        sectionKey,
        fieldKey,
        innerSectionKey: innerSectionKey || null,
      }).sort({ createdAt: -1 });

      if (latestHistoryEntry) {
        await DocumentHistoryModel.findByIdAndUpdate(latestHistoryEntry._id, {
          $set: {
            issuingDate: currentDocInfo.issuingDate,
            expiryDate: currentDocInfo.expiryDate,
            status: "pendingToApprove",
            reviewedBy: undefined,
            reviewedAt: undefined,
            rejectionReason: undefined,
          },
        });

        console.log(
          `✅ [DEBUG] Updated latest document history with new dates and status to: pendingToApprove for document: ${fieldKey}`
        );
      }
    } catch (error) {
      console.error("❌ Error updating document history dates:", error);
    }

    return currentDocInfo;
  }

  /**
   * Update document expiry or issuing date (for employers)
   * This will mark the document as "approved" automatically
   */
  async updateDocumentDatesAsEmployer(
    employeeId: string,
    sectionKey: string,
    fieldKey: string,
    uploadedBy: string,
    innerSectionKey: string | undefined,
    updates: {
      expiryDate?: Date;
      issuingDate?: Date;
    }
  ): Promise<DocumentInfo> {
    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) {
      throw new Error("Employee not found");
    }

    // Check if this is an additional field by looking in additionalFields array first
    const additionalField = employee.employeeFields?.additionalFields?.find(
      (field: any) =>
        field.sectionKey === sectionKey &&
        field.fieldKey === fieldKey &&
        (field.innerSectionKey || null) === (innerSectionKey || null)
    );

    const isAdditionalField = !!additionalField;

    let updateData: any = {};

    if (isAdditionalField) {
      // Handle additional field update
      const additionalFieldIndex =
        employee.employeeFields?.additionalFields?.findIndex(
          (field: any) =>
            field.sectionKey === sectionKey &&
            field.fieldKey === fieldKey &&
            (field.innerSectionKey || null) === (innerSectionKey || null)
        );

      if (additionalFieldIndex !== undefined && additionalFieldIndex >= 0) {
        // Update existing additional field
        const updatePath = `employeeFields.additionalFields.${additionalFieldIndex}.value`;
        updateData = {
          [`${updatePath}.status`]: "approved", // Automatically approved for employers
          [`${updatePath}.uploadedBy`]: new mongoose.Types.ObjectId(uploadedBy),
          [`${updatePath}.reviewedBy`]: new mongoose.Types.ObjectId(uploadedBy), // Same as uploadedBy for employer updates
          [`${updatePath}.reviewedAt`]: new Date(), // Set review date to now
          [`${updatePath}.rejectionReason`]: undefined,
          [`${updatePath}.metadata.uploadDate`]: new Date(),
          [`${updatePath}.metadata.changeReason`]: updates.expiryDate
            ? "expiryChange"
            : "issuingDateChange",
        };

        if (updates.expiryDate) {
          updateData[`${updatePath}.expiryDate`] = updates.expiryDate;
        }

        if (updates.issuingDate) {
          updateData[`${updatePath}.issuingDate`] = updates.issuingDate;
        }
      } else {
        throw new Error(
          `Additional field ${fieldKey} not found in section ${sectionKey}`
        );
      }
    } else {
      // Handle main field update
      const updatePath = innerSectionKey
        ? `employeeFields.${sectionKey}.${innerSectionKey}.${fieldKey}`
        : `employeeFields.${sectionKey}.${fieldKey}`;

      updateData = {
        [`${updatePath}.status`]: "approved", // Automatically approved for employers
        [`${updatePath}.uploadedBy`]: new mongoose.Types.ObjectId(uploadedBy),
        [`${updatePath}.reviewedBy`]: new mongoose.Types.ObjectId(uploadedBy), // Same as uploadedBy for employer updates
        [`${updatePath}.reviewedAt`]: new Date(), // Set review date to now
        [`${updatePath}.rejectionReason`]: undefined,
        [`${updatePath}.metadata.uploadDate`]: new Date(),
        [`${updatePath}.metadata.changeReason`]: updates.expiryDate
          ? "expiryChange"
          : "issuingDateChange",
      };

      if (updates.expiryDate) {
        updateData[`${updatePath}.expiryDate`] = updates.expiryDate;
      }

      if (updates.issuingDate) {
        updateData[`${updatePath}.issuingDate`] = updates.issuingDate;
      }
    }

    const updatedEmployee = await EmployeeModel.findByIdAndUpdate(
      employeeId,
      { $set: updateData },
      { new: true }
    );

    if (!updatedEmployee) {
      throw new Error("Failed to update employee document");
    }

    // Create notification for employee about employer date update/approval
    await documentNotificationService.createDocumentApprovalNotification({
      employeeId,
      tenantId: employee.tenantId.toString(),
      branchId: employee.branchId.toString(),
      sectionKey,
      fieldKey,
      innerSectionKey,
      status: "approved",
      reviewedBy: uploadedBy,
    });

    // Log audit event for employer update
    const [actorDetails, employeeDetails] = await Promise.all([
      this.getUserDetailsForAudit(uploadedBy),
      this.getEmployeeDetailsForAudit(employeeId),
    ]);

    await logCustom({
      op: "document-approved",
      aggregateType: "Employee",
      aggregateId: employeeId,
      subjectUserId: employeeDetails.subjectUserId,
      subjectUserName: employeeDetails.subjectUserName,
      tenantId: employee.tenantId.toString(),
      branchId: employee.branchId.toString(),
      summary: `Document dates updated and approved by employer: ${fieldKey}`,
      audit: {
        actorUserId: actorDetails.actorUserId,
        actorEmail: actorDetails.actorEmail,
        actorName: actorDetails.actorName,
      },
      meta: {
        sectionKey,
        innerSectionKey,
        fieldKey,
        status: "approved",
        changeReason: updates.expiryDate ? "expiryChange" : "issuingDateChange",
        updatedByEmployer: true,
      },
    });

    return await this.getDocumentInfo(
      updatedEmployee,
      sectionKey,
      fieldKey,
      innerSectionKey
    );
  }

  /**
   * Approve or reject a document
   */
  async updateDocumentStatus(
    params: DocumentApprovalParams
  ): Promise<DocumentInfo> {
    const {
      employeeId,
      sectionKey,
      innerSectionKey,
      fieldKey,
      status,
      reviewedBy,
      rejectionReason,
    } = params;

    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) {
      throw new Error("Employee not found");
    }

    // Check if this is an additional field
    const isAdditionalField =
      !employee.employeeFields?.[sectionKey]?.[fieldKey] &&
      !(
        innerSectionKey &&
        employee.employeeFields?.[sectionKey]?.[innerSectionKey]?.[fieldKey]
      );

    let updateData: any = {};

    if (isAdditionalField) {
      // Handle additional field update
      const additionalFieldIndex =
        employee.employeeFields?.additionalFields?.findIndex(
          (field: any) =>
            field.sectionKey === sectionKey &&
            field.fieldKey === fieldKey &&
            (field.innerSectionKey || null) === (innerSectionKey || null)
        );

      if (additionalFieldIndex !== undefined && additionalFieldIndex >= 0) {
        // Update existing additional field
        const updatePath = `employeeFields.additionalFields.${additionalFieldIndex}.value`;
        updateData = {
          [`${updatePath}.status`]: status,
          [`${updatePath}.reviewedBy`]: new mongoose.Types.ObjectId(reviewedBy),
          [`${updatePath}.reviewedAt`]: new Date(),
        };

        if (status === "rejected" && rejectionReason) {
          updateData[`${updatePath}.rejectionReason`] = rejectionReason;
        }
      } else {
        throw new Error(
          `Additional field ${fieldKey} not found in section ${sectionKey}`
        );
      }
    } else {
      // Handle main field update
      const updatePath = innerSectionKey
        ? `employeeFields.${sectionKey}.${innerSectionKey}.${fieldKey}`
        : `employeeFields.${sectionKey}.${fieldKey}`;

      updateData = {
        [`${updatePath}.status`]: status,
        [`${updatePath}.reviewedBy`]: new mongoose.Types.ObjectId(reviewedBy),
        [`${updatePath}.reviewedAt`]: new Date(),
      };

      if (status === "rejected" && rejectionReason) {
        updateData[`${updatePath}.rejectionReason`] = rejectionReason;
      }
    }

    const updatedEmployee = await EmployeeModel.findByIdAndUpdate(
      employeeId,
      { $set: updateData },
      { new: true }
    );

    if (!updatedEmployee) {
      throw new Error("Failed to update employee document");
    }

    // Create notification for employee
    await documentNotificationService.createDocumentApprovalNotification({
      employeeId,
      tenantId: employee.tenantId.toString(),
      branchId: employee.branchId.toString(),
      sectionKey,
      fieldKey,
      innerSectionKey,
      status,
      reviewedBy,
      rejectionReason,
    });

    // Log audit event
    const [actorDetails, employeeDetails] = await Promise.all([
      this.getUserDetailsForAudit(reviewedBy),
      this.getEmployeeDetailsForAudit(employeeId),
    ]);

    await logCustom({
      op: status === "approved" ? "document-approved" : "document-rejected",
      aggregateType: "Employee",
      aggregateId: employeeId,
      subjectUserId: employeeDetails.subjectUserId,
      subjectUserName: employeeDetails.subjectUserName,
      tenantId: employee.tenantId.toString(),
      branchId: employee.branchId.toString(),
      summary: `Document ${status}: ${fieldKey}`,
      audit: {
        actorUserId: actorDetails.actorUserId,
        actorEmail: actorDetails.actorEmail,
        actorName: actorDetails.actorName,
      },
      meta: {
        sectionKey,
        innerSectionKey,
        fieldKey,
        status,
        rejectionReason,
      },
    });

    // Update the document history entry that matches the CURRENT document's fileId
    // AND create a separate approval/rejection entry for better tracking
    try {
      // Get the current document's fileId and details from the updated employee record
      let currentFileId: mongoose.Types.ObjectId | null = null;
      let documentData: any = null;

      if (isAdditionalField) {
        const additionalField =
          updatedEmployee.employeeFields?.additionalFields?.find(
            (field: any) =>
              field.sectionKey === sectionKey &&
              field.fieldKey === fieldKey &&
              (field.innerSectionKey || null) === (innerSectionKey || null)
          );
        documentData = additionalField?.value;
        currentFileId = documentData?.fileId
          ? new mongoose.Types.ObjectId(documentData.fileId)
          : null;
      } else if (innerSectionKey) {
        documentData =
          updatedEmployee.employeeFields?.[sectionKey]?.[innerSectionKey]?.[
            fieldKey
          ];
        currentFileId = documentData?.fileId
          ? new mongoose.Types.ObjectId(documentData.fileId)
          : null;
      } else {
        documentData = updatedEmployee.employeeFields?.[sectionKey]?.[fieldKey];
        currentFileId = documentData?.fileId
          ? new mongoose.Types.ObjectId(documentData.fileId)
          : null;
      }

      if (currentFileId && documentData) {
        // Find the history entry that matches the current document's fileId
        const historyEntry = await DocumentHistoryModel.findOne({
          employeeId: new mongoose.Types.ObjectId(employeeId),
          sectionKey,
          fieldKey,
          innerSectionKey: innerSectionKey || null,
          fileId: currentFileId,
        }).sort({ createdAt: -1 }); // Get the most recent entry for this fileId

        if (historyEntry) {
          // Update the existing upload entry with approval info
          await DocumentHistoryModel.findByIdAndUpdate(historyEntry._id, {
            $set: {
              status: status,
              reviewedBy: new mongoose.Types.ObjectId(reviewedBy),
              reviewedAt: new Date(),
              ...(status === "rejected" &&
                rejectionReason && { rejectionReason }),
            },
          });

          // Also create a separate approval/rejection entry for better tracking
          await documentHistoryService.createStatusChangeHistory(
            currentFileId,
            new mongoose.Types.ObjectId(employeeId),
            employee.tenantId,
            employee.branchId,
            sectionKey,
            fieldKey,
            innerSectionKey,
            historyEntry.fileName,
            currentFileId,
            historyEntry.fileSize,
            historyEntry.mimeType,
            documentData.issuingDate,
            documentData.expiryDate,
            status,
            historyEntry.status, // previousStatus
            status === "approved" ? "approval" : "rejection",
            rejectionReason,
            new mongoose.Types.ObjectId(reviewedBy),
            "employer",
            actorDetails.actorName,
            actorDetails.actorEmail,
            historyEntry.metadata
          );

          console.log(
            `✅ [DEBUG] Updated document history entry (fileId: ${currentFileId}) and created ${status} entry for document: ${fieldKey}`
          );
        } else {
          console.log(
            `⚠️ [DEBUG] No document history entry found for fileId: ${currentFileId}`
          );
        }
      } else {
        console.log(
          `⚠️ [DEBUG] No fileId found in current document for: ${fieldKey}`
        );
      }
    } catch (error) {
      console.error("❌ Error updating document history status:", error);
      // Don't throw error here as the main operation succeeded
    }

    return await this.getDocumentInfo(
      updatedEmployee,
      sectionKey,
      fieldKey,
      innerSectionKey
    );
  }

  /**
   * Get all pending documents for an employee
   */
  async getPendingDocumentsByEmployee(
    employeeId: string
  ): Promise<DocumentInfo[]> {
    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) {
      throw new Error("Employee not found");
    }

    const pendingDocuments: DocumentInfo[] = [];

    // Helper function to populate user data
    const populateUserData = async (uploadedBy: any) => {
      if (!uploadedBy) {
        return {
          _id: "",
          firstName: "",
          lastName: "",
          email: "",
        };
      }

      // If already populated with user details
      if (
        typeof uploadedBy === "object" &&
        uploadedBy !== null &&
        "_id" in uploadedBy &&
        "firstName" in uploadedBy
      ) {
        return uploadedBy;
      }

      // If it's an ObjectId, fetch user details
      if (typeof uploadedBy === "string" || uploadedBy.toString) {
        try {
          const { User } = await import("../database/models/user.model");
          const user = await User.findById(uploadedBy);
          if (user) {
            return {
              _id: user._id.toString(),
              firstName: user.fullName?.split(" ")[0] || "",
              lastName: user.fullName?.split(" ").slice(1).join(" ") || "",
              email: user.email || "",
            };
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }

      return {
        _id: "",
        firstName: "",
        lastName: "",
        email: "",
      };
    };

    // Check documents section
    if (employee.employeeFields?.documents) {
      const sections = [
        "identificationdocuments",
        "certificates",
        "checksandclearance",
      ];

      for (const section of sections) {
        const sectionData = employee.employeeFields.documents[section];
        if (sectionData) {
          for (const [fieldKey, fieldData] of Object.entries(sectionData)) {
            if (
              fieldData &&
              typeof fieldData === "object" &&
              "status" in fieldData
            ) {
              const docData = fieldData as any;
              if (docData.status === "pendingToApprove") {
                const uploadedByData = await populateUserData(
                  docData.uploadedBy
                );
                pendingDocuments.push({
                  employeeId: employee._id.toString(),
                  sectionKey: "documents",
                  innerSectionKey: section,
                  fieldKey,
                  fileId: docData.fileId?.toString(),
                  key: docData.key,
                  status: docData.status,
                  uploadedBy: uploadedByData,
                  reviewedBy: docData.reviewedBy,
                  reviewedAt: docData.reviewedAt,
                  rejectionReason: docData.rejectionReason,
                  expiryDate: docData.expiryDate,
                  issuingDate: docData.issuingDate,
                  referenceNumber: docData.referenceNumber,
                  countryOfIssue: docData.countryOfIssue,
                  metadata: docData.metadata,
                  createdAt: employee.createdAt,
                  updatedAt: employee.updatedAt,
                });
              }
            }
          }
        }
      }
    }

    // Check personaldetails section (for employee photo)
    if (employee.employeeFields?.personaldetails?.employeephoto) {
      const photoData = employee.employeeFields.personaldetails.employeephoto;
      if (photoData.status === "pendingToApprove") {
        const uploadedByData = await populateUserData(photoData.uploadedBy);
        pendingDocuments.push({
          employeeId: employee._id.toString(),
          sectionKey: "personaldetails",
          fieldKey: "employeephoto",
          fileId: photoData.fileId?.toString(),
          key: photoData.key,
          status: photoData.status,
          uploadedBy: uploadedByData,
          reviewedBy:
            typeof photoData.reviewedBy === "object" &&
            photoData.reviewedBy !== null &&
            "_id" in photoData.reviewedBy
              ? photoData.reviewedBy
              : photoData.reviewedBy,
          reviewedAt: photoData.reviewedAt,
          rejectionReason: photoData.rejectionReason,
          expiryDate: photoData.expiryDate,
          issuingDate: photoData.issuingDate,
          referenceNumber: photoData.referenceNumber,
          countryOfIssue: photoData.countryOfIssue,
          metadata: photoData.metadata,
          createdAt: employee.createdAt,
          updatedAt: employee.updatedAt,
        });
      }
    }

    // Check additional fields
    if (employee.employeeFields?.additionalFields) {
      for (const additionalField of employee.employeeFields.additionalFields) {
        if (
          additionalField.value &&
          typeof additionalField.value === "object" &&
          "status" in additionalField.value &&
          additionalField.value.status === "pendingToApprove"
        ) {
          const docData = additionalField.value;
          const uploadedByData = await populateUserData(docData.uploadedBy);
          pendingDocuments.push({
            employeeId: employee._id.toString(),
            sectionKey: additionalField.sectionKey,
            innerSectionKey: additionalField.innerSectionKey,
            fieldKey: additionalField.fieldKey,
            fileId: docData.fileId?.toString(),
            key: docData.key,
            status: docData.status,
            uploadedBy: uploadedByData,
            reviewedBy: docData.reviewedBy,
            reviewedAt: docData.reviewedAt,
            rejectionReason: docData.rejectionReason,
            expiryDate: docData.expiryDate,
            issuingDate: docData.issuingDate,
            referenceNumber: docData.referenceNumber,
            countryOfIssue: docData.countryOfIssue,
            metadata: docData.metadata,
            createdAt: employee.createdAt,
            updatedAt: employee.updatedAt,
          });
        }
      }
    }

    return pendingDocuments;
  }

  /**
   * Get count of pending documents
   */
  async getPendingDocumentsCount(
    tenantId: string,
    branchId?: string
  ): Promise<number> {
    const query: any = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
    };

    if (branchId) {
      query.branchId = new mongoose.Types.ObjectId(branchId);
    }

    const employees = await EmployeeModel.find(query);
    let count = 0;

    for (const employee of employees) {
      const pendingDocs = await this.getPendingDocumentsByEmployee(
        employee._id.toString()
      );
      count += pendingDocs.length;
    }

    return count;
  }

  /**
   * Mark expired documents
   */
  async markExpiredDocuments(): Promise<number> {
    const now = new Date();
    let modifiedCount = 0;

    const employees = await EmployeeModel.find({
      "employeeFields.documents": { $exists: true },
    });

    for (const employee of employees) {
      const updateData: any = {};
      let hasUpdates = false;

      // Check documents section
      const sections = [
        "identificationdocuments",
        "certificates",
        "checksandclearance",
      ];

      for (const section of sections) {
        const sectionPath = `employeeFields.documents.${section}`;
        const sectionData = employee.employeeFields?.documents?.[section];

        if (sectionData) {
          for (const [fieldKey, fieldData] of Object.entries(sectionData)) {
            if (
              fieldData &&
              typeof fieldData === "object" &&
              "expiryDate" in fieldData
            ) {
              const docData = fieldData as any;
              if (
                docData.expiryDate &&
                docData.expiryDate < now &&
                (docData.status === "approved" ||
                  docData.status === "pendingToApprove")
              ) {
                updateData[`${sectionPath}.${fieldKey}.status`] = "expired";
                updateData[
                  `${sectionPath}.${fieldKey}.metadata.previousStatus`
                ] = docData.status;
                hasUpdates = true;
              }
            }
          }
        }
      }

      if (hasUpdates) {
        await EmployeeModel.findByIdAndUpdate(employee._id, updateData);
        modifiedCount++;
      }
    }

    return modifiedCount;
  }

  /**
   * Get document info from employee
   */
  private async getDocumentInfo(
    employee: any,
    sectionKey: string,
    fieldKey: string,
    innerSectionKey?: string
  ): Promise<DocumentInfo> {
    const section = employee.employeeFields?.[sectionKey];
    if (!section) {
      throw new Error(`Section ${sectionKey} not found`);
    }

    let documentData = null;

    if (innerSectionKey) {
      documentData = section[innerSectionKey]?.[fieldKey];
    } else {
      documentData = section[fieldKey];
    }

    // If not found in main sections, check additionalFields
    if (!documentData) {
      const additionalField = employee.employeeFields?.additionalFields?.find(
        (field: any) =>
          field.sectionKey === sectionKey &&
          field.fieldKey === fieldKey &&
          (field.innerSectionKey || null) === (innerSectionKey || null)
      );

      if (additionalField && additionalField.value) {
        // Convert additional field value to document data format
        documentData = {
          fileId: additionalField.value.fileId,
          key: additionalField.value.key,
          status: additionalField.value.status || "pendingToApprove",
          uploadedBy: additionalField.value.uploadedBy,
          reviewedBy: additionalField.value.reviewedBy,
          reviewedAt: additionalField.value.reviewedAt,
          rejectionReason: additionalField.value.rejectionReason,
          expiryDate: additionalField.value.expiryDate,
          issuingDate: additionalField.value.issuingDate,
          metadata: additionalField.value.metadata || {},
        };
      }
    }

    if (!documentData) {
      throw new Error(`Field ${fieldKey} not found in section ${sectionKey}`);
    }

    // Helper function to populate user data
    const populateUserData = async (uploadedBy: any) => {
      if (!uploadedBy) {
        return {
          _id: "",
          firstName: "",
          lastName: "",
          email: "",
        };
      }

      // If already populated with user details
      if (
        typeof uploadedBy === "object" &&
        uploadedBy !== null &&
        "_id" in uploadedBy &&
        "firstName" in uploadedBy
      ) {
        return uploadedBy;
      }

      // If it's an ObjectId, fetch user details
      if (typeof uploadedBy === "string" || uploadedBy.toString) {
        try {
          const { User } = await import("../database/models/user.model");
          const user = await User.findById(uploadedBy);
          if (user) {
            return {
              _id: user._id.toString(),
              firstName: user.fullName?.split(" ")[0] || "",
              lastName: user.fullName?.split(" ").slice(1).join(" ") || "",
              email: user.email || "",
            };
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }

      return {
        _id: "",
        firstName: "",
        lastName: "",
        email: "",
      };
    };

    const uploadedByData = await populateUserData(documentData.uploadedBy);

    return {
      employeeId: employee._id.toString(),
      sectionKey,
      innerSectionKey,
      fieldKey,
      fileId: documentData.fileId?.toString(),
      key: documentData.key,
      status: documentData.status || "pendingToApprove",
      uploadedBy: uploadedByData,
      reviewedBy: documentData.reviewedBy,
      reviewedAt: documentData.reviewedAt,
      rejectionReason: documentData.rejectionReason,
      expiryDate: documentData.expiryDate,
      issuingDate: documentData.issuingDate,
      metadata: documentData.metadata,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }

  /**
   * Get current document status
   */
  private getDocumentStatus(
    employee: any,
    sectionKey: string,
    fieldKey: string,
    innerSectionKey?: string
  ): string | undefined {
    try {
      const section = employee.employeeFields?.[sectionKey];
      if (!section) return undefined;

      let documentData = null;
      if (innerSectionKey) {
        documentData = section[innerSectionKey]?.[fieldKey];
      } else {
        documentData = section[fieldKey];
      }

      // If not found in main sections, check additionalFields
      if (!documentData) {
        const additionalField = employee.employeeFields?.additionalFields?.find(
          (field: any) =>
            field.sectionKey === sectionKey &&
            field.fieldKey === fieldKey &&
            (field.innerSectionKey || null) === (innerSectionKey || null)
        );

        if (additionalField && additionalField.value) {
          documentData = additionalField.value;
        }
      }

      return documentData?.status;
    } catch {
      return undefined;
    }
  }

  /**
   * Get document issuing date
   */
  private getDocumentIssuingDate(
    employee: any,
    sectionKey: string,
    fieldKey: string,
    innerSectionKey?: string
  ): Date | undefined {
    try {
      const section = employee.employeeFields?.[sectionKey];
      if (!section) return undefined;

      let documentData = null;
      if (innerSectionKey) {
        documentData = section[innerSectionKey]?.[fieldKey];
      } else {
        documentData = section[fieldKey];
      }

      // If not found in main sections, check additionalFields
      if (!documentData) {
        const additionalField = employee.employeeFields?.additionalFields?.find(
          (field: any) =>
            field.sectionKey === sectionKey &&
            field.fieldKey === fieldKey &&
            (field.innerSectionKey || null) === (innerSectionKey || null)
        );

        if (additionalField && additionalField.value) {
          documentData = additionalField.value;
        }
      }

      return documentData?.issuingDate;
    } catch {
      return undefined;
    }
  }

  /**
   * Get document expiry date
   */
  private getDocumentExpiryDate(
    employee: any,
    sectionKey: string,
    fieldKey: string,
    innerSectionKey?: string
  ): Date | undefined {
    try {
      const section = employee.employeeFields?.[sectionKey];
      if (!section) return undefined;

      let documentData = null;
      if (innerSectionKey) {
        documentData = section[innerSectionKey]?.[fieldKey];
      } else {
        documentData = section[fieldKey];
      }

      // If not found in main sections, check additionalFields
      if (!documentData) {
        const additionalField = employee.employeeFields?.additionalFields?.find(
          (field: any) =>
            field.sectionKey === sectionKey &&
            field.fieldKey === fieldKey &&
            (field.innerSectionKey || null) === (innerSectionKey || null)
        );

        if (additionalField && additionalField.value) {
          documentData = additionalField.value;
        }
      }

      return documentData?.expiryDate;
    } catch {
      return undefined;
    }
  }

  /**
   * Get document type from field key
   */
  private getDocumentTypeFromField(fieldKey: string): string {
    const typeMap: { [key: string]: string } = {
      passport: "Passport",
      driverslicence: "Driver's Licence",
      birthcertificate: "Birth Certificate",
      australiancitizenshipcertificate: "Australian Citizenship Certificate",
      medicarecard: "Medicare Card",
      proofofagecard: "Proof of Age Card",
      cpr: "CPR Certificate",
      firstaid: "First Aid Certificate",
      manualhandling: "Manual Handling Certificate",
      medicationcompletency: "Medication Competency Certificate",
      policeclearancecertificate: "Police Clearance Certificate",
      ndisscreensingcheck: "NDIS Screening Check",
      covid19vaccinationcertificate: "COVID-19 Vaccination Certificate",
      employeephoto: "Employee Photo",
    };

    return typeMap[fieldKey] || fieldKey;
  }
}

export default DocumentManagementService;
