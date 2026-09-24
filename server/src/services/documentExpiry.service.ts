import mongoose from "mongoose";
import EmployeeModel from "../database/models/employee.model";
import { User } from "../database/models/user.model";
import DocumentExpiryNotificationModel, {
  IDocumentExpiryNotification,
} from "../database/models/DocumentExpiryNotification";
import { emailService } from "./email.service";

interface DocumentExpiryOptions {
  batchSize: number;
  maxConcurrency: number;
  retryAttempts?: number;
}

interface DocumentInfo {
  employeeId: string;
  documentId: string;
  sectionKey: string;
  fieldKey: string;
  innerSectionKey?: string;
  expiryDate: Date;
  status: string;
  tenantId: string;
  branchId: string;
  employeeName?: string;
  employeeEmail?: string;
  tenantName?: string;
}

export class DocumentExpiryService {
  private defaultOptions: DocumentExpiryOptions = {
    batchSize: 1000,
    maxConcurrency: 5,
    retryAttempts: 3,
  };

  /**
   * Process pre-expiry notifications (3 days before expiry)
   */
  async processPreExpiryNotifications(
    options: Partial<DocumentExpiryOptions> = {}
  ) {
    const opts = { ...this.defaultOptions, ...options };
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);

    console.log(
      `🔄 Processing pre-expiry notifications for documents expiring on ${targetDate.toDateString()}`
    );

