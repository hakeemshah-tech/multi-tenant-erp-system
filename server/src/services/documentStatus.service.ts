import EmployeeModel from "../database/models/employee.model";
import { createNotification } from "./notification.service";
import { logCustom } from "../audit/logger";
import { User } from "../database/models/user.model";
import { documentHistoryService } from "./documentHistory.service";
import mongoose from "mongoose";

export interface CreateDocumentStatusParams {
  employeeId: string;
  documentType: string;
  documentId: string;
  sectionKey: string;
  fieldKey: string;
  uploadedBy: string;
  tenantId: string;
  branchId: string;
  expiryDate?: Date;
  metadata?: {
    originalFileName?: string;
    fileSize?: number;
    mimeType?: string;
    uploadDate?: Date;
  };
}

export interface UpdateDocumentStatusParams {
  employeeId: string;
  sectionKey: string;
  fieldKey: string;
  status: "approved" | "rejected";
  reviewedBy: string;
  rejectionReason?: string;
}

export interface GetDocumentStatusParams {
  employeeId?: string;
  tenantId?: string;
  branchId?: string;
  status?: string;
  documentType?: string;
  page?: number;
  limit?: number;
}

export interface DocumentStatusInfo {
  employeeId: string;
  documentType: string;
  documentId: string;
  sectionKey: string;
  fieldKey: string;
  status: "pendingToApprove" | "approved" | "rejected" | "expired";
  uploadedBy: {
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
  reviewedAt?: Date;
  rejectionReason?: string;
  expiryDate?: Date;
  metadata?: {
    originalFileName?: string;
    fileSize?: number;
    mimeType?: string;
    uploadDate?: Date;
    previousStatus?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class DocumentStatusService {
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
  async createDocumentStatus(
    params: CreateDocumentStatusParams
  ): Promise<DocumentStatusInfo> {
    const {
      employeeId,
      documentType,
      documentId,
      sectionKey,
      fieldKey,
      uploadedBy,
      tenantId,
      branchId,
      expiryDate,
      metadata,
    } = params;

    // First, find the employee to determine the correct inner section
    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) {
      throw new Error("Employee not found");
    }

    // Find the correct inner section for documents
    let updatePath = `employeeFields.${sectionKey}.${fieldKey}`;

    if (sectionKey === "documents") {
      const innerSections = [
        "identificationdocuments",
        "certificates",
        "checksandclearance",
      ];

      let foundInnerSection = null;
      for (const innerSection of innerSections) {
        if (employee.employeeFields?.documents?.[innerSection]?.[fieldKey]) {
          foundInnerSection = innerSection;
          break;
        }
      }

      if (!foundInnerSection) {
        throw new Error(`Document field ${fieldKey} not found in any section`);
      }

      updatePath = `employeeFields.${sectionKey}.${foundInnerSection}.${fieldKey}`;
    }

    const updateData = {
      [`${updatePath}.fileId`]: new mongoose.Types.ObjectId(documentId),
      [`${updatePath}.key`]: documentId, // Using documentId as key for now, can be updated if needed
      [`${updatePath}.status`]: "pendingToApprove",
      [`${updatePath}.uploadedBy`]: new mongoose.Types.ObjectId(uploadedBy),
      [`${updatePath}.reviewedBy`]: undefined,
      [`${updatePath}.reviewedAt`]: undefined,
      [`${updatePath}.rejectionReason`]: undefined,
      [`${updatePath}.expiryDate`]: expiryDate,
      [`${updatePath}.metadata`]: {
        ...metadata,
        uploadDate: new Date(),
      },
    };

    const updatedEmployee = await EmployeeModel.findByIdAndUpdate(
      employeeId,
      updateData,
      { new: true }
    );

    if (!updatedEmployee) {
      throw new Error("Employee not found");
    }

    // Create notification for employer
    await this.createDocumentUploadNotification({
      employeeId,
      documentType,
      sectionKey,
      fieldKey,
      tenantId,
      branchId,
      uploadedBy,
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
        documentType,
        sectionKey,
        fieldKey,
        status: "pendingToApprove",
      },
    });

    // Return the document status info
    const documentData = await this.getDocumentFromEmployee(
      updatedEmployee,
      sectionKey,
      fieldKey
    );
    return {
      employeeId,
      documentType,
      documentId,
      sectionKey,
      fieldKey,
      status: documentData.status,
      uploadedBy: documentData.uploadedBy,
      reviewedBy: documentData.reviewedBy,
      reviewedAt: documentData.reviewedAt,
      rejectionReason: documentData.rejectionReason,
      expiryDate: documentData.expiryDate,
      metadata: documentData.metadata,
      createdAt: updatedEmployee.createdAt,
      updatedAt: updatedEmployee.updatedAt,
    };
  }

  async updateDocumentStatus(
    params: UpdateDocumentStatusParams
  ): Promise<DocumentStatusInfo> {
    const {
      employeeId,
      sectionKey,
      fieldKey,
      status,
      reviewedBy,
      rejectionReason,
    } = params;

    // First, find the employee to determine the correct inner section
    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) {
      throw new Error("Employee not found");
    }

    // Find the correct inner section for documents and get previous status
    let updatePath = `employeeFields.${sectionKey}.${fieldKey}`;
    let previousStatus = "pendingToApprove"; // Default fallback

    if (sectionKey === "documents") {
      const innerSections = [
        "identificationdocuments",
        "certificates",
        "checksandclearance",
      ];

      let foundInnerSection = null;
      for (const innerSection of innerSections) {
        if (employee.employeeFields?.documents?.[innerSection]?.[fieldKey]) {
          foundInnerSection = innerSection;
          // Get the previous status before updating
          previousStatus =
            employee.employeeFields.documents[innerSection][fieldKey].status ||
            "pendingToApprove";
          break;
        }
      }

      if (!foundInnerSection) {
        throw new Error(`Document field ${fieldKey} not found in any section`);
      }

      updatePath = `employeeFields.${sectionKey}.${foundInnerSection}.${fieldKey}`;
    } else {
      // For non-documents sections, get the previous status
      const documentData = employee.employeeFields?.[sectionKey]?.[fieldKey];
      if (documentData && documentData.status) {
        previousStatus = documentData.status;
      }
    }

    const updateData = {
      [`${updatePath}.status`]: status,
      [`${updatePath}.reviewedBy`]: new mongoose.Types.ObjectId(reviewedBy),
      [`${updatePath}.reviewedAt`]: new Date(),
      [`${updatePath}.rejectionReason`]:
        status === "rejected" ? rejectionReason : undefined,
    };

    const updatedEmployee = await EmployeeModel.findByIdAndUpdate(
      employeeId,
      updateData,
      { new: true }
    );

    if (!updatedEmployee) {
      throw new Error("Employee not found");
    }

    // Create notification for employee
    await this.createDocumentReviewNotification({
      employeeId,
      sectionKey,
      fieldKey,
      status,
      rejectionReason,
      tenantId: updatedEmployee.tenantId.toString(),
      branchId: updatedEmployee.branchId.toString(),
    });

    // Log audit event
    const [actorDetails, employeeDetails] = await Promise.all([
      this.getUserDetailsForAudit(reviewedBy),
      this.getEmployeeDetailsForAudit(employeeId),
    ]);

    await logCustom({
      op: `document-${status}`,
      aggregateType: "Employee",
      aggregateId: employeeId,
      subjectUserId: employeeDetails.subjectUserId,
      subjectUserName: employeeDetails.subjectUserName,
      tenantId: updatedEmployee.tenantId.toString(),
      branchId: updatedEmployee.branchId.toString(),
      summary: `Document ${status}: ${fieldKey}`,
      audit: {
        actorUserId: actorDetails.actorUserId,
        actorEmail: actorDetails.actorEmail,
        actorName: actorDetails.actorName,
      },
      meta: {
        sectionKey,
        fieldKey,
        status,
        rejectionReason,
      },
    });

    // Return the document status info
    const documentData = await this.getDocumentFromEmployee(
      updatedEmployee,
      sectionKey,
      fieldKey
    );
    return {
      employeeId,
      documentType: this.getDocumentTypeFromField(fieldKey),
      documentId: documentData.fileId?.toString() || "",
      sectionKey,
      fieldKey,
      status: documentData.status,
      uploadedBy: documentData.uploadedBy,
      reviewedBy: documentData.reviewedBy,
      reviewedAt: documentData.reviewedAt,
      rejectionReason: documentData.rejectionReason,
      expiryDate: documentData.expiryDate,
      metadata: documentData.metadata,
      createdAt: updatedEmployee.createdAt,
      updatedAt: updatedEmployee.updatedAt,
    };
  }

