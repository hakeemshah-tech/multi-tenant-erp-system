import { Types } from "mongoose";
import {
  EmployeeFieldChangeRequest,
  IEmployeeFieldChangeRequest,
} from "../database/models/employeeFieldChangeRequest.model";
import { EmployeeProfile } from "../database/models/employeeProfile.model";
import EmployeeModel from "../database/models/employee.model";
import { User } from "../database/models/user.model";
import {
  createEmployeeDataChangeNotification,
  createNotification,
} from "./notification.service";
import { logCustom } from "../audit/logger";

/**
 * Helper function to find and update a field in any inner section
 */
const findAndUpdateFieldInInnerSection = (
  obj: any,
  fieldKey: string,
  newValue: any
): boolean => {
  if (!obj || typeof obj !== "object") return false;

  // Get all inner sections (objects that are not arrays)
  const innerSections = Object.keys(obj).filter(
    (key) =>
      obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key])
  );

  // Check if this field exists in any inner section
  for (const innerSectionKey of innerSections) {
    if (obj[innerSectionKey].hasOwnProperty(fieldKey)) {
      console.log(
        `🔍 DEBUG: Field ${fieldKey} found in inner section ${innerSectionKey}`
      );
      obj[innerSectionKey][fieldKey] = newValue;
      return true;
    }
  }

  return false;
};

/**
 * Helper function to get the correct path for updating employeeFields
 */
const getEmployeeFieldsUpdatePath = (
  currentSection: any,
  sectionKey: string,
  fieldKey: string
): string => {
  if (!currentSection || typeof currentSection !== "object") {
    return `employeeFields.${sectionKey}.${fieldKey}`;
  }

  // Get all inner sections
  const innerSections = Object.keys(currentSection).filter(
    (key) =>
      currentSection[key] &&
      typeof currentSection[key] === "object" &&
      !Array.isArray(currentSection[key])
  );

  // Check if this field exists in any inner section
  for (const innerSectionKey of innerSections) {
    if (
      currentSection[innerSectionKey] &&
      currentSection[innerSectionKey].hasOwnProperty(fieldKey)
    ) {
      return `employeeFields.${sectionKey}.${innerSectionKey}.${fieldKey}`;
    }
  }

  // Field not found in inner sections, return direct path
  return `employeeFields.${sectionKey}.${fieldKey}`;
};

/**
 * Helper function to verify field value in employeeFields
 */
const getFieldValueFromEmployeeFields = (
  employeeFields: any,
  sectionKey: string,
  fieldKey: string
): any => {
  const section = employeeFields?.[sectionKey];
  if (!section || typeof section !== "object") return undefined;

  // Get all inner sections
  const innerSections = Object.keys(section).filter(
    (key) =>
      section[key] &&
      typeof section[key] === "object" &&
      !Array.isArray(section[key])
  );

  // Check if this field exists in any inner section
  for (const innerSectionKey of innerSections) {
    if (
      section[innerSectionKey] &&
      section[innerSectionKey].hasOwnProperty(fieldKey)
    ) {
      return section[innerSectionKey][fieldKey];
    }
  }

  // Field not found in inner sections, return direct field
  return section[fieldKey];
};

export interface CreateFieldChangeRequestParams {
  employeeId: string | Types.ObjectId;
  tenantId: string | Types.ObjectId;
  branchId: string | Types.ObjectId;
  sectionKey: string;
  fieldKey: string;
  fieldLabel: string;
  innerSectionKey?: string;
  oldValue: any;
  newValue: any;
  requestedBy: string | Types.ObjectId;
}

export interface GetFieldChangeRequestsParams {
  employeeId?: string | Types.ObjectId;
  tenantId?: string | Types.ObjectId;
  branchId?: string | Types.ObjectId;
  status?: "pending" | "approved" | "rejected";
  limit?: number;
  skip?: number;
}

export interface ApproveRejectParams {
  requestId: string | Types.ObjectId;
  status: "approved" | "rejected";
  rejectionReason?: string;
  reviewedBy: string | Types.ObjectId;
}

/**
 * Create a new field change request
 */
