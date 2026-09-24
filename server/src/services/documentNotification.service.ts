import { Types } from "mongoose";
import {
  createNotification,
  CreateNotificationParams,
} from "./notification.service";
import { User } from "../database/models/user.model";
import EmployeeModel from "../database/models/employee.model";

/**
 * Document Notification Service
 * Handles all document-related notifications for employers and employees
 */
export class DocumentNotificationService {
  /**
   * Get document type from field key
   */
  private getDocumentTypeFromField(fieldKey: string): string {
    const typeMap: { [key: string]: string } = {
      passport: "Passport",
      driverslicense: "Driver's License",
      nationalid: "National ID",
      birthcertificate: "Birth Certificate",
      cpr: "CPR Certificate",
      firstaid: "First Aid Certificate",
      policeclearancecertificate: "Police Clearance Certificate",
      ndisscreensingcheck: "NDIS Screening Check",
      covid19vaccinationcertificate: "COVID-19 Vaccination Certificate",
      workpermit: "Work Permit",
      visa: "Visa",
      // Add more mappings as needed
    };

    return typeMap[fieldKey] || fieldKey.replace(/([A-Z])/g, " $1").trim();
  }

  /**
   * Get employee details by employee ID
   */
  private async getEmployeeDetails(employeeId: string) {
    const employee = await EmployeeModel.findById(employeeId)
      .populate("employeeProfile", "userId")
      .lean();

    if (
      !employee?.employeeProfile ||
      !(employee.employeeProfile as any)?.userId
    ) {
      return null;
    }

    const user = await User.findById(
      (employee.employeeProfile as any).userId
    ).lean();
    return user;
  }

  /**
   * Get all employers (admins and tenant-owners) for a tenant/branch
   */
  private async getEmployersForTenant(tenantId: string, branchId: string) {
    const employers = await User.find({
      "assignments.tenantId": tenantId,
      "assignments.branchId": branchId,
      "assignments.role": { $in: ["admin", "tenant-owner"] },
    }).lean();

    return employers;
  }

  /**
   * Create notification for document upload/update by employee
   */
  async createDocumentUpdateNotification(params: {
    employeeId: string;
    tenantId: string;
    branchId: string;
    sectionKey: string;
    fieldKey: string;
    innerSectionKey?: string;
    documentId?: string;
    uploadedBy: string;
    isUpdate?: boolean; // true for updates, false for new uploads
  }) {
    try {
      const {
        employeeId,
        tenantId,
        branchId,
        sectionKey,
        fieldKey,
        innerSectionKey,
        documentId,
        uploadedBy,
        isUpdate = false,
      } = params;

      // Get employee details
      const employee = await this.getEmployeeDetails(employeeId);
      if (!employee) {
        console.error(`Employee not found for ID: ${employeeId}`);
        return;
      }

      // Get all employers for this tenant/branch
      const employers = await this.getEmployersForTenant(tenantId, branchId);
      if (employers.length === 0) {
        console.log(
          `No employers found for tenant ${tenantId}, branch ${branchId}`
        );
        return;
      }

      const documentType = this.getDocumentTypeFromField(fieldKey);
      const action = isUpdate ? "updated" : "uploaded";
      const notificationType = isUpdate
        ? "document_updated"
        : "document_uploaded";

      // Create notifications for all employers
      const notificationPromises = employers.map((employer) => {
        const message = `${employee.fullName} has ${action} ${documentType} document. Please check and approve.`;

        return createNotification({
          tenantId,
          branchId,
          targetUserId: employer._id,
          message,
          type: notificationType,
          metadata: {
            employeeId,
            employeeName: employee.fullName,
            fieldChanged: documentType,
            fieldLabel: documentType,
            actorUserId: uploadedBy,
            actorName: employee.fullName,
            documentType,
            sectionKey,
            fieldKey,
            innerSectionKey,
            documentId,
            newStatus: "pendingToApprove",
          },
        });
      });

      await Promise.allSettled(notificationPromises);

      console.log(
        `✅ Document ${action} notifications created for ${employers.length} employers`
      );
    } catch (error) {
      console.error("❌ Error creating document update notification:", error);
    }
  }

  /**
   * Create notification for document approval/rejection by employer
   */
  async createDocumentApprovalNotification(params: {
    employeeId: string;
    tenantId: string;
    branchId: string;
    sectionKey: string;
    fieldKey: string;
    innerSectionKey?: string;
    documentId?: string;
    status: "approved" | "rejected";
    reviewedBy: string;
    rejectionReason?: string;
  }) {
    try {
      const {
        employeeId,
        tenantId,
        branchId,
        sectionKey,
        fieldKey,
        innerSectionKey,
        documentId,
        status,
        reviewedBy,
        rejectionReason,
      } = params;

      // Get employee details
      const employee = await this.getEmployeeDetails(employeeId);
      if (!employee) {
        console.error(`Employee not found for ID: ${employeeId}`);
        return;
      }

      // Get reviewer details
      const reviewer = await User.findById(reviewedBy).lean();
      if (!reviewer) {
        console.error(`Reviewer not found for ID: ${reviewedBy}`);
        return;
      }

      const documentType = this.getDocumentTypeFromField(fieldKey);
      const notificationType =
        status === "approved" ? "document_approved" : "document_rejected";

      let message: string;
      if (status === "approved") {
        message = `Your ${documentType} document has been approved by ${reviewer.fullName}.`;
      } else {
        const reasonText = rejectionReason ? ` Reason: ${rejectionReason}` : "";
        message = `Your ${documentType} document has been rejected by ${reviewer.fullName}.${reasonText}`;
      }

      // Create notification for the employee
      await createNotification({
        tenantId,
        branchId,
        targetUserId: employee._id,
        message,
        type: notificationType,
        metadata: {
          employeeId,
          employeeName: employee.fullName,
          fieldChanged: documentType,
          fieldLabel: documentType,
          actorUserId: reviewedBy,
          actorName: reviewer.fullName,
          documentType,
          sectionKey,
          fieldKey,
          innerSectionKey,
          documentId,
          newStatus: status,
          rejectionReason,
        },
      });

      console.log(
        `✅ Document ${status} notification created for employee ${employee.fullName}`
      );
    } catch (error) {
      console.error("❌ Error creating document approval notification:", error);
    }
  }