  async getDocumentStatuses(params: GetDocumentStatusParams) {
    const {
      employeeId,
      tenantId,
      branchId,
      status,
      documentType,
      page = 1,
      limit = 10,
    } = params;

    const query: any = {};

    if (employeeId) query._id = new mongoose.Types.ObjectId(employeeId);
    if (tenantId) query.tenantId = new mongoose.Types.ObjectId(tenantId);
    if (branchId) query.branchId = new mongoose.Types.ObjectId(branchId);

    const skip = (page - 1) * limit;

    // Fetch documents from employee model - include employees with either documents or additionalFields
    const employees = await EmployeeModel.find({
      ...query,
      $or: [
        { "employeeFields.documents": { $exists: true } },
        { "employeeFields.additionalFields": { $exists: true } },
      ],
    })
      .populate("employeeProfile", "userId")
      .populate("employeeProfile.userId", "firstName lastName email")
      .skip(skip)
      .limit(limit)
      .sort({ updatedAt: -1 });

    // Extract document statuses from employee documents
    const documentStatuses: DocumentStatusInfo[] = [];

    for (const employee of employees) {
      const docs = await this.extractDocumentStatusesFromEmployee(employee);
      documentStatuses.push(...docs);
    }

    // Filter by status and documentType if provided
    let filteredDocs = documentStatuses;
    if (status) {
      filteredDocs = filteredDocs.filter((doc) => doc.status === status);
    }
    if (documentType) {
      filteredDocs = filteredDocs.filter(
        (doc) => doc.documentType === documentType
      );
    }

    // Sort by updatedAt
    filteredDocs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return {
      documentStatuses: filteredDocs,
      total: filteredDocs.length,
      page,
      limit,
      totalPages: Math.ceil(filteredDocs.length / limit),
    };
  }