export const createFieldChangeRequest = async (
  params: CreateFieldChangeRequestParams
) => {
  const {
    employeeId,
    tenantId,
    branchId,
    sectionKey,
    fieldKey,
    fieldLabel,
    innerSectionKey,
    oldValue,
    newValue,
    requestedBy,
  } = params;

  const request = new EmployeeFieldChangeRequest({
    employeeId,
    tenantId,
    branchId,
    sectionKey,
    fieldKey,
    fieldLabel,
    innerSectionKey,
    oldValue,
    newValue,
    requestedBy,
    status: "pending",
  });

  const savedRequest = await request.save();

  // Log audit event for field change request creation
  try {
    // Get employee details for audit logging
    const employee = await EmployeeModel.findById(employeeId)
      .populate({
        path: "employeeProfile",
        populate: { path: "userId" },
      })
      .lean();

    if (employee?.employeeProfile) {
      const employeeName =
        `${employee.employeeProfile.personaldetails?.firstname || ""} ${
          employee.employeeProfile.personaldetails?.lastname || ""
        }`.trim() || "Employee";

      // Get the requester details for audit
      const requester = await User.findById(requestedBy).lean();

      // Log the field change request creation
      await logCustom({
        op: "field-change-requested",
        tenantId,
        branchId,
        subjectUserId: employee.employeeProfile.userId,
        subjectUserName: employeeName,
        aggregateType: "EmployeeFieldChangeRequest",
        aggregateId: savedRequest._id,
        summary: `Field change request created: ${fieldLabel} from "${
          oldValue || "empty"
        }" to "${newValue || "empty"}"`,
        meta: {
          requestId: savedRequest._id,
          sectionKey,
          fieldKey,
          fieldLabel,
          innerSectionKey,
          oldValue,
          newValue,
          status: "pending",
          requestedBy: requester?.fullName || "Employee",
          requestedByEmail: requester?.email,
        },
        audit: {
          actorUserId: requestedBy,
          actorEmail: requester?.email,
          actorName: requester?.fullName,
          route: "/field-change-requests",
          method: "POST",
        },
      });

      console.log(
        "📝 DEBUG: Logged audit event for field change request creation"
      );
    }
  } catch (auditError) {
    console.error("Error logging field change request audit:", auditError);
    // Don't fail the request creation if audit logging fails
  }

  // Create notification for employer about the field change request
  try {
    // Get employee details for the notification
    const employee = await EmployeeModel.findById(employeeId)
      .populate({
        path: "employeeProfile",
        populate: { path: "userId" },
      })
      .lean();

    if (employee?.employeeProfile) {
      const employeeName =
        `${employee.employeeProfile.personaldetails?.firstname || ""} ${
          employee.employeeProfile.personaldetails?.lastname || ""
        }`.trim() || "Employee";

      // Get the requester details
      const requester = await User.findById(requestedBy).lean();

      // Create a custom notification for field change requests
      const formattedOldValue = oldValue ? String(oldValue) : "empty";
      const formattedNewValue = newValue ? String(newValue) : "empty";
      const message = `${employeeName} has requested to change ${fieldLabel} from "${formattedOldValue}" to "${formattedNewValue}". Please review and approve/reject this change.`;

      // For field change requests, we don't target a specific user
      // Instead, we let employers see all field change requests in their tenant/branch
      await createNotification({
        tenantId,
        branchId,
        // No targetUserId - this will be visible to all users in the tenant/branch
        message,
        type: "field_change_request",
        metadata: {
          employeeId,
          employeeName,
          fieldChanged: `${sectionKey}.${fieldKey}`,
          fieldLabel,
          oldValue,
          newValue,
          actorUserId: requestedBy,
          actorName: requester?.fullName || "Employee",
          requestId: savedRequest._id,
        },
      });

      console.log(
        "🔔 DEBUG: Created notification for employer about field change request"
      );
    }
  } catch (notificationError) {
    console.error(
      "Error creating field change request notification:",
      notificationError
    );
    // Don't fail the request creation if notification fails
  }

  return savedRequest;
};

/**
 * Get field change requests with optional filters
 */