  /**
   * Create notification for document expiry
   */
  async createDocumentExpiryNotification(params: {
    employeeId: string;
    tenantId: string;
    branchId: string;
    sectionKey: string;
    fieldKey: string;
    innerSectionKey?: string;
    documentId?: string;
    expiryDate: Date;
  }) {
    try {
      const {
        employeeId,
        tenantId,
        branchId,
        sectionKey,
        fieldKey,
        innerSectionKey,
        documentId,
        expiryDate,
      } = params;

      // Get employee details
      const employee = await this.getEmployeeDetails(employeeId);
      if (!employee) {
        console.error(`Employee not found for ID: ${employeeId}`);
        return;
      }

      // Get all employers for this tenant/branch
      const employers = await this.getEmployersForTenant(tenantId, branchId);
      if (employers.length === 0) {
        console.log(
          `No employers found for tenant ${tenantId}, branch ${branchId}`
        );
        return;
      }

      const documentType = this.getDocumentTypeFromField(fieldKey);
      const message = `${
        employee.fullName
      }'s ${documentType} document has expired on ${expiryDate.toLocaleDateString()}.`;

      // Create notifications for all employers
      const notificationPromises = employers.map((employer) => {
        return createNotification({
          tenantId,
          branchId,
          targetUserId: employer._id,
          message,
          type: "document_expired",
          metadata: {
            employeeId,
            employeeName: employee.fullName,
            fieldChanged: documentType,
            fieldLabel: documentType,
            documentType,
            sectionKey,
            fieldKey,
            innerSectionKey,
            documentId,
            newStatus: "expired",
          },
        });
      });

      await Promise.allSettled(notificationPromises);

      console.log(
        `✅ Document expiry notifications created for ${employers.length} employers`
      );
    } catch (error) {
      console.error("❌ Error creating document expiry notification:", error);
    }
  }

  /**
   * Create notification for document status change (bulk operation)
   */
  async createBulkDocumentStatusNotification(params: {
    employeeId: string;
    tenantId: string;
    branchId: string;
    documents: Array<{
      sectionKey: string;
      fieldKey: string;
      innerSectionKey?: string;
      documentId?: string;
      status: string;
    }>;
    reviewedBy: string;
    rejectionReason?: string;
  }) {
    try {
      const {
        employeeId,
        tenantId,
        branchId,
        documents,
        reviewedBy,
        rejectionReason,
      } = params;

      // Get employee details
      const employee = await this.getEmployeeDetails(employeeId);
      if (!employee) {
        console.error(`Employee not found for ID: ${employeeId}`);
        return;
      }

      // Get reviewer details
      const reviewer = await User.findById(reviewedBy).lean();
      if (!reviewer) {
        console.error(`Reviewer not found for ID: ${reviewedBy}`);
        return;
      }

      // Group documents by status
      const approvedDocs = documents.filter((doc) => doc.status === "approved");
      const rejectedDocs = documents.filter((doc) => doc.status === "rejected");

      // Create notification for approved documents
      if (approvedDocs.length > 0) {
        const documentTypes = approvedDocs.map((doc) =>
          this.getDocumentTypeFromField(doc.fieldKey)
        );
        const message = `Your ${documentTypes.join(", ")} document${
          documentTypes.length > 1 ? "s have" : " has"
        } been approved by ${reviewer.fullName}.`;

        await createNotification({
          tenantId,
          branchId,
          targetUserId: employee._id,
          message,
          type: "document_approved",
          metadata: {
            employeeId,
            employeeName: employee.fullName,
            fieldChanged: documentTypes.join(", "),
            fieldLabel: documentTypes.join(", "),
            actorUserId: reviewedBy,
            actorName: reviewer.fullName,
            documentType: documentTypes.join(", "),
            newStatus: "approved",
          },
        });
      }

      // Create notification for rejected documents
      if (rejectedDocs.length > 0) {
        const documentTypes = rejectedDocs.map((doc) =>
          this.getDocumentTypeFromField(doc.fieldKey)
        );
        const reasonText = rejectionReason ? ` Reason: ${rejectionReason}` : "";
        const message = `Your ${documentTypes.join(", ")} document${
          documentTypes.length > 1 ? "s have" : " has"
        } been rejected by ${reviewer.fullName}.${reasonText}`;

        await createNotification({
          tenantId,
          branchId,
          targetUserId: employee._id,
          message,
          type: "document_rejected",
          metadata: {
            employeeId,
            employeeName: employee.fullName,
            fieldChanged: documentTypes.join(", "),
            fieldLabel: documentTypes.join(", "),
            actorUserId: reviewedBy,
            actorName: reviewer.fullName,
            documentType: documentTypes.join(", "),
            newStatus: "rejected",
            rejectionReason,
          },
        });
      }

      console.log(
        `✅ Bulk document status notifications created for employee ${employee.fullName}`
      );
    } catch (error) {
      console.error(
        "❌ Error creating bulk document status notification:",
        error
      );
    }
  }
}

export const documentNotificationService = new DocumentNotificationService();