  async getDocumentStatusById(
    employeeId: string,
    sectionKey: string,
    fieldKey: string
  ): Promise<DocumentStatusInfo | null> {
    const employee = await EmployeeModel.findById(employeeId)
      .populate("employeeProfile", "userId")
      .populate("employeeProfile.userId", "firstName lastName email");

    if (!employee) return null;

    const documentData = await this.getDocumentFromEmployee(
      employee,
      sectionKey,
      fieldKey
    );

    if (!documentData) return null;

    return {
      employeeId,
      documentType: this.getDocumentTypeFromField(fieldKey),
      documentId: documentData.fileId?.toString() || "",
      sectionKey,
      fieldKey,
      status: documentData.status,
      uploadedBy: documentData.uploadedBy,
      reviewedBy: documentData.reviewedBy,
      reviewedAt: documentData.reviewedAt,
      rejectionReason: documentData.rejectionReason,
      expiryDate: documentData.expiryDate,
      metadata: documentData.metadata,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }

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

    // Count pending documents from employee model - include employees with either documents or additionalFields
    const employees = await EmployeeModel.find({
      ...query,
      $or: [
        { "employeeFields.documents": { $exists: true } },
        { "employeeFields.additionalFields": { $exists: true } },
      ],
    });
    let count = 0;

    for (const employee of employees) {
      const docs = await this.extractDocumentStatusesFromEmployee(employee);
      count += docs.filter((doc) => doc.status === "pendingToApprove").length;
    }

    return count;
  }