export const getFieldChangeRequests = async (
  params: GetFieldChangeRequestsParams = {}
) => {
  const {
    employeeId,
    tenantId,
    branchId,
    status,
    limit = 50,
    skip = 0,
  } = params;

  const filter: any = {};
  if (employeeId) filter.employeeId = employeeId;
  if (tenantId) filter.tenantId = tenantId;
  if (branchId) filter.branchId = branchId;
  if (status) filter.status = status;

  const requests = await EmployeeFieldChangeRequest.find(filter)
    .populate("requestedBy", "fullName email")
    .populate("reviewedBy", "fullName email")
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);

  const total = await EmployeeFieldChangeRequest.countDocuments(filter);

  return {
    requests,
    total,
    hasMore: skip + requests.length < total,
  };
};

/**
 * Approve or reject a field change request
 */
export const approveRejectFieldChangeRequest = async (
  params: ApproveRejectParams
) => {
  const { requestId, status, rejectionReason, reviewedBy } = params;

  console.log("🔍 DEBUG: Starting approve/reject process", {
    requestId,
    status,
    rejectionReason,
    reviewedBy,
  });

  const request = await EmployeeFieldChangeRequest.findById(requestId);
  if (!request) {
    console.log("🔍 DEBUG: Request not found with ID:", requestId);
    throw new Error("Field change request not found");
  }

  console.log("🔍 DEBUG: Found request:", {
    id: request._id,
    sectionKey: request.sectionKey,
    fieldKey: request.fieldKey,
    innerSectionKey: request.innerSectionKey,
    oldValue: request.oldValue,
    newValue: request.newValue,
    status: request.status,
  });

  if (request.status !== "pending") {
    console.log("🔍 DEBUG: Request already processed:", request.status);
    throw new Error("Request has already been processed");
  }

  request.status = status;
  request.reviewedBy = new Types.ObjectId(reviewedBy);
  request.reviewedAt = new Date();

  if (status === "rejected" && rejectionReason) {
    request.rejectionReason = rejectionReason;
  }

  // Log audit event for field change request approval/rejection
  try {
    const reviewer = await User.findById(reviewedBy).lean();

    // Get employee details for audit logging
    const employee = await EmployeeModel.findById(request.employeeId)
      .populate({
        path: "employeeProfile",
        populate: { path: "userId" },
      })
      .lean();

    if (employee?.employeeProfile) {
      const employeeName =
        `${employee.employeeProfile.personaldetails?.firstname || ""} ${
          employee.employeeProfile.personaldetails?.lastname || ""
        }`.trim() || "Employee";

      // Log the field change request approval/rejection
      await logCustom({
        op:
          status === "approved"
            ? "field-change-approved"
            : "field-change-rejected",
        tenantId: request.tenantId,
        branchId: request.branchId,
        subjectUserId: employee.employeeProfile.userId,
        subjectUserName: employeeName,
        aggregateType: "EmployeeFieldChangeRequest",
        aggregateId: request._id,
        summary: `Field change request ${status}: ${request.fieldLabel} from "${
          request.oldValue || "empty"
        }" to "${request.newValue || "empty"}"${
          status === "rejected" && rejectionReason
            ? ` (Reason: ${rejectionReason})`
            : ""
        }`,
        meta: {
          requestId: request._id,
          sectionKey: request.sectionKey,
          fieldKey: request.fieldKey,
          fieldLabel: request.fieldLabel,
          innerSectionKey: request.innerSectionKey,
          oldValue: request.oldValue,
          newValue: request.newValue,
          status,
          reviewedBy: reviewer?.fullName || "Employer",
          reviewedByEmail: reviewer?.email,
          reviewedAt: request.reviewedAt,
          rejectionReason: status === "rejected" ? rejectionReason : undefined,
        },
        audit: {
          actorUserId: reviewedBy,
          actorEmail: reviewer?.email,
          actorName: reviewer?.fullName,
          route: `/field-change-requests/${requestId}/approve-reject`,
          method: "PUT",
        },
      });

      console.log(
        `📝 DEBUG: Logged audit event for field change request ${status}`
      );
    }
  } catch (auditError) {
    console.error(
      `Error logging field change request ${status} audit:`,
      auditError
    );
    // Don't fail the approval/rejection if audit logging fails
  }

  // Create notification for the employee about the approval/rejection
  try {
    const reviewer = await User.findById(request.reviewedBy);

    // Get employee details for the notification
    const employee = await EmployeeModel.findById(request.employeeId)
      .populate({
        path: "employeeProfile",
        populate: { path: "userId" },
      })
      .lean();

    if (employee?.employeeProfile) {
      const employeeName =
        `${employee.employeeProfile.personaldetails?.firstname || ""} ${
          employee.employeeProfile.personaldetails?.lastname || ""
        }`.trim() || "Employee";

      if (status === "approved") {
        console.log("🔍 DEBUG: About to apply field change to employee");
        const updatedEmployee = await applyFieldChangeToEmployee(request);
        console.log("🔍 DEBUG: Field change applied successfully");

        // Create notification for approved change
        await createNotification({
          tenantId: request.tenantId,
          branchId: request.branchId,
          targetUserId: employee.employeeProfile.userId, // Target the employee who made the request
          message: `Your request to change ${request.fieldLabel} from "${
            request.oldValue
          }" to "${request.newValue}" has been approved by ${
            reviewer?.fullName || "your employer"
          }.`,
          type: "field_change_approved",
          metadata: {
            employeeId: request.employeeId,
            employeeName,
            fieldChanged: `${request.sectionKey}.${request.fieldKey}`,
            fieldLabel: request.fieldLabel,
            oldValue: request.oldValue,
            newValue: request.newValue,
            actorUserId: request.reviewedBy,
            actorName: reviewer?.fullName || "Employer",
            requestId: request._id,
          },
        });
      } else if (status === "rejected") {
        // Create notification for rejected change
        const rejectionMessage = rejectionReason
          ? `Your request to change ${request.fieldLabel} from "${
              request.oldValue
            }" to "${request.newValue}" has been rejected by ${
              reviewer?.fullName || "your employer"
            }. Reason: ${rejectionReason}`
          : `Your request to change ${request.fieldLabel} from "${
              request.oldValue
            }" to "${request.newValue}" has been rejected by ${
              reviewer?.fullName || "your employer"
            }.`;

        await createNotification({
          tenantId: request.tenantId,
          branchId: request.branchId,
          targetUserId: employee.employeeProfile.userId, // Target the employee who made the request
          message: rejectionMessage,
          type: "field_change_rejected",
          metadata: {
            employeeId: request.employeeId,
            employeeName,
            fieldChanged: `${request.sectionKey}.${request.fieldKey}`,
            fieldLabel: request.fieldLabel,
            oldValue: request.oldValue,
            newValue: request.newValue,
            actorUserId: request.reviewedBy,
            actorName: reviewer?.fullName || "Employer",
            requestId: request._id,
            rejectionReason,
          },
        });
      }

      console.log(`🔔 DEBUG: Created ${status} notification for employee`);
    }
  } catch (notificationError) {
    console.error(`Error creating ${status} notification:`, notificationError);
    // Don't fail the approval/rejection if notification fails
  }

  return await request.save();
};