    try {
      // Find documents expiring on target date
      const documents = await this.findDocumentsExpiringOn(
        targetDate,
        opts.batchSize
      );

      if (documents.length === 0) {
        console.log("✅ No documents found expiring in 3 days");
        return { processed: 0, success: 0, failed: 0 };
      }

      console.log(`📋 Found ${documents.length} documents expiring in 3 days`);

      // Process in batches with concurrency control
      const batches = this.chunkArray(documents, opts.batchSize);
      let totalProcessed = 0;
      let totalSuccess = 0;
      let totalFailed = 0;

      for (const batch of batches) {
        const batchResults = await this.processBatchConcurrently(
          batch,
          (doc) => this.sendPreExpiryNotification(doc),
          opts.maxConcurrency
        );

        totalProcessed += batchResults.processed;
        totalSuccess += batchResults.success;
        totalFailed += batchResults.failed;

        console.log(
          `📊 Batch completed: ${batchResults.processed} processed, ${batchResults.success} success, ${batchResults.failed} failed`
        );
      }

      console.log(
        `✅ Pre-expiry notifications completed: ${totalProcessed} total, ${totalSuccess} success, ${totalFailed} failed`
      );
      return {
        processed: totalProcessed,
        success: totalSuccess,
        failed: totalFailed,
      };
    } catch (error) {
      console.error("❌ Error processing pre-expiry notifications:", error);
      throw error;
    }
  }

  /**
   * Process expired documents (on expiry date)
   */
  async processExpiredDocuments(options: Partial<DocumentExpiryOptions> = {}) {
    const opts = { ...this.defaultOptions, ...options };
    const now = new Date();

    console.log(`🔄 Processing expired documents as of ${now.toISOString()}`);

    try {
      // Find expired documents
      const expiredDocs = await this.findExpiredDocuments(opts.batchSize);

      if (expiredDocs.length === 0) {
        console.log("✅ No expired documents found");
        return { processed: 0, success: 0, failed: 0 };
      }

      console.log(`📋 Found ${expiredDocs.length} expired documents`);

      // Process in batches with concurrency control
      const batches = this.chunkArray(expiredDocs, opts.batchSize);
      let totalProcessed = 0;
      let totalSuccess = 0;
      let totalFailed = 0;

      for (const batch of batches) {
        const batchResults = await this.processBatchConcurrently(
          batch,
          (doc) => this.handleExpiredDocument(doc),
          opts.maxConcurrency
        );

        totalProcessed += batchResults.processed;
        totalSuccess += batchResults.success;
        totalFailed += batchResults.failed;

        console.log(
          `📊 Batch completed: ${batchResults.processed} processed, ${batchResults.success} success, ${batchResults.failed} failed`
        );
      }

      console.log(
        `✅ Expired documents processing completed: ${totalProcessed} total, ${totalSuccess} success, ${totalFailed} failed`
      );
      return {
        processed: totalProcessed,
        success: totalSuccess,
        failed: totalFailed,
      };
    } catch (error) {
      console.error("❌ Error processing expired documents:", error);
      throw error;
    }
  }

  /**
   * Send pre-expiry notification for a single document
   */
  private async sendPreExpiryNotification(document: DocumentInfo) {
    try {
      // Check if notification already sent
      const existingNotification =
        await DocumentExpiryNotificationModel.findOne({
          employeeId: document.employeeId,
          documentId: document.documentId,
          notificationType: "pre_expiry",
          expiryDate: document.expiryDate,
        });

      if (existingNotification) {
        console.log(
          `⏭️ Pre-expiry notification already sent for document ${document.documentId}`
        );
        return { success: true, skipped: true };
      }

      // Get employee and employer details
      const [employee, employer, tenant] = await Promise.all([
        this.getEmployeeDetails(document.employeeId),
        this.getEmployerDetails(document.tenantId, document.branchId),
        this.getTenantDetails(document.tenantId),
      ]);

      if (!employee || !employee.email) {
        throw new Error(
          `Employee not found or no email for ${document.employeeId}`
        );
      }

      const documentType = emailService.getDocumentTypeFromField(
        document.fieldKey
      );
      const daysUntilExpiry = Math.ceil(
        (document.expiryDate.getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      );

      // Send emails based on user preferences
      const emailPromises = [];

      // Check employee notification preferences
      if (
        employee.notificationPreferences?.emailNotifications
          ?.documentPreExpiry !== false
      ) {
        emailPromises.push(
          emailService.sendPreExpiryNotificationToEmployee({
            employeeEmail: employee.email,
            employeeName: employee.fullName,
            documentType,
            expiryDate: document.expiryDate,
            daysUntilExpiry,
            tenantName: tenant?.name,
          })
        );
      }

      // Check employer notification preferences
      if (
        employer &&
        employer.notificationPreferences?.emailNotifications
          ?.documentPreExpiry !== false
      ) {
        emailPromises.push(
          emailService.sendPreExpiryNotificationToEmployer({
            employerEmail: employer.email,
            employerName: employer.fullName,
            employeeName: employee.fullName,
            documentType,
            expiryDate: document.expiryDate,
            daysUntilExpiry,
            tenantName: tenant?.name,
          })
        );
      }

      // Send all emails
      await Promise.allSettled(emailPromises);

      // Record notification
      await this.recordNotificationSent(document, "pre_expiry");

      console.log(
        `✅ Pre-expiry notification sent for document ${document.documentId}`
      );
      return { success: true, skipped: false };
    } catch (error) {
      console.error(
        `❌ Error sending pre-expiry notification for document ${document.documentId}:`,
        error
      );
      await this.recordNotificationFailed(document, "pre_expiry", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle expired document (mark as expired and send notifications)
   */
  private async handleExpiredDocument(document: DocumentInfo) {
    try {
      // Check if notification already sent
      const existingNotification =
        await DocumentExpiryNotificationModel.findOne({
          employeeId: document.employeeId,
          documentId: document.documentId,
          notificationType: "expired",
          expiryDate: document.expiryDate,
        });

      if (existingNotification) {
        console.log(
          `⏭️ Expiry notification already sent for document ${document.documentId}`
        );
        return { success: true, skipped: true };
      }

      // Mark document as expired
      await this.markDocumentAsExpired(document);

      // Get employee and employer details
      const [employee, employer, tenant] = await Promise.all([
        this.getEmployeeDetails(document.employeeId),
        this.getEmployerDetails(document.tenantId, document.branchId),
        this.getTenantDetails(document.tenantId),
      ]);

      if (!employee || !employee.email) {
        throw new Error(
          `Employee not found or no email for ${document.employeeId}`
        );
      }

      const documentType = emailService.getDocumentTypeFromField(
        document.fieldKey
      );

      // Send emails based on user preferences
      const emailPromises = [];

      // Check employee notification preferences
      if (
        employee.notificationPreferences?.emailNotifications?.documentExpiry !==
        false
      ) {
        emailPromises.push(
          emailService.sendExpiryNotificationToEmployee({
            employeeEmail: employee.email,
            employeeName: employee.fullName,
            documentType,
            expiryDate: document.expiryDate,
            tenantName: tenant?.name,
          })
        );
      }

      // Check employer notification preferences
      if (
        employer &&
        employer.notificationPreferences?.emailNotifications?.documentExpiry !==
          false
      ) {
        emailPromises.push(
          emailService.sendExpiryNotificationToEmployer({
            employerEmail: employer.email,
            employerName: employer.fullName,
            employeeName: employee.fullName,
            documentType,
            expiryDate: document.expiryDate,
            tenantName: tenant?.name,
          })
        );
      }

      // Send all emails
      await Promise.allSettled(emailPromises);

      // Record notification
      await this.recordNotificationSent(document, "expired");

      console.log(
        `✅ Expiry notification sent for document ${document.documentId}`
      );
      return { success: true, skipped: false };
    } catch (error) {
      console.error(
        `❌ Error handling expired document ${document.documentId}:`,
        error
      );
      await this.recordNotificationFailed(document, "expired", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Find documents expiring on a specific date
   */
  private async findDocumentsExpiringOn(
    targetDate: Date,
    limit: number = 1000
  ): Promise<DocumentInfo[]> {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const documents = await EmployeeModel.aggregate([
      {
        $match: {
          $or: [
            { "employeeFields.documents": { $exists: true } },
            { "employeeFields.additionalFields": { $exists: true } },
          ],
        },
      },
      {
        $project: {
          _id: 1,
          tenantId: 1,
          branchId: 1,
          documents: {
            $concatArrays: [
              { $objectToArray: "$employeeFields.documents" },
              { $objectToArray: "$employeeFields.additionalFields" },
            ],
          },
        },
      },
      {
        $unwind: "$documents",
      },
      {
        $match: {
          $or: [
            {
              "documents.v.expiryDate": {
                $gte: startOfDay,
                $lte: endOfDay,
              },
              "documents.v.status": { $in: ["approved", "pendingToApprove"] },
            },
            {
              "documents.v.value.expiryDate": {
                $gte: startOfDay,
                $lte: endOfDay,
              },
              "documents.v.value.status": {
                $in: ["approved", "pendingToApprove"],
              },
            },
          ],
        },
      },
      {
        $limit: limit,
      },
    ]);

    return documents.map((doc) => {
      const isAdditionalField = doc.documents.v.value;
      const docData = isAdditionalField
        ? doc.documents.v.value
        : doc.documents.v;

      return {
        employeeId: doc._id.toString(),
        documentId: docData.fileId?.toString() || "",
        sectionKey: isAdditionalField
          ? doc.documents.v.sectionKey
          : "documents",
        fieldKey: isAdditionalField
          ? doc.documents.v.fieldKey
          : doc.documents.k,
        innerSectionKey: isAdditionalField
          ? doc.documents.v.innerSectionKey
          : doc.documents.k,
        expiryDate: docData.expiryDate,
        status: docData.status,
        tenantId: doc.tenantId.toString(),
        branchId: doc.branchId.toString(),
      };
    });
  }

  /**
   * Find expired documents
   */
  private async findExpiredDocuments(
    limit: number = 1000
  ): Promise<DocumentInfo[]> {
    const now = new Date();

    const documents = await EmployeeModel.aggregate([
      {
        $match: {
          $or: [
            { "employeeFields.documents": { $exists: true } },
            { "employeeFields.additionalFields": { $exists: true } },
          ],
        },
      },
      {
        $project: {
          _id: 1,
          tenantId: 1,
          branchId: 1,
          documents: {
            $concatArrays: [
              { $objectToArray: "$employeeFields.documents" },
              { $objectToArray: "$employeeFields.additionalFields" },
            ],
          },
        },
      },
      {
        $unwind: "$documents",
      },
      {
        $match: {
          $or: [
            {
              "documents.v.expiryDate": { $lt: now },
              "documents.v.status": { $in: ["approved", "pendingToApprove"] },
            },
            {
              "documents.v.value.expiryDate": { $lt: now },
              "documents.v.value.status": {
                $in: ["approved", "pendingToApprove"],
              },
            },
          ],
        },
      },
      {
        $limit: limit,
      },
    ]);

    return documents.map((doc) => {
      const isAdditionalField = doc.documents.v.value;
      const docData = isAdditionalField
        ? doc.documents.v.value
        : doc.documents.v;

      return {
        employeeId: doc._id.toString(),
        documentId: docData.fileId?.toString() || "",
        sectionKey: isAdditionalField
          ? doc.documents.v.sectionKey
          : "documents",
        fieldKey: isAdditionalField
          ? doc.documents.v.fieldKey
          : doc.documents.k,
        innerSectionKey: isAdditionalField
          ? doc.documents.v.innerSectionKey
          : doc.documents.k,
        expiryDate: docData.expiryDate,
        status: docData.status,
        tenantId: doc.tenantId.toString(),
        branchId: doc.branchId.toString(),
      };
    });
  }

  /**
   * Mark document as expired in database
   */
  private async markDocumentAsExpired(document: DocumentInfo) {
    const updateData: any = {};
    let hasUpdates = false;

    if (document.sectionKey === "documents") {
      // Handle main document sections
      const sections = [
        "identificationdocuments",
        "certificates",
        "checksandclearance",
      ];

      for (const section of sections) {
        const sectionPath = `employeeFields.documents.${section}`;
        const fieldPath = `${sectionPath}.${document.fieldKey}`;

        updateData[`${fieldPath}.status`] = "expired";
        updateData[`${fieldPath}.metadata.previousStatus`] = document.status;
        hasUpdates = true;
        break; // Found the section, no need to continue
      }
    } else {
      // Handle additional fields
      const additionalFieldPath = `employeeFields.additionalFields.$[elem].value`;
      updateData[`${additionalFieldPath}.status`] = "expired";
      updateData[`${additionalFieldPath}.metadata.previousStatus`] =
        document.status;
      hasUpdates = true;
    }

    if (hasUpdates) {
      const filter: any = { _id: document.employeeId };
      const options: any = { new: true };

      if (document.sectionKey !== "documents") {
        // For additional fields, use arrayFilters
        options.arrayFilters = [
          {
            "elem.sectionKey": document.sectionKey,
            "elem.fieldKey": document.fieldKey,
            "elem.innerSectionKey": document.innerSectionKey || null,
          },
        ];
      }

      await EmployeeModel.findByIdAndUpdate(
        filter,
        { $set: updateData },
        options
      );
    }
  }

  /**
   * Get employee details
   */
  private async getEmployeeDetails(employeeId: string) {
    const employee = await EmployeeModel.findById(employeeId)
      .populate("employeeProfile", "userId")
      .lean();

    if (!employee?.employeeProfile?.userId) {
      return null;
    }

    const user = await User.findById(employee.employeeProfile.userId).lean();
    return user;
  }

  /**
   * Get employer details (tenant owner or admin)
   */
  private async getEmployerDetails(tenantId: string, branchId: string) {
    const employer = await User.findOne({
      "assignments.tenantId": tenantId,
      "assignments.branchId": branchId,
      "assignments.role": { $in: ["admin", "tenant-owner"] },
    }).lean();

    return employer;
  }

  /**
   * Get tenant details
   */
  private async getTenantDetails(tenantId: string) {
    // This would need to be implemented based on your Tenant model
    // For now, return null
    return null;
  }

  /**
   * Record notification as sent
   */
  private async recordNotificationSent(
    document: DocumentInfo,
    notificationType: "pre_expiry" | "expired"
  ) {
    await DocumentExpiryNotificationModel.create({
      employeeId: document.employeeId,
      documentId: document.documentId,
      sectionKey: document.sectionKey,
      fieldKey: document.fieldKey,
      innerSectionKey: document.innerSectionKey,
      expiryDate: document.expiryDate,
      notificationType,
      notificationDate: new Date(),
      sentTo: {
        employee: true,
        employer: true,
      },
      emailStatus: "sent",
      tenantId: document.tenantId,
      branchId: document.branchId,
    });
  }

  /**
   * Record notification failure
   */
  private async recordNotificationFailed(
    document: DocumentInfo,
    notificationType: "pre_expiry" | "expired",
    error: any
  ) {
    await DocumentExpiryNotificationModel.create({
      employeeId: document.employeeId,
      documentId: document.documentId,
      sectionKey: document.sectionKey,
      fieldKey: document.fieldKey,
      innerSectionKey: document.innerSectionKey,
      expiryDate: document.expiryDate,
      notificationType,
      notificationDate: new Date(),
      sentTo: {
        employee: false,
        employer: false,
      },
      emailStatus: "failed",
      errorMessage: error.message,
      tenantId: document.tenantId,
      branchId: document.branchId,
    });
  }

  /**
   * Process batch concurrently with controlled concurrency
   */
  private async processBatchConcurrently<T>(
    items: T[],
    processor: (item: T) => Promise<any>,
    maxConcurrency: number
  ) {
    const results = await Promise.allSettled(
      items.map((item) => processor(item))
    );

    const processed = results.length;
    const success = results.filter(
      (r) => r.status === "fulfilled" && r.value?.success
    ).length;
    const failed = results.filter(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && !r.value?.success)
    ).length;

    return { processed, success, failed };
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

export const documentExpiryService = new DocumentExpiryService();