  async markExpiredDocuments(): Promise<number> {
    const now = new Date();
    let modifiedCount = 0;

    // Find all employees with documents that have expiry dates
    const employees = await EmployeeModel.find({
      $or: [
        { "employeeFields.documents": { $exists: true } },
        { "employeeFields.additionalFields": { $exists: true } },
      ],
    });

    for (const employee of employees) {
      const updateData: any = {};
      let hasUpdates = false;

      // Check main document sections
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

      // Check additional fields
      if (employee.employeeFields?.additionalFields) {
        for (
          let i = 0;
          i < employee.employeeFields.additionalFields.length;
          i++
        ) {
          const additionalField = employee.employeeFields.additionalFields[i];
          if (
            additionalField.value &&
            typeof additionalField.value === "object" &&
            "expiryDate" in additionalField.value
          ) {
            const docData = additionalField.value;
            if (
              docData.expiryDate &&
              docData.expiryDate < now &&
              (docData.status === "approved" ||
                docData.status === "pendingToApprove")
            ) {
              updateData[`employeeFields.additionalFields.${i}.value.status`] =
                "expired";
              updateData[
                `employeeFields.additionalFields.${i}.value.metadata.previousStatus`
              ] = docData.status;
              hasUpdates = true;
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

  private async getDocumentFromEmployee(
    employee: any,
    sectionKey: string,
    fieldKey: string
  ) {
    const section = employee.employeeFields?.[sectionKey];
    let documentData = null;

    if (sectionKey === "documents") {
      // Handle nested document structure
      const innerSections = [
        "identificationdocuments",
        "certificates",
        "checksandclearance",
      ];
      for (const innerSection of innerSections) {
        if (section?.[innerSection]?.[fieldKey]) {
          documentData = section[innerSection][fieldKey];
          break;
        }
      }
    } else if (section) {
      // Handle other sections like personaldetails
      documentData = section[fieldKey];
    }

    // If not found in main sections, check additional fields
    if (!documentData && employee.employeeFields?.additionalFields) {
      const additionalField = employee.employeeFields.additionalFields.find(
        (field: any) =>
          field.sectionKey === sectionKey && field.fieldKey === fieldKey
      );

      if (additionalField && additionalField.value) {
        documentData = additionalField.value;
      }
    }

    if (!documentData) return null;

    // Populate user data if needed
    if (
      documentData.uploadedBy &&
      typeof documentData.uploadedBy === "object" &&
      documentData.uploadedBy._id
    ) {
      // Already populated
    } else if (documentData.uploadedBy) {
      // Need to populate
      const { User } = await import("../database/models/user.model");
      const uploadedByUser = await User.findById(documentData.uploadedBy);
      if (uploadedByUser) {
        documentData.uploadedBy = {
          _id: uploadedByUser._id,
          firstName: uploadedByUser.fullName.split(" ")[0] || "",
          lastName: uploadedByUser.fullName.split(" ").slice(1).join(" ") || "",
          email: uploadedByUser.email,
        };
      }
    }

    if (
      documentData.reviewedBy &&
      typeof documentData.reviewedBy === "object" &&
      documentData.reviewedBy._id
    ) {
      // Already populated
    } else if (documentData.reviewedBy) {
      // Need to populate
      const { User } = await import("../database/models/user.model");
      const reviewedByUser = await User.findById(documentData.reviewedBy);
      if (reviewedByUser) {
        documentData.reviewedBy = {
          _id: reviewedByUser._id,
          firstName: reviewedByUser.fullName.split(" ")[0] || "",
          lastName: reviewedByUser.fullName.split(" ").slice(1).join(" ") || "",
          email: reviewedByUser.email,
        };
      }
    }

    return documentData;
  }

  private async extractDocumentStatusesFromEmployee(
    employee: any
  ): Promise<DocumentStatusInfo[]> {
    const statuses: DocumentStatusInfo[] = [];

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

    // Extract from main document sections
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
              "fileId" in fieldData
            ) {
              const docData = fieldData as any;
              const uploadedByData = await populateUserData(docData.uploadedBy);
              statuses.push({
                employeeId: employee._id.toString(),
                documentType: this.getDocumentTypeFromField(fieldKey),
                documentId: docData.fileId?.toString() || "",
                sectionKey: "documents",
                fieldKey,
                status: docData.status || "pendingToApprove",
                uploadedBy: uploadedByData,
                reviewedBy: docData.reviewedBy,
                reviewedAt: docData.reviewedAt,
                rejectionReason: docData.rejectionReason,
                expiryDate: docData.expiryDate,
                metadata: docData.metadata,
                createdAt: employee.createdAt,
                updatedAt: employee.updatedAt,
              });
            }
          }
        }
      }
    }

    // Extract from additional fields
    if (employee.employeeFields?.additionalFields) {
      for (const additionalField of employee.employeeFields.additionalFields) {
        if (
          additionalField.value &&
          typeof additionalField.value === "object" &&
          "fileId" in additionalField.value
        ) {
          const docData = additionalField.value;
          const uploadedByData = await populateUserData(docData.uploadedBy);
          statuses.push({
            employeeId: employee._id.toString(),
            documentType: this.getDocumentTypeFromField(
              additionalField.fieldKey
            ),
            documentId: docData.fileId?.toString() || "",
            sectionKey: additionalField.sectionKey,
            fieldKey: additionalField.fieldKey,
            status: docData.status || "pendingToApprove",
            uploadedBy: uploadedByData,
            reviewedBy: docData.reviewedBy,
            reviewedAt: docData.reviewedAt,
            rejectionReason: docData.rejectionReason,
            expiryDate: docData.expiryDate,
            metadata: docData.metadata,
            createdAt: employee.createdAt,
            updatedAt: employee.updatedAt,
          });
        }
      }
    }

    return statuses;
  }

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
    };