/**
 * Apply approved field change to employee profile
 */
const applyFieldChangeToEmployee = async (
  request: IEmployeeFieldChangeRequest
) => {
  let employeeRecord: any = null;
  console.log("🔍 DEBUG: Starting field update process");
  console.log("🔍 DEBUG: Request details:", {
    employeeId: request.employeeId,
    sectionKey: request.sectionKey,
    fieldKey: request.fieldKey,
    oldValue: request.oldValue,
    newValue: request.newValue,
  });

  try {
    // First, find the Employee record to get the employeeProfile reference
    employeeRecord = await EmployeeModel.findById(request.employeeId);
    console.log("🔍 DEBUG: Employee record found:", {
      employeeId: employeeRecord?._id,
      employeeProfileId: employeeRecord?.employeeProfile,
    });

    if (!employeeRecord) {
      throw new Error("Employee record not found");
    }

    // Then find the actual EmployeeProfile using the employeeProfile reference
    const employee = await EmployeeProfile.findById(
      employeeRecord.employeeProfile
    );
    console.log("🔍 DEBUG: Employee profile found:", {
      profileId: employee?._id,
      personaldetails: employee?.personaldetails,
    });

    if (!employee) {
      throw new Error("Employee profile not found");
    }

    // Handle different section types based on the actual EmployeeProfile schema
    console.log("🔍 DEBUG: Before field update:", {
      sectionKey: request.sectionKey,
      fieldKey: request.fieldKey,
      innerSectionKey: request.innerSectionKey,
      newValue: request.newValue,
      currentValue:
        request.sectionKey === "personaldetails"
          ? employee.personaldetails?.[request.fieldKey]
          : request.innerSectionKey
            ? employee?.[request.sectionKey]?.[request.innerSectionKey]?.[
                request.fieldKey
              ]
            : "N/A",
    });

    if (request.sectionKey === "address") {
      // For address fields, update the address array
      if (!employee.address) {
        employee.address = [];
      }

      // Find the address entry to update (assuming first address for now)
      if (employee.address.length === 0) {
        employee.address.push({});
      }

      const addressEntry = employee.address[0];
      (addressEntry as any)[request.fieldKey] = request.newValue;
      console.log(
        "🔍 DEBUG: Updated address field:",
        request.fieldKey,
        "to",
        request.newValue
      );
    } else if (request.sectionKey === "personaldetails") {
      // For personal details, use helper function to find and update field in inner sections
      if (!employee.personaldetails) {
        employee.personaldetails = {};
      }

      console.log(
        "🔍 DEBUG: Checking if field exists in inner sections of personaldetails"
      );

      const fieldUpdated = findAndUpdateFieldInInnerSection(
        employee.personaldetails,
        request.fieldKey,
        request.newValue
      );

      if (!fieldUpdated) {
        // Field not found in inner sections, treat as direct field
        console.log(
          `🔍 DEBUG: Field ${request.fieldKey} not found in inner sections, treating as direct field`
        );
        (employee.personaldetails as any)[request.fieldKey] = request.newValue;
      }

      console.log(
        "🔍 DEBUG: After personaldetails update:",
        employee.personaldetails
      );
    } else if (request.sectionKey === "main") {
      // For main fields, update directly on the main object
      if (!employee.main) {
        employee.main = {};
      }

      (employee.main as any)[request.fieldKey] = request.newValue;
      console.log(
        "🔍 DEBUG: Updated main field:",
        request.fieldKey,
        "to",
        request.newValue
      );
    } else if (request.sectionKey === "documents") {
      // For document fields, update the documents object
      if (!employee.documents) {
        (employee as any).documents = {};
      }

      (employee.documents as any)[request.fieldKey] = request.newValue;
      console.log(
        "🔍 DEBUG: Updated documents field:",
        request.fieldKey,
        "to",
        request.newValue
      );
    } else if (request.innerSectionKey) {
      // For inner section fields, update the nested structure
      console.log(
        "🔍 DEBUG: This is an inner section field - updating nested structure"
      );
      console.log(
        "🔍 DEBUG: Section:",
        request.sectionKey,
        "InnerSection:",
        request.innerSectionKey,
        "Field:",
        request.fieldKey
      );

      // Initialize the section if it doesn't exist
      if (!(employee as any)[request.sectionKey]) {
        (employee as any)[request.sectionKey] = {};
      }

      // Initialize the inner section if it doesn't exist
      if (!(employee as any)[request.sectionKey][request.innerSectionKey]) {
        (employee as any)[request.sectionKey][request.innerSectionKey] = {};
      }

      // Update the field value
      (employee as any)[request.sectionKey][request.innerSectionKey][
        request.fieldKey
      ] = request.newValue;
      console.log("🔍 DEBUG: Updated inner section field:", {
        section: request.sectionKey,
        innerSection: request.innerSectionKey,
        field: request.fieldKey,
        value: request.newValue,
      });

      // Verify the update was applied to the employee object
      const updatedValue = (employee as any)[request.sectionKey]?.[
        request.innerSectionKey
      ]?.[request.fieldKey];
      console.log("🔍 DEBUG: Verification - field value after update:", {
        expected: request.newValue,
        actual: updatedValue,
        match: updatedValue === request.newValue,
      });
    } else {
      // For other sections, try to update directly on the employee object
      (employee as any)[request.fieldKey] = request.newValue;
      console.log(
        "🔍 DEBUG: Updated direct field:",
        request.fieldKey,
        "to",
        request.newValue
      );
    }

    console.log("🔍 DEBUG: About to save employee profile");
    await employee.save();
    console.log("🔍 DEBUG: Employee profile saved successfully");

    // Debug: Check the saved employee profile for inner section fields
    if (request.innerSectionKey) {
      const savedValue = (employee as any)[request.sectionKey]?.[
        request.innerSectionKey
      ]?.[request.fieldKey];
      console.log("🔍 DEBUG: After save - inner section field value:", {
        section: request.sectionKey,
        innerSection: request.innerSectionKey,
        field: request.fieldKey,
        savedValue: savedValue,
        expectedValue: request.newValue,
        match: savedValue === request.newValue,
      });
    }

    // CRITICAL FIX: Also update the employeeFields in the Employee document
    // because the frontend reads from employeeFields, not employeeProfile
    console.log("🔍 DEBUG: Updating employeeFields in the Employee document");

    // First, fetch the current Employee document to get the current additionalFields
    const currentEmployee = await EmployeeModel.findById(
      request.employeeId
    ).lean();
    if (!currentEmployee) {
      throw new Error("Employee document not found for employeeFields update");
    }

    console.log(
      "🔍 DEBUG: Current employeeFields:",
      currentEmployee.employeeFields
    );

    const employeeUpdate: any = {};

    if (request.sectionKey === "personaldetails") {
      // For personaldetails, use helper function to get the correct update path
      const currentPersonaldetails =
        currentEmployee.employeeFields?.personaldetails || {};
      const updatePath = getEmployeeFieldsUpdatePath(
        currentPersonaldetails,
        request.sectionKey,
        request.fieldKey
      );

      console.log(`🔍 DEBUG: Using update path: ${updatePath}`);
      employeeUpdate[updatePath] = request.newValue;
    } else if (request.sectionKey === "address") {
      // For address, update the specific field in the first address entry
      employeeUpdate[`employeeFields.address.0.${request.fieldKey}`] =
        request.newValue;
    } else if (request.sectionKey === "main") {
      // For main, update the specific field
      employeeUpdate[`employeeFields.main.${request.fieldKey}`] =
        request.newValue;
    } else if (request.sectionKey === "documents") {
      // For documents, update the specific field
      employeeUpdate[`employeeFields.documents.${request.fieldKey}`] =
        request.newValue;
    } else if (request.innerSectionKey) {
      // For inner section fields, we need to use a different approach for MongoDB updates
      console.log(
        "🔍 DEBUG: This is an inner section field - updating employeeFields nested structure"
      );

      // First, get the current employeeFields structure
      const currentEmployeeFields = currentEmployee.employeeFields || {};

      // Initialize the nested structure if it doesn't exist
      if (!currentEmployeeFields[request.sectionKey]) {
        currentEmployeeFields[request.sectionKey] = {};
      }
      if (!currentEmployeeFields[request.sectionKey][request.innerSectionKey]) {
        currentEmployeeFields[request.sectionKey][request.innerSectionKey] = {};
      }

      // Update the specific field
      currentEmployeeFields[request.sectionKey][request.innerSectionKey][
        request.fieldKey
      ] = request.newValue;

      // Update the entire employeeFields object
      employeeUpdate["employeeFields"] = currentEmployeeFields;

      console.log("🔍 DEBUG: EmployeeFields update for inner section:", {
        section: request.sectionKey,
        innerSection: request.innerSectionKey,
        field: request.fieldKey,
        value: request.newValue,
        updatedEmployeeFields: currentEmployeeFields,
      });
    } else {
      // For additional fields, we need to update the additionalFields array
      console.log(
        "🔍 DEBUG: This is an additional field - updating additionalFields array"
      );

      const currentAdditionalFields =
        currentEmployee.employeeFields?.additionalFields || [];
      console.log(
        "🔍 DEBUG: Current additionalFields:",
        currentAdditionalFields
      );

      // Find and update the specific additional field
      const updatedAdditionalFields = currentAdditionalFields.map(
        (field: any) => {
          if (
            field.sectionKey === request.sectionKey &&
            field.fieldKey === request.fieldKey &&
            (field.innerSectionKey || null) ===
              (request.innerSectionKey || null)
          ) {
            console.log("🔍 DEBUG: Found matching additional field:", field);
            return { ...field, value: request.newValue };
          }
          return field;
        }
      );

      console.log(
        "🔍 DEBUG: Updated additionalFields:",
        updatedAdditionalFields
      );
      employeeUpdate["employeeFields.additionalFields"] =
        updatedAdditionalFields;
    }

    console.log("🔍 DEBUG: Employee update object:", employeeUpdate);
    const updateResult = await EmployeeModel.findByIdAndUpdate(
      request.employeeId,
      employeeUpdate,
      { new: true }
    );
    console.log("🔍 DEBUG: EmployeeFields updated successfully");
    console.log("🔍 DEBUG: Updated Employee document:", {
      employeeId: updateResult?._id,
      employeeFields: updateResult?.employeeFields,
    });

    // Debug: Check the specific inner section field in employeeFields
    if (request.innerSectionKey) {
      const employeeFieldsValue =
        updateResult?.employeeFields?.[request.sectionKey]?.[
          request.innerSectionKey
        ]?.[request.fieldKey];
      console.log(
        "🔍 DEBUG: After employeeFields update - inner section field value:",
        {
          section: request.sectionKey,
          innerSection: request.innerSectionKey,
          field: request.fieldKey,
          employeeFieldsValue: employeeFieldsValue,
          expectedValue: request.newValue,
          match: employeeFieldsValue === request.newValue,
        }
      );
    }

    // Verify the specific field was updated correctly
    const verifyField = () => {
      if (request.sectionKey === "personaldetails") {
        // Use helper function to get field value
        return getFieldValueFromEmployeeFields(
          updateResult?.employeeFields,
          request.sectionKey,
          request.fieldKey
        );
      } else if (request.sectionKey === "address") {
        return updateResult?.employeeFields?.address?.[0]?.[request.fieldKey];
      } else if (request.sectionKey === "main") {
        return updateResult?.employeeFields?.main?.[request.fieldKey];
      } else if (request.sectionKey === "documents") {
        return updateResult?.employeeFields?.documents?.[request.fieldKey];
      } else if (request.innerSectionKey) {
        // For inner section fields, access the nested structure
        return updateResult?.employeeFields?.[request.sectionKey]?.[
          request.innerSectionKey
        ]?.[request.fieldKey];
      } else {
        // For additional fields, search in the additionalFields array
        const additionalFields =
          updateResult?.employeeFields?.additionalFields || [];
        const foundField = additionalFields.find(
          (field: any) =>
            field.sectionKey === request.sectionKey &&
            field.fieldKey === request.fieldKey &&
            (field.innerSectionKey || null) ===
              (request.innerSectionKey || null)
        );
        return foundField?.value;
      }
    };

    const verifiedValue = verifyField();
    console.log("🔍 DEBUG: Field verification:", {
      sectionKey: request.sectionKey,
      fieldKey: request.fieldKey,
      expectedValue: request.newValue,
      actualValue: verifiedValue,
      match: verifiedValue === request.newValue,
    });

    // Verify the save worked
    const savedEmployee = await EmployeeProfile.findById(employee._id);
    console.log("🔍 DEBUG: Verified saved employee:", {
      profileId: savedEmployee?._id,
      personaldetails: savedEmployee?.personaldetails,
    });

    return employee; // Return the updated employee for notification purposes
  } catch (error) {
    console.error("Error applying field change to employee:", error);
    console.error("Request details:", {
      employeeId: request.employeeId,
      employeeProfileId: employeeRecord?.employeeProfile,
      sectionKey: request.sectionKey,
      fieldKey: request.fieldKey,
      newValue: request.newValue,
    });
    throw new Error("Failed to apply field change to employee profile");
  }
};

/**
 * Get pending requests count for an employee
 */
export const getPendingRequestsCount = async (
  employeeId: string | Types.ObjectId,
  tenantId?: string | Types.ObjectId,
  branchId?: string | Types.ObjectId
) => {
  const filter: any = { employeeId, status: "pending" };
  if (tenantId) filter.tenantId = tenantId;
  if (branchId) filter.branchId = branchId;

  return await EmployeeFieldChangeRequest.countDocuments(filter);
};

/**
 * Delete old processed requests (cleanup)
 */
export const deleteOldProcessedRequests = async (daysOld: number = 30) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await EmployeeFieldChangeRequest.deleteMany({
    status: { $in: ["approved", "rejected"] },
    reviewedAt: { $lt: cutoffDate },
  });

  return result;
};