    return typeMap[fieldKey] || fieldKey;
  }

  private async createDocumentUploadNotification(params: {
    employeeId: string;
    documentType: string;
    sectionKey: string;
    fieldKey: string;
    tenantId: string;
    branchId: string;
    uploadedBy: string;
  }) {
    try {
      // Get employee details for notification
      const employee = await EmployeeModel.findById(params.employeeId)
        .populate("employeeProfile", "userId")
        .populate("employeeProfile.userId", "firstName lastName");

      if (!employee?.employeeProfile) return;

      const employeeName = `${
        (employee.employeeProfile as any).userId?.firstName
      } ${(employee.employeeProfile as any).userId?.lastName}`;

      await createNotification({
        type: "other",
        message: `${employeeName} has uploaded a new ${params.documentType} document for review.`,
        tenantId: params.tenantId,
        branchId: params.branchId,
        metadata: {
          employeeId: params.employeeId,
          fieldChanged: params.fieldKey,
          fieldLabel: params.documentType,
        },
      });
    } catch (error) {
      console.error("Error creating document upload notification:", error);
    }
  }

  private async createDocumentReviewNotification(params: {
    employeeId: string;
    sectionKey: string;
    fieldKey: string;
    status: string;
    rejectionReason?: string;
    tenantId: string;
    branchId: string;
  }) {
    try {
      const statusMessage =
        params.status === "approved" ? "approved" : "rejected";
      const documentType = this.getDocumentTypeFromField(params.fieldKey);

      const rejectionText =
        params.status === "rejected" && params.rejectionReason
          ? ` Reason: ${params.rejectionReason}`
          : "";

      await createNotification({
        type: "other",
        message: `Your ${documentType} document has been ${statusMessage}.${rejectionText}`,
        tenantId: params.tenantId,
        branchId: params.branchId,
        targetUserId: params.employeeId,
        metadata: {
          employeeId: params.employeeId,
          fieldChanged: params.fieldKey,
          fieldLabel: documentType,
          rejectionReason: params.rejectionReason,
        },
      });
    } catch (error) {
      console.error("Error creating document review notification:", error);
    }
  }

  /**
   * Helper method to get the inner section key for documents
   */
  private getInnerSectionKey(
    employee: any,
    fieldKey: string
  ): string | undefined {
    const innerSections = [
      "identificationdocuments",
      "certificates",
      "checksandclearance",
    ];

    for (const innerSection of innerSections) {
      if (employee.employeeFields?.documents?.[innerSection]?.[fieldKey]) {
        return innerSection;
      }
    }
    return undefined;
  }
}
