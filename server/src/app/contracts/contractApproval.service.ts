import { Types } from "mongoose";
import {
  ContractApproval,
  IContractApproval,
  IEmployeeApproval,
} from "@/database/models/contractApproval.model";
import EmployeeModel from "@/database/models/employee.model";
import { EmployeeProfile } from "@/database/models/employeeProfile.model";
import { ContractTemplate } from "@/database/models/contractTemplate.model";
import { Tenant } from "@/database/models/tenant.model";
import { Branch } from "@/database/models/branch.model";
import { User } from "@/database/models/user.model";
import { createNotification } from "@/services/notification.service";
import { emailService } from "@/services/email.service";
import { ContractSnapshot } from "@/database/models/contractSnapshot.model";
import { Designation } from "@/database/models/designation.model";

// Migration function to handle old collection name
export async function migrateContractApprovalCollection() {
  try {
    const db = ContractApproval.db;
    const collections = await db.listCollections().toArray();
    const oldCollectionName = "contract_template_approvals";
    const newCollectionName = "contract_approvals";

    const oldCollectionExists = collections.some(
      (c) => c.name === oldCollectionName
    );
    const newCollectionExists = collections.some(
      (c) => c.name === newCollectionName
    );

    if (oldCollectionExists && !newCollectionExists) {
      console.log(
        `[CONTRACT APPROVAL] Renaming collection from ${oldCollectionName} to ${newCollectionName}`
      );
      await db.collection(oldCollectionName).rename(newCollectionName);
      console.log(`[CONTRACT APPROVAL] Collection renamed successfully`);
    }
  } catch (error: any) {
    console.warn(
      "[CONTRACT APPROVAL] Migration warning (non-critical):",
      error.message
    );
  }
}

export interface SendApprovalParams {
  templateId: Types.ObjectId;
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  employees: Array<{
    employeeId: string;
    requireSignature: boolean;
    signatureType?: "typed" | "drawn" | "upload";
  }>;
  templateTitle: string;
  applicantId: Types.ObjectId; // The employee whose contract is being sent for approval
  selfSignRequired?: boolean; // Whether sender needs to sign
  senderUserId?: Types.ObjectId; // The user who sent the approval
}

export async function sendApprovalRequests(
  params: SendApprovalParams
): Promise<IContractApproval> {
  const {
    templateId,
    tenantId,
    branchId,
    employees,
    templateTitle,
    applicantId,
    selfSignRequired,
    senderUserId,
  } = params;

  if (!applicantId) {
    throw new Error("applicantId is required for contract approval tracking");
  }

  // Check if approval document already exists for this template+applicant combination
  let approvalDoc = await ContractApproval.findOne({
    templateId,
    applicantId,
    tenantId,
    branchId,
  });

  // Prepare employee approvals array
  const employeeApprovalsToAdd: IEmployeeApproval[] = [];
  const existingEmployeeIds = new Set<string>();

  if (approvalDoc) {
    // Get existing employee IDs to avoid duplicates
    approvalDoc.employeeApprovals.forEach((ea: IEmployeeApproval) => {
      existingEmployeeIds.add(ea.employeeId.toString());
    });
  }

  // Prepare new employee approvals
  for (const emp of employees) {
    const employeeId = new Types.ObjectId(emp.employeeId);

    // Skip if this employee already has an approval in the document
    if (existingEmployeeIds.has(employeeId.toString())) {
      continue;
    }

    employeeApprovalsToAdd.push({
      employeeId,
      requireSignature: emp.requireSignature || false,
      signatureType: emp.signatureType,
      status: "pending",
      history: [
        {
          status: "pending",
          createdAt: new Date(),
        },
      ],
    });
  }

  // Create or update the approval document
  if (!approvalDoc) {
    // Create new document with all employee approvals
    approvalDoc = await ContractApproval.create({
      templateId,
      tenantId,
      branchId,
      applicantId,
      employeeApprovals: employeeApprovalsToAdd,
      selfSignRequired: selfSignRequired || false,
      senderUserId: senderUserId,
    });
  } else {
    // Add new employee approvals to existing document
    approvalDoc.employeeApprovals.push(...employeeApprovalsToAdd);
    await approvalDoc.save();
  }

  // Send notifications for all new employee approvals
  for (const empApproval of employeeApprovalsToAdd) {
    const employeeId = empApproval.employeeId;

    // Get employee to find employeeProfile ID and employee's tenantId/branchId
    const employee = await EmployeeModel.findById(employeeId)
      .select("employeeProfile tenantId branchId")
      .lean();

    if (!employee?.employeeProfile) {
      console.error(
        `[CONTRACT APPROVAL] Employee ${employeeId.toString()} has no employeeProfile`
      );
      continue;
    }

    // Use employee's tenantId/branchId for the notification (not the employer's)
    const employeeTenantId = employee.tenantId
      ? typeof employee.tenantId === "string"
        ? new Types.ObjectId(employee.tenantId)
        : employee.tenantId
      : tenantId;
    const employeeBranchId = employee.branchId
      ? typeof employee.branchId === "string"
        ? new Types.ObjectId(employee.branchId)
        : employee.branchId
      : branchId;

    // Get the employeeProfile to find userId directly
    const employeeProfile = await EmployeeProfile.findById(
      employee.employeeProfile
    )
      .select("userId")
      .lean();

    if (!employeeProfile?.userId) {
      console.error(
        `[CONTRACT APPROVAL] EmployeeProfile ${employee.employeeProfile} has no userId for employee ${employeeId.toString()}`
      );
      continue;
    }

    // userId is stored as ObjectId reference in EmployeeProfile
    const targetUserIdObj =
      typeof employeeProfile.userId === "string"
        ? new Types.ObjectId(employeeProfile.userId)
        : employeeProfile.userId;

    console.log(
      `[CONTRACT APPROVAL] Creating notification for employee ${employeeId.toString()}, targetUserId: ${targetUserIdObj.toString()}, employeeTenantId: ${employeeTenantId.toString()}, employeeBranchId: ${employeeBranchId.toString()}`
    );

    // Send notification using employee's tenantId/branchId
    const notification = await createNotification({
      tenantId: employeeTenantId,
      branchId: employeeBranchId,
      targetUserId: targetUserIdObj,
      message: `Contract template "${templateTitle}" requires your approval. Please review and approve or reject.`,
      type: "contract_template_approval",
      metadata: {
        templateId: templateId.toString(),
        templateTitle,
        employeeId: employeeId.toString(),
        applicantId: applicantId.toString(),
        requireSignature: empApproval.requireSignature || false,
        signatureType: empApproval.signatureType,
        action: "approve_or_reject",
      },
    });

    console.log(
      `[CONTRACT APPROVAL] Notification created: ${notification._id}, targetUserId: ${notification.targetUserId?.toString()}, tenantId: ${notification.tenantId?.toString()}, branchId: ${notification.branchId?.toString()}`
    );
  }

  return approvalDoc.toObject() as IContractApproval;
}

export async function getApprovals(
  templateId: Types.ObjectId,
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId
): Promise<any[]> {
  const approvals = await ContractApproval.find({
    templateId,
    tenantId,
    branchId,
  })
    .populate("templateId", "title description version")
    .populate("applicantId", "employeeFields employeeProfile")
    .sort({ createdAt: -1 })
    .lean();

  // Get all unique employee IDs first to batch populate
  const allEmployeeIds = new Set<Types.ObjectId>();
  for (const approval of approvals) {
    (approval.employeeApprovals || []).forEach((ea: any) => {
      if (ea.employeeId) {
        allEmployeeIds.add(new Types.ObjectId(ea.employeeId));
      }
    });
  }

  // Batch fetch all employees
  const employeesMap = new Map<string, any>();
  if (allEmployeeIds.size > 0) {
    const employees = await EmployeeModel.find({
      _id: { $in: Array.from(allEmployeeIds) },
    })
      .select("employeeFields employeeProfile")
      .lean();

    employees.forEach((emp: any) => {
      employeesMap.set(emp._id.toString(), emp);
    });
  }

  // Flatten the structure for backward compatibility with contract template edit page
  // The edit page expects individual employee approvals
  const flattened: any[] = [];

  for (const approval of approvals) {
    for (const empApproval of approval.employeeApprovals || []) {
      const employeeId =
        empApproval.employeeId?.toString() || empApproval.employeeId;
      const employee = employeesMap.get(employeeId);

      flattened.push({
        _id: `${approval._id}_${employeeId}`,
        employeeId: employee || empApproval.employeeId,
        applicantId: approval.applicantId,
        templateId: approval.templateId,
        requireSignature: empApproval.requireSignature,
        signatureType: empApproval.signatureType,
        status: empApproval.status,
        respondedAt: empApproval.respondedAt,
        note: empApproval.note, // Include current note
        history: empApproval.history || [], // Include history array
        tenantId: approval.tenantId,
        branchId: approval.branchId,
        createdAt: approval.createdAt,
        updatedAt: approval.updatedAt,
      });
    }
  }

  // Normalize IDs to string for consistent frontend handling
  return flattened.map((item: any) => ({
    ...item,
    employeeId:
      item.employeeId?._id?.toString() ||
      item.employeeId?.toString() ||
      item.employeeId,
    applicantId:
      item.applicantId?._id?.toString() ||
      item.applicantId?.toString() ||
      item.applicantId ||
      null,
    templateId:
      item.templateId?._id?.toString() ||
      item.templateId?.toString() ||
      item.templateId,
  }));
}

export async function getAllApprovals(
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId
): Promise<any[]> {
  console.log(
    `[CONTRACT APPROVAL SERVICE] Fetching all approvals for tenantId: ${tenantId.toString()}, branchId: ${branchId.toString()}`
  );

  // First, check if there are any approvals at all
  const totalCount = await ContractApproval.countDocuments({
    tenantId,
    branchId,
  });
  console.log(
    `[CONTRACT APPROVAL SERVICE] Total approvals in DB: ${totalCount}`
  );

  const approvals = await ContractApproval.find({
    tenantId,
    branchId,
  })
    .populate({
      path: "templateId",
      select: "title description version",
    })
    .populate({
      path: "applicantId",
      select: "employeeFields employeeProfile",
    })
    .sort({ createdAt: -1 })
    .lean();

  console.log(
    `[CONTRACT APPROVAL SERVICE] Found ${approvals.length} approval documents after populate`
  );

  // Get all unique employee IDs first to batch populate
  const allEmployeeIds = new Set<Types.ObjectId>();
  for (const approval of approvals) {
    (approval.employeeApprovals || []).forEach((ea: any) => {
      if (ea.employeeId) {
        allEmployeeIds.add(new Types.ObjectId(ea.employeeId));
      }
    });
  }

  // Batch fetch all employees with designation populated
  const employeesMap = new Map<string, any>();
  if (allEmployeeIds.size > 0) {
    const employees = await EmployeeModel.find({
      _id: { $in: Array.from(allEmployeeIds) },
    })
      .select("employeeFields employeeProfile designation")
      .populate("designation", "name")
      .lean();

    employees.forEach((emp: any) => {
      employeesMap.set(emp._id.toString(), emp);
    });
  }

  // Return grouped structure with populated employee data
  const grouped = approvals.map((approval: any) => {
    // Populate employee approvals with full employee data
    const populatedEmployeeApprovals = (approval.employeeApprovals || []).map(
      (empApproval: any) => {
        // Get employee ID - could be ObjectId or string
        let employeeIdValue = empApproval.employeeId;
        let employeeIdStr: string;

        if (employeeIdValue && typeof employeeIdValue === "object") {
          // It's an ObjectId or populated object
          employeeIdStr =
            employeeIdValue._id?.toString() || employeeIdValue.toString();
        } else {
          // It's already a string
          employeeIdStr = String(employeeIdValue);
        }

        // Look up the employee in our batch-fetched map
        const employee = employeesMap.get(employeeIdStr);

        // Use the populated employee if found, otherwise keep original
        return {
          ...empApproval,
          employeeId: employee || empApproval.employeeId,
          history: empApproval.history || [], // Include history array
        };
      }
    );

    // Calculate overall status
    const hasPending = populatedEmployeeApprovals.some(
      (ea: any) => ea.status === "pending"
    );
    const hasRejected = populatedEmployeeApprovals.some(
      (ea: any) => ea.status === "rejected"
    );
    const allApproved =
      populatedEmployeeApprovals.length > 0 &&
      populatedEmployeeApprovals.every((ea: any) => ea.status === "approved");

    // For self-signed contracts (no employee approvals), use the approval's status field
    const isSelfSigned =
      populatedEmployeeApprovals.length === 0 && approval.employerSignatureData;

    let overallStatus: "pending" | "approved" | "rejected" | "partial" =
      "pending";
    if (isSelfSigned) {
      // Self-signed contracts use the status field directly
      overallStatus = approval.status === "approved" ? "approved" : "pending";
    } else if (hasRejected) {
      overallStatus = "rejected";
    } else if (allApproved) {
      overallStatus = "approved";
    } else if (
      hasPending &&
      populatedEmployeeApprovals.some((ea: any) => ea.status === "approved")
    ) {
      overallStatus = "partial";
    }

    return {
      _id: approval._id,
      templateId: approval.templateId,
      applicantId: approval.applicantId,
      employeeApprovals: populatedEmployeeApprovals,
      overallStatus,
      status: approval.status, // Include status field for self-signed contracts
      totalEmployees: populatedEmployeeApprovals.length,
      pendingCount: populatedEmployeeApprovals.filter(
        (ea: any) => ea.status === "pending"
      ).length,
      approvedCount: populatedEmployeeApprovals.filter(
        (ea: any) => ea.status === "approved"
      ).length,
      rejectedCount: populatedEmployeeApprovals.filter(
        (ea: any) => ea.status === "rejected"
      ).length,
      // Employer signature fields for self-sign flow
      employerSignatureData: approval.employerSignatureData,
      employerSignedAt: approval.employerSignedAt,
      employerName: approval.employerName,
      // Self Sign Required fields - for sender to sign from Contract Approvals page
      selfSignRequired: approval.selfSignRequired,
      senderUserId: approval.senderUserId?.toString(), // Convert to string for frontend comparison
      senderSignatureData: approval.senderSignatureData,
      senderSignedAt: approval.senderSignedAt,
      sentAt: approval.sentAt,
      sentToApplicantAt: approval.sentToApplicantAt, // Include sentToApplicantAt timestamp
      applicantStatus: approval.applicantStatus || "pending", // Include applicant status
      acceptedAt: approval.acceptedAt, // Include acceptedAt timestamp
      rejectedAt: approval.rejectedAt, // Include rejectedAt timestamp
      applicantNote: approval.applicantNote, // Include applicant note (current/latest)
      applicantHistory: approval.applicantHistory || [], // Include applicant history array
      // Applicant signature fields
      applicantSignatureData: approval.applicantSignatureData,
      applicantSignedAt: approval.applicantSignedAt,
      createdAt: approval.createdAt,
      updatedAt: approval.updatedAt,
      tenantId: approval.tenantId,
      branchId: approval.branchId,
    };
  });

  console.log(
    `[CONTRACT APPROVAL SERVICE] Returning ${grouped.length} grouped approval documents`
  );
  if (grouped.length > 0) {
    console.log(
      `[CONTRACT APPROVAL SERVICE] Sample approval structure:`,
      JSON.stringify(grouped[0], null, 2)
    );
  }

  // Normalize IDs to string for consistent frontend handling, but preserve populated objects
  return grouped.map((item: any) => {
    const result: any = {
      ...item,
    };

    // Preserve populated template data
    if (
      item.templateId &&
      typeof item.templateId === "object" &&
      item.templateId._id
    ) {
      result.templateId = item.templateId;
    } else {
      result.templateId = item.templateId?.toString() || item.templateId;
    }

    // Preserve populated applicant data
    if (
      item.applicantId &&
      typeof item.applicantId === "object" &&
      item.applicantId._id
    ) {
      result.applicantId = item.applicantId;
    } else if (item.applicantId) {
      result.applicantId = item.applicantId.toString();
    } else {
      result.applicantId = null;
    }

    // Preserve populated employee objects in employeeApprovals (don't convert to string)
    result.employeeApprovals = item.employeeApprovals.map((ea: any) => {
      // Keep the employee object if it's populated (has _id and employeeFields/employeeProfile)
      // This is the populated employee data from the batch fetch
      const employeeId = ea.employeeId;

      // If it's already an object with _id, keep it as is (it's populated)
      // Otherwise, it might be a string ID or something else
      if (employeeId && typeof employeeId === "object" && employeeId._id) {
        // This is a populated employee object - keep it
        return {
          ...ea,
          employeeId: employeeId, // Keep the full employee object
        };
      } else {
        // It's not a populated object, convert to string for consistency
        return {
          ...ea,
          employeeId:
            employeeId?._id?.toString() || employeeId?.toString() || employeeId,
        };
      }
    });

    return result;
  });
}

export async function getEmployeeApprovals(
  employeeId: Types.ObjectId,
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId
): Promise<any[]> {
  console.log(
    `[CONTRACT APPROVAL SERVICE] Fetching approvals for employeeId: ${employeeId.toString()}, tenantId: ${tenantId.toString()}, branchId: ${branchId.toString()}`
  );

  // Find all approvals where this employee is in the employeeApprovals array
  const approvals = await ContractApproval.find({
    tenantId,
    branchId,
    "employeeApprovals.employeeId": employeeId,
  })
    .populate({
      path: "templateId",
      select: "title description version",
    })
    .populate({
      path: "applicantId",
      select: "employeeFields employeeProfile",
    })
    .sort({ createdAt: -1 })
    .lean();

  console.log(
    `[CONTRACT APPROVAL SERVICE] Found ${approvals.length} approval documents for employee`
  );

  // Filter and format the approvals to include only this employee's approval status
  const employeeApprovals = approvals
    .map((approval: any) => {
      // Find this employee's approval in the array
      const empApproval = (approval.employeeApprovals || []).find(
        (ea: any) => ea.employeeId?.toString() === employeeId.toString()
      );

      if (!empApproval) {
        return null;
      }

      return {
        _id: approval._id,
        templateId: approval.templateId,
        applicantId: approval.applicantId,
        employeeId: employeeId.toString(), // Include employeeId so frontend knows which employee this approval is for
        status: empApproval.status,
        requireSignature: empApproval.requireSignature,
        signatureType: empApproval.signatureType,
        respondedAt: empApproval.respondedAt,
        note: empApproval.note, // Include note if present (current/latest)
        history: empApproval.history || [], // Include full history array
        createdAt: approval.createdAt,
        updatedAt: approval.updatedAt,
      };
    })
    .filter((item: any) => item !== null);

  console.log(
    `[CONTRACT APPROVAL SERVICE] Returning ${employeeApprovals.length} employee-specific approvals`
  );

  // Normalize IDs to string for consistent frontend handling
  return employeeApprovals.map((item: any) => {
    const result: any = {
      ...item,
    };

    // Preserve populated template data
    if (
      item.templateId &&
      typeof item.templateId === "object" &&
      item.templateId._id
    ) {
      result.templateId = item.templateId;
    } else {
      result.templateId = item.templateId?.toString() || item.templateId;
    }

    // Preserve populated applicant data
    if (
      item.applicantId &&
      typeof item.applicantId === "object" &&
      item.applicantId._id
    ) {
      result.applicantId = item.applicantId;
    } else if (item.applicantId) {
      result.applicantId = item.applicantId.toString();
    } else {
      result.applicantId = null;
    }

    return result;
  });
}

/**
 * Fetch approvals for multiple employeeIds across multiple tenant/branch pairs
 * This is used for Nexus profiles who may belong to multiple organizations
 */
export async function getEmployeeApprovalsForMultipleIds(
  employeeIds: Types.ObjectId[],
  tenantBranchPairs: Array<{
    tenantId: Types.ObjectId;
    branchId: Types.ObjectId;
  }>
): Promise<any[]> {
  console.log(
    `[CONTRACT APPROVAL SERVICE] Fetching approvals for ${employeeIds.length} employeeId(s) across ${tenantBranchPairs.length} organization(s)`
  );

  if (employeeIds.length === 0) {
    return [];
  }

  // Build query to find approvals where:
  // 1. The tenantId/branchId matches one of the user's organizations (must match as a pair)
  // 2. At least one of the employeeIds is in the employeeApprovals array
  // We need to match tenantId/branchId pairs, so we use $or with exact matches
  const tenantBranchConditions = tenantBranchPairs.map((pair) => ({
    tenantId: pair.tenantId,
    branchId: pair.branchId,
  }));

  // Find all approvals that match any of the tenant/branch pairs AND have any of the employeeIds
  const approvals = await ContractApproval.find({
    $or: tenantBranchConditions,
    "employeeApprovals.employeeId": { $in: employeeIds },
  })
    .populate({
      path: "templateId",
      select: "title description version",
    })
    .populate({
      path: "applicantId",
      select: "employeeFields employeeProfile",
    })
    .populate({
      path: "employeeApprovals.employeeId",
      select: "employeeFields designation",
      populate: {
        path: "designation",
        select: "name",
      },
    })
    .sort({ createdAt: -1 })
    .lean();

  console.log(
    `[CONTRACT APPROVAL SERVICE] Found ${approvals.length} approval documents matching criteria`
  );

  // Collect all unique designation IDs from populated employees for manual lookup
  const designationIds = new Set<string>();
  for (const approval of approvals) {
    for (const ea of approval.employeeApprovals || []) {
      const empIdObj = ea.employeeId;

      // DEBUG: Log employee details to trace designation field
      console.log(`[DESIGNATION DEBUG] Employee populated:`, {
        hasEmpIdObj: !!empIdObj,
        empId: empIdObj?._id?.toString(),
        hasDesignation: empIdObj ? "designation" in empIdObj : false,
        designationType: empIdObj ? typeof empIdObj.designation : "N/A",
        designationValue: empIdObj?.designation,
        employeeFields: empIdObj?.employeeFields ? "exists" : "missing",
      });

      if (empIdObj && empIdObj._id && empIdObj.designation) {
        // Designation could be ObjectId or already populated object
        const desigId =
          typeof empIdObj.designation === "object" && empIdObj.designation._id
            ? empIdObj.designation._id.toString()
            : empIdObj.designation.toString();
        designationIds.add(desigId);
        console.log(`[DESIGNATION DEBUG] Added designation ID: ${desigId}`);
      } else {
        console.log(
          `[DESIGNATION DEBUG] Skipped - empIdObj._id: ${empIdObj?._id}, designation: ${empIdObj?.designation}`
        );
      }
    }
  }

  // Fetch all designations at once for efficiency
  const designationIdArray = Array.from(designationIds);
  const designations =
    designationIdArray.length > 0
      ? await Designation.find({ _id: { $in: designationIdArray } })
          .select("name")
          .lean()
      : [];

  // Create a map for quick lookup: designationId -> name
  const designationMap = new Map<string, string>();
  for (const d of designations) {
    designationMap.set(d._id.toString(), d.name);
  }
  console.log(
    `[CONTRACT APPROVAL SERVICE] Fetched ${designations.length} designations, map size: ${designationMap.size}`
  );

  // Create a map of employeeId strings for quick lookup
  const employeeIdSet = new Set(employeeIds.map((id) => id.toString()));

  // Filter and format the approvals to include only the relevant employee's approval status
  const employeeApprovals: any[] = [];

  for (const approval of approvals) {
    // Pre-process full list of approvals for this contract (for preview purposes)
    const fullApprovals = (approval.employeeApprovals || []).map((ea: any) => {
      const empIdObj = ea.employeeId;
      const empId =
        empIdObj && empIdObj._id
          ? empIdObj._id.toString()
          : empIdObj?.toString();

      let employeeName = "";
      let designation = "";
      if (empIdObj && empIdObj._id) {
        const firstName =
          empIdObj.employeeFields?.personaldetails?.firstname || "";
        const lastName =
          empIdObj.employeeFields?.personaldetails?.lastname || "";
        employeeName = `${firstName} ${lastName}`.trim();

        // Look up designation from our manually fetched map
        if (empIdObj.designation) {
          const desigId =
            typeof empIdObj.designation === "object" && empIdObj.designation._id
              ? empIdObj.designation._id.toString()
              : empIdObj.designation.toString();
          designation = designationMap.get(desigId) || "";
        }
      }

      return {
        ...ea, // Keep original fields
        employeeId: empId,
        employeeName,
        designation,
      };
    });

    // Find all employee approvals in this document that match any of our employeeIds
    const matchingApprovals = (approval.employeeApprovals || []).filter(
      (ea: any) => {
        // Handle populated employee object or string ID
        const empIdObj = ea.employeeId;
        const eaEmployeeId =
          empIdObj && empIdObj._id
            ? empIdObj._id.toString()
            : empIdObj?.toString();
        return employeeIdSet.has(eaEmployeeId);
      }
    );

    // For each matching employee approval, create a separate result entry
    for (const empApproval of matchingApprovals) {
      const empIdObj = empApproval.employeeId;
      const empId =
        empIdObj && empIdObj._id
          ? empIdObj._id.toString()
          : empIdObj?.toString();

      // Extract employee name and designation if populated
      let employeeName = "";
      let designation = "";

      if (empIdObj && empIdObj._id) {
        const firstName =
          empIdObj.employeeFields?.personaldetails?.firstname || "";
        const lastName =
          empIdObj.employeeFields?.personaldetails?.lastname || "";
        employeeName = `${firstName} ${lastName}`.trim();

        // Look up designation from our manually fetched map
        const desigRef = (empIdObj as any).designation;
        if (desigRef) {
          const desigId =
            typeof desigRef === "object" && desigRef._id
              ? desigRef._id.toString()
              : desigRef.toString();
          designation = designationMap.get(desigId) || "";
        }
      }

      employeeApprovals.push({
        _id: approval._id,
        templateId: approval.templateId,
        applicantId: approval.applicantId,
        employeeId: empId, // Include employeeId so frontend knows which employee this approval is for
        employeeName, // Return extracted name
        designation, // Return extracted designation
        fullEmployeeApprovals: fullApprovals, // Include full list for preview
        status: empApproval.status,
        requireSignature: empApproval.requireSignature,
        signatureType: empApproval.signatureType,
        signatureData: empApproval.signatureData, // Include signature data for display
        respondedAt: empApproval.respondedAt,
        createdAt: approval.createdAt,
        updatedAt: approval.updatedAt,
      });
    }
  }

  console.log(
    `[CONTRACT APPROVAL SERVICE] Returning ${employeeApprovals.length} employee-specific approvals`
  );

  // Normalize IDs to string for consistent frontend handling
  return employeeApprovals.map((item: any) => {
    const result: any = {
      ...item,
    };

    // Preserve populated template data
    if (
      item.templateId &&
      typeof item.templateId === "object" &&
      item.templateId._id
    ) {
      result.templateId = item.templateId;
    } else {
      result.templateId = item.templateId?.toString() || item.templateId;
    }

    // Preserve populated applicant data
    if (
      item.applicantId &&
      typeof item.applicantId === "object" &&
      item.applicantId._id
    ) {
      result.applicantId = item.applicantId;
    } else if (item.applicantId) {
      result.applicantId = item.applicantId.toString();
    } else {
      result.applicantId = null;
    }

    return result;
  });
}

export async function deleteApproval(
  templateId: Types.ObjectId,
  employeeId: Types.ObjectId,
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId
): Promise<boolean> {
  const approval = await ContractApproval.findOne({
    templateId,
    tenantId,
    branchId,
  });

  if (!approval) {
    return false;
  }

  // Remove the specific employee approval from the array
  approval.employeeApprovals = approval.employeeApprovals.filter(
    (ea: IEmployeeApproval) =>
      ea.employeeId.toString() !== employeeId.toString()
  );

  // If no more employee approvals, delete the document
  if (approval.employeeApprovals.length === 0) {
    await ContractApproval.deleteOne({ _id: approval._id });
    return true;
  }

  await approval.save();
  return true;
}

export interface UpdateApprovalParams {
  templateId: Types.ObjectId;
  employeeId: Types.ObjectId;
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  status?: "pending" | "approved" | "rejected" | "signed";
  requireSignature?: boolean;
  signatureType?: "typed" | "drawn" | "upload";
  signatureData?: string;
  respondedAt?: Date;
  note?: string; // Optional note/comment from the employee
  addToHistory?: boolean; // Whether to add this action to history (default: true for status changes)
}

export async function updateApproval(
  params: UpdateApprovalParams
): Promise<IContractApproval | null> {
  const {
    templateId,
    employeeId,
    tenantId,
    branchId,
    status,
    requireSignature,
    signatureType,
    signatureData,
    respondedAt,
    note,
    addToHistory = true,
  } = params;

  const approval = await ContractApproval.findOne({
    templateId,
    tenantId,
    branchId,
  });

  if (!approval) {
    return null;
  }

  // Find and update the specific employee approval
  const employeeApproval = approval.employeeApprovals.find(
    (ea: IEmployeeApproval) =>
      ea.employeeId.toString() === employeeId.toString()
  );

  if (!employeeApproval) {
    return null;
  }

  // Initialize history array if it doesn't exist
  if (!employeeApproval.history) {
    employeeApproval.history = [];
  }

  // If status is being changed, add to history
  if (
    status !== undefined &&
    addToHistory &&
    status !== employeeApproval.status
  ) {
    const historyEntry = {
      status: status,
      note: note || undefined,
      respondedAt:
        respondedAt || (status !== "pending" ? new Date() : undefined),
      createdAt: new Date(),
    };
    employeeApproval.history.push(historyEntry);
  }

  // Update the employee approval current state
  if (status !== undefined) {
    employeeApproval.status = status;
  }
  if (requireSignature !== undefined) {
    employeeApproval.requireSignature = requireSignature;
  }
  if (signatureType !== undefined) {
    employeeApproval.signatureType = signatureType;
  }
  if (signatureData !== undefined) {
    employeeApproval.signatureData = signatureData;
  }
  if (respondedAt !== undefined) {
    employeeApproval.respondedAt = respondedAt;
  }
  if (note !== undefined) {
    employeeApproval.note = note;
  }

  await approval.save();
  return approval.toObject() as IContractApproval;
}

export interface UpdateApprovalByIdParams {
  approvalId: Types.ObjectId;
  employeeId: Types.ObjectId;
  status?: "pending" | "approved" | "rejected" | "signed";
  requireSignature?: boolean;
  signatureType?: "typed" | "drawn" | "upload";
  signatureData?: string;
  respondedAt?: Date;
  note?: string;
  addToHistory?: boolean;
}

/**
 * Update an employee approval by the unique approval document _id
 * This is more reliable when there are multiple contracts with the same templateId
 * but different tenantId/branchId combinations
 */
export async function updateApprovalById(
  params: UpdateApprovalByIdParams
): Promise<IContractApproval | null> {
  const {
    approvalId,
    employeeId,
    status,
    requireSignature,
    signatureType,
    signatureData,
    respondedAt,
    note,
    addToHistory = true,
  } = params;

  // Find the approval document by its unique _id
  const approval = await ContractApproval.findById(approvalId);

  if (!approval) {
    return null;
  }

  // Find and update the specific employee approval
  const employeeApproval = approval.employeeApprovals.find(
    (ea: IEmployeeApproval) =>
      ea.employeeId.toString() === employeeId.toString()
  );

  if (!employeeApproval) {
    return null;
  }

  // Initialize history array if it doesn't exist
  if (!employeeApproval.history) {
    employeeApproval.history = [];
  }

  // If status is being changed, add to history
  if (
    status !== undefined &&
    addToHistory &&
    status !== employeeApproval.status
  ) {
    const historyEntry = {
      status: status,
      note: note || undefined,
      respondedAt:
        respondedAt || (status !== "pending" ? new Date() : undefined),
      createdAt: new Date(),
    };
    employeeApproval.history.push(historyEntry);
  }

  // Update the employee approval current state
  if (status !== undefined) {
    employeeApproval.status = status;
  }
  if (requireSignature !== undefined) {
    employeeApproval.requireSignature = requireSignature;
  }
  if (signatureType !== undefined) {
    employeeApproval.signatureType = signatureType;
  }
  if (signatureData !== undefined) {
    employeeApproval.signatureData = signatureData;
  }
  if (respondedAt !== undefined) {
    employeeApproval.respondedAt = respondedAt;
  }
  if (note !== undefined) {
    employeeApproval.note = note;
  }

  await approval.save();
  return approval.toObject() as IContractApproval;
}

export interface SendSingleApprovalParams {
  templateId: Types.ObjectId;
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  employeeId: Types.ObjectId;
  applicantId: Types.ObjectId;
  requireSignature: boolean;
  signatureType?: "typed" | "drawn" | "upload";
  templateTitle: string;
}

export async function sendSingleApprovalRequest(
  params: SendSingleApprovalParams
): Promise<IContractApproval> {
  const {
    templateId,
    tenantId,
    branchId,
    employeeId,
    applicantId,
    requireSignature,
    signatureType,
    templateTitle,
  } = params;

  // Check if approval document already exists for this template+applicant combination
  let approvalDoc = await ContractApproval.findOne({
    templateId,
    applicantId,
    tenantId,
    branchId,
  });

  // Check if this employee already has an approval
  if (approvalDoc) {
    const existingEmployeeApproval = approvalDoc.employeeApprovals.find(
      (ea: IEmployeeApproval) =>
        ea.employeeId.toString() === employeeId.toString()
    );

    if (existingEmployeeApproval) {
      // If the approval was rejected, allow resending by resetting to pending
      if (existingEmployeeApproval.status === "rejected") {
        // Initialize history array if it doesn't exist
        if (!existingEmployeeApproval.history) {
          existingEmployeeApproval.history = [];
        }

        // Add history entry for resend action
        existingEmployeeApproval.history.push({
          status: "pending",
          note: "Contract resent for approval after rejection",
          createdAt: new Date(),
        });

        existingEmployeeApproval.status = "pending";
        existingEmployeeApproval.respondedAt = undefined;
        existingEmployeeApproval.note = undefined; // Clear current note when resending
        // Update signature requirements if provided
        if (requireSignature !== undefined) {
          existingEmployeeApproval.requireSignature = requireSignature;
        }
        if (signatureType !== undefined) {
          existingEmployeeApproval.signatureType = signatureType;
        }
        await approvalDoc.save();

        // Send notification for the resent approval
        const employee = await EmployeeModel.findById(employeeId)
          .select("employeeProfile tenantId branchId")
          .lean();

        if (employee?.employeeProfile) {
          const employeeTenantId = employee.tenantId
            ? typeof employee.tenantId === "string"
              ? new Types.ObjectId(employee.tenantId)
              : employee.tenantId
            : tenantId;
          const employeeBranchId = employee.branchId
            ? typeof employee.branchId === "string"
              ? new Types.ObjectId(employee.branchId)
              : employee.branchId
            : branchId;

          const employeeProfile = await EmployeeProfile.findById(
            employee.employeeProfile
          )
            .select("userId")
            .lean();

          if (employeeProfile?.userId) {
            const targetUserIdObj =
              typeof employeeProfile.userId === "string"
                ? new Types.ObjectId(employeeProfile.userId)
                : employeeProfile.userId;

            await createNotification({
              tenantId: employeeTenantId,
              branchId: employeeBranchId,
              targetUserId: targetUserIdObj,
              message: `Contract template "${templateTitle}" has been resent for your approval. Please review and approve or reject.`,
              type: "contract_template_approval",
              metadata: {
                templateId: templateId.toString(),
                templateTitle,
                employeeId: employeeId.toString(),
                applicantId: applicantId.toString(),
                requireSignature:
                  existingEmployeeApproval.requireSignature || false,
                signatureType: existingEmployeeApproval.signatureType,
                action: "approve_or_reject",
              },
            });
          }
        }

        return approvalDoc.toObject() as IContractApproval;
      } else {
        // If status is pending or approved, don't allow resending
        throw new Error("Approval request already sent for this employee");
      }
    }
  }

  // Create or update the approval document
  if (!approvalDoc) {
    approvalDoc = await ContractApproval.create({
      templateId,
      tenantId,
      branchId,
      applicantId,
      employeeApprovals: [
        {
          employeeId,
          requireSignature: requireSignature || false,
          signatureType,
          status: "pending",
        },
      ],
    });
  } else {
    approvalDoc.employeeApprovals.push({
      employeeId,
      requireSignature: requireSignature || false,
      signatureType,
      status: "pending",
    });
    await approvalDoc.save();
  }

  // Get employee to find employeeProfile ID and employee's tenantId/branchId
  const employee = await EmployeeModel.findById(employeeId)
    .select("employeeProfile tenantId branchId")
    .lean();

  if (employee?.employeeProfile) {
    // Use employee's tenantId/branchId for the notification (not the employer's)
    const employeeTenantId = employee.tenantId
      ? typeof employee.tenantId === "string"
        ? new Types.ObjectId(employee.tenantId)
        : employee.tenantId
      : tenantId;
    const employeeBranchId = employee.branchId
      ? typeof employee.branchId === "string"
        ? new Types.ObjectId(employee.branchId)
        : employee.branchId
      : branchId;

    // Get the employeeProfile to find userId directly
    const employeeProfile = await EmployeeProfile.findById(
      employee.employeeProfile
    )
      .select("userId")
      .lean();

    if (employeeProfile?.userId) {
      // userId is stored as ObjectId reference in EmployeeProfile
      const targetUserIdObj =
        typeof employeeProfile.userId === "string"
          ? new Types.ObjectId(employeeProfile.userId)
          : employeeProfile.userId;

      console.log(
        `[CONTRACT APPROVAL] Creating notification for employee ${employeeId.toString()}, targetUserId: ${targetUserIdObj.toString()}, employeeTenantId: ${employeeTenantId.toString()}, employeeBranchId: ${employeeBranchId.toString()}`
      );

      // Send notification using employee's tenantId/branchId
      const notification = await createNotification({
        tenantId: employeeTenantId,
        branchId: employeeBranchId,
        targetUserId: targetUserIdObj,
        message: `Contract template "${templateTitle}" requires your approval. Please review and approve or reject.`,
        type: "contract_template_approval",
        metadata: {
          templateId: templateId.toString(),
          templateTitle,
          employeeId: employeeId.toString(),
          applicantId: applicantId.toString(),
          requireSignature: requireSignature || false,
          signatureType,
          action: "approve_or_reject",
        },
      });

      console.log(
        `[CONTRACT APPROVAL] Notification created: ${notification._id}, targetUserId: ${notification.targetUserId?.toString()}, tenantId: ${notification.tenantId?.toString()}, branchId: ${notification.branchId?.toString()}`
      );
    }
  }

  return approvalDoc.toObject() as IContractApproval;
}

export interface SendAllApprovalsParams {
  templateId: Types.ObjectId;
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  applicantId: Types.ObjectId;
  employeeSettings: Array<{
    employeeId: string;
    requireSignature: boolean;
    signatureType?: "typed" | "drawn" | "upload";
  }>;
  templateTitle: string;
}

export async function sendAllPendingApprovals(
  params: SendAllApprovalsParams
): Promise<IContractApproval> {
  const {
    templateId,
    tenantId,
    branchId,
    applicantId,
    employeeSettings,
    templateTitle,
  } = params;

  // Check if approval document already exists for this template+applicant combination
  let approvalDoc = await ContractApproval.findOne({
    templateId,
    applicantId,
    tenantId,
    branchId,
  });

  // Get existing employee IDs to avoid duplicates
  const existingEmployeeIds = new Set<string>();
  if (approvalDoc) {
    approvalDoc.employeeApprovals.forEach((ea: IEmployeeApproval) => {
      existingEmployeeIds.add(ea.employeeId.toString());
    });
  }

  // Filter employees who haven't been sent yet
  const employeesToSend = employeeSettings.filter(
    (emp) => !existingEmployeeIds.has(emp.employeeId)
  );

  if (employeesToSend.length === 0) {
    if (!approvalDoc) {
      throw new Error(
        "No approval document found and no new employees to send"
      );
    }
    return approvalDoc.toObject() as IContractApproval;
  }

  // Prepare new employee approvals
  const employeeApprovalsToAdd: IEmployeeApproval[] = employeesToSend.map(
    (emp) => ({
      employeeId: new Types.ObjectId(emp.employeeId),
      requireSignature: emp.requireSignature || false,
      signatureType: emp.signatureType,
      status: "pending",
      history: [
        {
          status: "pending",
          createdAt: new Date(),
        },
      ],
    })
  );

  // Create or update the approval document
  if (!approvalDoc) {
    approvalDoc = await ContractApproval.create({
      templateId,
      tenantId,
      branchId,
      applicantId,
      employeeApprovals: employeeApprovalsToAdd,
    });
  } else {
    approvalDoc.employeeApprovals.push(...employeeApprovalsToAdd);
    await approvalDoc.save();
  }

  // Send notifications for all new employee approvals
  for (const empApproval of employeeApprovalsToAdd) {
    const employeeId = empApproval.employeeId;

    // Get employee to find employeeProfile ID and employee's tenantId/branchId
    const employee = await EmployeeModel.findById(employeeId)
      .select("employeeProfile tenantId branchId")
      .lean();

    if (!employee?.employeeProfile) {
      console.error(
        `[CONTRACT APPROVAL] Employee ${employeeId.toString()} has no employeeProfile`
      );
      continue;
    }

    // Use employee's tenantId/branchId for the notification (not the employer's)
    const employeeTenantId = employee.tenantId
      ? typeof employee.tenantId === "string"
        ? new Types.ObjectId(employee.tenantId)
        : employee.tenantId
      : tenantId;
    const employeeBranchId = employee.branchId
      ? typeof employee.branchId === "string"
        ? new Types.ObjectId(employee.branchId)
        : employee.branchId
      : branchId;

    // Get the employeeProfile to find userId directly
    const employeeProfile = await EmployeeProfile.findById(
      employee.employeeProfile
    )
      .select("userId")
      .lean();

    if (!employeeProfile?.userId) {
      console.error(
        `[CONTRACT APPROVAL] EmployeeProfile ${employee.employeeProfile} has no userId for employee ${employeeId.toString()}`
      );
      continue;
    }

    // userId is stored as ObjectId reference in EmployeeProfile
    const targetUserIdObj =
      typeof employeeProfile.userId === "string"
        ? new Types.ObjectId(employeeProfile.userId)
        : employeeProfile.userId;

    console.log(
      `[CONTRACT APPROVAL] Creating notification for employee ${employeeId.toString()}, targetUserId: ${targetUserIdObj.toString()}, employeeTenantId: ${employeeTenantId.toString()}, employeeBranchId: ${employeeBranchId.toString()}`
    );

    // Send notification using employee's tenantId/branchId
    const notification = await createNotification({
      tenantId: employeeTenantId,
      branchId: employeeBranchId,
      targetUserId: targetUserIdObj,
      message: `Contract template "${templateTitle}" requires your approval. Please review and approve or reject.`,
      type: "contract_template_approval",
      metadata: {
        templateId: templateId.toString(),
        templateTitle,
        employeeId: employeeId.toString(),
        applicantId: applicantId.toString(),
        requireSignature: empApproval.requireSignature || false,
        signatureType: empApproval.signatureType,
        action: "approve_or_reject",
      },
    });

    console.log(
      `[CONTRACT APPROVAL] Notification created: ${notification._id}, targetUserId: ${notification.targetUserId?.toString()}, tenantId: ${notification.tenantId?.toString()}, branchId: ${notification.branchId?.toString()}`
    );
  }

  return approvalDoc.toObject() as IContractApproval;
}

export interface SendToApplicantParams {
  templateId: Types.ObjectId;
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  applicantId: Types.ObjectId;
  templateTitle: string;
}

export async function sendToApplicant(
  params: SendToApplicantParams
): Promise<IContractApproval | null> {
  const { templateId, tenantId, branchId, applicantId, templateTitle } = params;

  // Find the approval document
  const approval = await ContractApproval.findOne({
    templateId,
    applicantId,
    tenantId,
    branchId,
  });

  if (!approval) {
    return null;
  }

  // Check if this is a self-signed contract (no employee approvals, but employer signed)
  const isSelfSigned =
    approval.employeeApprovals.length === 0 &&
    approval.employerSignatureData &&
    approval.status === "approved";

  // Check if all employees have approved (for regular approval flow)
  const allApproved =
    approval.employeeApprovals.length > 0 &&
    approval.employeeApprovals.every(
      (ea: IEmployeeApproval) => ea.status === "approved"
    );

  // Allow sending if either: all employees approved OR contract is self-signed
  if (!allApproved && !isSelfSigned) {
    throw new Error(
      "Cannot send to applicant: not all employees have approved the contract"
    );
  }

  // Check if already sent - if rejected, allow resending
  const isResending =
    approval.sentToApplicantAt && approval.applicantStatus === "rejected";

  if (approval.sentToApplicantAt && !isResending) {
    console.log(
      `[CONTRACT APPROVAL] Contract already sent to applicant ${applicantId.toString()} at ${approval.sentToApplicantAt}`
    );
    throw new Error("Contract has already been sent to the applicant");
  }

  // If resending after rejection, add history entry and reset status
  if (isResending) {
    // Initialize applicantHistory if it doesn't exist
    if (!approval.applicantHistory) {
      approval.applicantHistory = [];
    }

    // Add history entry for resend action
    approval.applicantHistory.push({
      status: "pending",
      note: "Contract resent to applicant after rejection",
      createdAt: new Date(),
    });

    // Reset applicant status to pending
    approval.applicantStatus = "pending";
    approval.acceptedAt = undefined;
    approval.rejectedAt = undefined;
    approval.applicantNote = undefined; // Clear current note when resending
  }

  // Update the approval document
  approval.sentToApplicantAt = new Date();
  await approval.save();

  console.log(
    `[CONTRACT APPROVAL] Contract sent to applicant ${applicantId.toString()}, tenantId: ${tenantId.toString()}, branchId: ${branchId.toString()}, sentAt: ${approval.sentToApplicantAt}`
  );

  // Get applicant employee to find employeeProfile ID and tenantId/branchId
  const applicantEmployee = await EmployeeModel.findById(applicantId)
    .select("employeeProfile tenantId branchId")
    .lean();

  if (applicantEmployee?.employeeProfile) {
    // Use applicant's tenantId/branchId for the notification
    const applicantTenantId = applicantEmployee.tenantId
      ? typeof applicantEmployee.tenantId === "string"
        ? new Types.ObjectId(applicantEmployee.tenantId)
        : applicantEmployee.tenantId
      : tenantId;
    const applicantBranchId = applicantEmployee.branchId
      ? typeof applicantEmployee.branchId === "string"
        ? new Types.ObjectId(applicantEmployee.branchId)
        : applicantEmployee.branchId
      : branchId;

    // Get the employeeProfile to find userId directly
    const employeeProfile = await EmployeeProfile.findById(
      applicantEmployee.employeeProfile
    )
      .select("userId")
      .lean();

    if (employeeProfile?.userId) {
      // userId is stored as ObjectId reference in EmployeeProfile
      const targetUserIdObj =
        typeof employeeProfile.userId === "string"
          ? new Types.ObjectId(employeeProfile.userId)
          : employeeProfile.userId;

      console.log(
        `[CONTRACT APPROVAL] Sending contract to applicant ${applicantId.toString()}, targetUserId: ${targetUserIdObj.toString()}, tenantId: ${applicantTenantId.toString()}, branchId: ${applicantBranchId.toString()}, isResend: ${isResending}`
      );

      // Get user details for email
      console.log(
        `[CONTRACT APPROVAL] Fetching user details for userId: ${targetUserIdObj.toString()}`
      );
      const user = await User.findById(targetUserIdObj)
        .select("email fullName")
        .lean();

      if (!user) {
        console.error(
          `[CONTRACT APPROVAL] User not found for userId: ${targetUserIdObj.toString()}`
        );
      } else {
        console.log(
          `[CONTRACT APPROVAL] User found - Email: ${user.email || "NOT SET"}, FullName: ${user.fullName || "NOT SET"}`
        );
      }

      // Get applicant name from employee data
      console.log(
        `[CONTRACT APPROVAL] Fetching applicant employee details for employeeId: ${applicantId.toString()}`
      );
      const applicantEmployeeFull = await EmployeeModel.findById(applicantId)
        .select("employeeFields")
        .lean();

      const applicantFirstName =
        applicantEmployeeFull?.employeeFields?.personaldetails?.firstname || "";
      const applicantLastName =
        applicantEmployeeFull?.employeeFields?.personaldetails?.lastname || "";
      const applicantName =
        (applicantFirstName + " " + applicantLastName).trim() ||
        user?.fullName ||
        "there";

      console.log(
        `[CONTRACT APPROVAL] Applicant name resolved: "${applicantName}" (from employee fields: "${applicantFirstName} ${applicantLastName}".trim() or user.fullName: "${user?.fullName}")`
      );

      // Get tenant and organization names
      const tenant = await Tenant.findById(applicantTenantId)
        .select("name")
        .lean();
      const branch = await Branch.findOne({
        tenantId: applicantTenantId,
        _id: applicantBranchId,
      })
        .select("name")
        .lean();
      const tenantName = tenant?.name || "";
      const organizationName = branch?.name
        ? `${tenantName} - ${branch.name}`
        : tenantName;

      console.log(
        `[CONTRACT APPROVAL] Organization details - Tenant: "${tenantName}", Branch: "${branch?.name || "N/A"}", Organization: "${organizationName}"`
      );

      // Get contract template for version info
      const template = await ContractTemplate.findById(templateId)
        .select("version")
        .lean();
      const contractVersion = template?.version;

      console.log(
        `[CONTRACT APPROVAL] Contract template details - Title: "${templateTitle}", Version: "${contractVersion || "N/A"}"`
      );

      // Build view contract link (requires login)
      const frontendUrl =
        process.env.FRONTEND_URL ||
        process.env.APP_URL ||
        "http://localhost:3000";
      const viewContractLink = `${frontendUrl}/my-contracts`;

      // Generate public access token for viewing without login
      const crypto = require("crypto");
      const publicToken = crypto.randomBytes(32).toString("hex");

      // Store public token in approval document (expires in 30 days)
      approval.publicAccessToken = publicToken;
      approval.publicTokenExpiresAt = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ); // 30 days
      await approval.save();

      // Build public view contract link (no login required)
      const publicViewContractLink = `${frontendUrl}/public/contract/${templateId.toString()}/${applicantId.toString()}?token=${publicToken}`;

      console.log(
        `[CONTRACT APPROVAL] View contract link: ${viewContractLink}`
      );
      console.log(
        `[CONTRACT APPROVAL] Public view contract link: ${publicViewContractLink}`
      );

      // Send notification to applicant (wrap in try-catch to prevent notification errors from failing the operation)
      try {
        const notificationMessage = isResending
          ? `Your contract "${templateTitle}" has been resent for your review. Please review and respond.`
          : `Your contract "${templateTitle}" has been fully approved and is ready for your review.`;

        console.log(
          `[CONTRACT APPROVAL] Sending in-app notification to applicant userId: ${targetUserIdObj.toString()}`
        );
        const notification = await createNotification({
          tenantId: applicantTenantId,
          branchId: applicantBranchId,
          targetUserId: targetUserIdObj,
          message: notificationMessage,
          type: isResending ? "contract_resent" : "contract_approved",
          metadata: {
            templateId: templateId.toString(),
            templateTitle,
            applicantId: applicantId.toString(),
            action: "view_contract",
            isResend: isResending,
          },
        });

        console.log(
          `[CONTRACT APPROVAL] ✅ Notification sent successfully to applicant - Notification ID: ${notification._id}`
        );
      } catch (notificationError: any) {
        // Log notification error but don't fail the operation
        console.error(
          `[CONTRACT APPROVAL] ❌ Failed to send notification to applicant (operation still succeeded):`,
          {
            error: notificationError.message,
            stack: notificationError.stack,
            userId: targetUserIdObj.toString(),
          }
        );
        // The contract was still sent successfully, so we continue
      }

      // Send email to applicant (wrap in try-catch to prevent email errors from failing the operation)
      if (user?.email) {
        console.log(
          `[CONTRACT APPROVAL] 📧 Preparing to send email to applicant - Email Address: ${user.email}`
        );
        console.log(`[CONTRACT APPROVAL] Email details:`, {
          recipientEmail: user.email,
          recipientName: applicantName,
          contractTitle: templateTitle,
          contractVersion: contractVersion || "N/A",
          isResend: isResending,
          organizationName: organizationName || "N/A",
          viewContractLink: viewContractLink,
        });

        try {
          await emailService.sendContractToApplicantEmail({
            applicantEmail: user.email,
            applicantName,
            contractTitle: templateTitle,
            contractVersion,
            viewContractLink,
            publicViewContractLink,
            isResend: isResending,
            tenantName,
            organizationName,
          });

          console.log(
            `[CONTRACT APPROVAL] ✅ Email sent successfully to applicant - Email Address: ${user.email}, Recipient Name: ${applicantName}, Contract: "${templateTitle}"`
          );
        } catch (emailError: any) {
          // Log email error but don't fail the operation
          console.error(
            `[CONTRACT APPROVAL] ❌ Failed to send email to applicant (operation still succeeded):`,
            {
              error: emailError.message,
              stack: emailError.stack,
              recipientEmail: user.email,
              recipientName: applicantName,
              contractTitle: templateTitle,
              errorDetails: emailError,
            }
          );
          // The contract was still sent successfully, so we continue
        }
      } else {
        console.warn(
          `[CONTRACT APPROVAL] ⚠️ No email address found for applicant - UserId: ${targetUserIdObj.toString()}, ApplicantId: ${applicantId.toString()}`
        );
        console.warn(`[CONTRACT APPROVAL] User object:`, {
          userId: targetUserIdObj.toString(),
          userExists: !!user,
          userEmail: user?.email || "NOT SET",
          userFullName: user?.fullName || "NOT SET",
        });

        // Try to get email from employee fields as fallback
        const employeeEmail =
          applicantEmployeeFull?.employeeFields?.personaldetails?.email ||
          applicantEmployeeFull?.employeeFields?.main?.email ||
          applicantEmployeeFull?.employeeFields?.userId?.email;

        if (employeeEmail) {
          console.log(
            `[CONTRACT APPROVAL] 📧 Found email in employee fields - Email: ${employeeEmail}, attempting to send...`
          );
          try {
            await emailService.sendContractToApplicantEmail({
              applicantEmail: employeeEmail,
              applicantName,
              contractTitle: templateTitle,
              contractVersion,
              viewContractLink,
              publicViewContractLink,
              isResend: isResending,
              tenantName,
              organizationName,
            });

            console.log(
              `[CONTRACT APPROVAL] ✅ Email sent successfully to applicant (from employee fields) - Email Address: ${employeeEmail}, Recipient Name: ${applicantName}, Contract: "${templateTitle}"`
            );
          } catch (emailError: any) {
            console.error(
              `[CONTRACT APPROVAL] ❌ Failed to send email to applicant (from employee fields) (operation still succeeded):`,
              {
                error: emailError.message,
                stack: emailError.stack,
                recipientEmail: employeeEmail,
                recipientName: applicantName,
                contractTitle: templateTitle,
                errorDetails: emailError,
              }
            );
          }
        } else {
          console.warn(
            `[CONTRACT APPROVAL] ⚠️ No email found in employee fields either. Email cannot be sent.`
          );
        }
      }
    } else {
      console.warn(
        `[CONTRACT APPROVAL] ⚠️ No employeeProfile found for applicant employeeId: ${applicantId.toString()}`
      );
    }
  } else {
    console.warn(
      `[CONTRACT APPROVAL] ⚠️ No applicant employee found for applicantId: ${applicantId.toString()}`
    );
  }

  // Summary log
  console.log(`[CONTRACT APPROVAL] 📋 Contract send process completed:`, {
    applicantId: applicantId.toString(),
    templateId: templateId.toString(),
    templateTitle: templateTitle,
    isResend: isResending,
    sentToApplicantAt: approval.sentToApplicantAt,
    applicantStatus: approval.applicantStatus,
  });

  return approval.toObject() as IContractApproval;
}

/**
 * Params for creating a self-signed contract approval
 */
interface CreateSelfSignedApprovalParams {
  templateId: Types.ObjectId;
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  applicantId: Types.ObjectId;
  templateTitle: string;
  employerSignatureData: string;
  employerName: string;
  signedByUserId: Types.ObjectId;
}

/**
 * Create a self-signed contract approval (when no approvers are configured).
 * The employer signs the contract directly, making it ready for "Send to Applicant".
 */
export async function createSelfSignedApproval(
  params: CreateSelfSignedApprovalParams
): Promise<IContractApproval> {
  const {
    templateId,
    tenantId,
    branchId,
    applicantId,
    templateTitle,
    employerSignatureData,
    employerName,
    signedByUserId,
  } = params;

  console.log(
    `[CONTRACT APPROVAL] 📝 Creating self-signed approval: templateId=${templateId.toString()}, applicantId=${applicantId.toString()}`
  );

  // Check if approval already exists for this applicant
  let approval = await ContractApproval.findOne({
    templateId,
    tenantId,
    branchId,
    applicantId,
  });

  if (approval) {
    // Update existing approval with employer's signature
    approval.employerSignatureData = employerSignatureData;
    approval.employerSignedAt = new Date();
    approval.employerName = employerName;
    approval.signedByUserId = signedByUserId;
    approval.status = "approved"; // Self-signed means approved by employer
    await approval.save();
    console.log(
      `[CONTRACT APPROVAL] ✅ Updated existing approval with self-signature`
    );
  } else {
    // Create new approval with employer's signature
    approval = await ContractApproval.create({
      templateId,
      tenantId,
      branchId,
      applicantId,
      templateTitle,
      employeeApprovals: [], // No employee approvals for self-signed contracts
      employerSignatureData,
      employerSignedAt: new Date(),
      employerName,
      signedByUserId,
      status: "approved", // Self-signed means approved by employer
      sentAt: new Date(), // Mark as sent
    });
    console.log(`[CONTRACT APPROVAL] ✅ Created new self-signed approval`);
  }

  return approval.toObject() as IContractApproval;
}

export async function getMyContracts(
  employeeIds: Types.ObjectId[],
  tenantBranchPairs: Array<{
    tenantId: Types.ObjectId;
    branchId: Types.ObjectId;
  }>
): Promise<any[]> {
  if (tenantBranchPairs.length === 0 || employeeIds.length === 0) {
    return [];
  }

  console.log(
    `[CONTRACT APPROVAL SERVICE] getMyContracts called with ${employeeIds.length} employeeIds and ${tenantBranchPairs.length} tenant/branch pairs`
  );

  // Build query to find contracts sent to any of this user's employeeIds across all their organizations
  // We need to check all combinations of tenant/branch pairs with all employeeIds
  const queryConditions: any[] = [];

  for (const employeeId of employeeIds) {
    for (const { tenantId, branchId } of tenantBranchPairs) {
      queryConditions.push({
        tenantId,
        branchId,
        applicantId: employeeId,
        sentToApplicantAt: { $exists: true, $ne: null }, // Only contracts that have been sent
      });
    }
  }

  console.log(
    `[CONTRACT APPROVAL SERVICE] Querying with ${queryConditions.length} conditions`
  );

  const approvals = await ContractApproval.find({
    $or: queryConditions,
  })
    .populate({
      path: "templateId",
      select: "title description version",
    })
    .populate({
      path: "applicantId",
      select: "employeeFields employeeProfile",
    })
    .sort({ sentToApplicantAt: -1 }) // Most recently sent first
    .lean();

  console.log(
    `[CONTRACT APPROVAL SERVICE] Found ${approvals.length} contracts sent to applicant`
  );

  // Format the results
  return approvals.map((approval: any) => ({
    _id: approval._id,
    templateId: approval.templateId,
    applicantId: approval.applicantId,
    sentToApplicantAt: approval.sentToApplicantAt,
    applicantStatus: approval.applicantStatus || "pending",
    acceptedAt: approval.acceptedAt,
    rejectedAt: approval.rejectedAt,
    applicantNote: approval.applicantNote,
    applicantHistory: approval.applicantHistory || [], // Include applicant history array
    // Employer signature fields for self-sign flow
    employerSignatureData: approval.employerSignatureData,
    employerSignedAt: approval.employerSignedAt,
    employerName: approval.employerName,
    // Sender fields (new self-sign)
    senderSignatureData: approval.senderSignatureData,
    senderSignedAt: approval.senderSignedAt,
    selfSignRequired: approval.selfSignRequired,
    status: approval.status,
    employeeApprovals: approval.employeeApprovals || [],
    // Applicant signature fields
    applicantSignatureData: approval.applicantSignatureData,
    applicantSignedAt: approval.applicantSignedAt,
    createdAt: approval.createdAt,
    updatedAt: approval.updatedAt,
    tenantId: approval.tenantId,
    branchId: approval.branchId,
  }));
}

export async function hasPendingApprovals(
  templateId: Types.ObjectId,
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId
): Promise<boolean> {
  const approvals = await ContractApproval.find({
    templateId,
    tenantId,
    branchId,
  }).lean();

  // Check if any employee approval has pending status
  for (const approval of approvals) {
    const hasPending = approval.employeeApprovals.some(
      (ea: IEmployeeApproval) => ea.status === "pending"
    );
    if (hasPending) {
      return true;
    }
  }

  return false;
}

export interface AcceptRejectContractParams {
  templateId: Types.ObjectId;
  applicantId: Types.ObjectId;
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  action: "accept" | "reject";
  note?: string;
  signatureData?: string;
}

export async function acceptOrRejectContract(
  params: AcceptRejectContractParams
): Promise<IContractApproval | null> {
  const {
    templateId,
    applicantId,
    tenantId,
    branchId,
    action,
    note,
    signatureData,
  } = params;

  console.log(
    `[ACCEPT/REJECT CONTRACT] Called with action=${action}, signatureData=${signatureData ? "present (length: " + signatureData.length + ")" : "missing"}, templateId=${templateId}, applicantId=${applicantId}`
  );

  // Find the approval document
  const approval = await ContractApproval.findOne({
    templateId,
    applicantId,
    tenantId,
    branchId,
  });

  if (!approval) {
    return null;
  }

  // Verify contract was sent to applicant
  if (!approval.sentToApplicantAt) {
    throw new Error("Contract has not been sent to applicant yet");
  }

  // Check if already responded (only if we want to prevent multiple responses)
  // For now, we'll allow history tracking but prevent duplicate responses
  // If the contract is resent after rejection, this validation can be updated
  if (approval.applicantStatus && approval.applicantStatus !== "pending") {
    throw new Error(`Contract has already been ${approval.applicantStatus}`);
  }

  // Initialize applicantHistory if it doesn't exist
  if (!approval.applicantHistory) {
    approval.applicantHistory = [];
  }

  // Create history entry for this action
  const historyEntry = {
    status:
      action === "accept"
        ? "accepted"
        : ("rejected" as "accepted" | "rejected"),
    note: note || undefined,
    respondedAt: new Date(),
    createdAt: new Date(),
  };

  // Append to history (preserving all previous entries)
  approval.applicantHistory.push(historyEntry);

  // Update approval document (current/latest status)
  if (action === "accept") {
    approval.applicantStatus = "accepted";
    approval.acceptedAt = new Date();
    approval.rejectedAt = undefined;

    // Save applicant signature if provided
    if (signatureData) {
      approval.applicantSignatureData = signatureData;
      approval.applicantSignedAt = new Date();
    }
  } else {
    approval.applicantStatus = "rejected";
    approval.rejectedAt = new Date();
    approval.acceptedAt = undefined;
  }

  // Update current/latest note
  if (note) {
    approval.applicantNote = note;
  }

  await approval.save();

  console.log(
    `[CONTRACT SNAPSHOT DEBUG] After save - action=${action}, signatureData=${signatureData ? "present" : "missing"}, will create snapshot: ${action === "accept" && !!signatureData}`
  );

  // Create contract snapshot when applicant accepts (with signature)
  if (action === "accept" && signatureData) {
    try {
      console.log(
        `[CONTRACT SNAPSHOT] Creating snapshot for approval ${approval._id}...`
      );

      // Fetch full template data for snapshot
      const fullTemplate = await ContractTemplate.findById(templateId).lean();

      // Fetch full applicant employee data for snapshot
      const fullApplicant = await EmployeeModel.findById(applicantId)
        .populate("designation", "name")
        .lean();

      // Fetch organization data for snapshot
      const tenantData = await Tenant.findById(tenantId).lean();
      const branchData = await Branch.findById(branchId).lean();

      // Build employee approvals snapshot with populated data
      const employeeApprovalsSnapshot = await Promise.all(
        (approval.employeeApprovals || [])
          .filter((ea: any) => ea.signatureData)
          .map(async (ea: any) => {
            // Get employee details for the approver
            let employeeName = "";
            let designation = "";

            const emp = await EmployeeModel.findById(ea.employeeId)
              .populate("designation", "name")
              .lean();

            if (emp) {
              const firstName =
                (emp as any).employeeFields?.personaldetails?.firstname || "";
              const lastName =
                (emp as any).employeeFields?.personaldetails?.lastname || "";
              employeeName = `${firstName} ${lastName}`.trim();

              // Manual fetch for designation to ensure reliability
              if ((emp as any).designation) {
                try {
                  const DesignationModel =
                    require("@/database/models/designation.model").Designation;
                  const desigId =
                    (emp as any).designation._id || (emp as any).designation;
                  if (desigId) {
                    const desigDoc = await DesignationModel.findById(desigId)
                      .select("name")
                      .lean();
                    designation = desigDoc?.name || "";
                  }
                } catch (dErr) {
                  console.log("Error fetching designation for snapshot:", dErr);
                  designation = (emp as any).designation?.name || "";
                }
              }
            }

            return {
              employeeId: ea.employeeId,
              employeeName,
              designation,
              signatureData: ea.signatureData,
              signedAt: ea.respondedAt,
              status: ea.status,
            };
          })
      );

      // Create the snapshot document
      const snapshot = new ContractSnapshot({
        approvalId: approval._id,
        templateId: templateId,
        applicantId: applicantId,
        tenantId: tenantId,
        branchId: branchId,
        templateSnapshot: {
          title: fullTemplate?.title || "",
          description: fullTemplate?.description,
          version: fullTemplate?.version,
          builder: fullTemplate?.builder,
          category: (fullTemplate as any)?.category,
        },
        applicantSnapshot: {
          employeeFields: (fullApplicant as any)?.employeeFields,
          designation: (fullApplicant as any)?.designation,
          department: (fullApplicant as any)?.department,
          employmentDetails: (fullApplicant as any)?.employmentDetails,
        },
        organizationSnapshot: {
          tenantName: tenantData?.name,
          branchName: branchData?.name,
          employerName: tenantData?.name,
          abn: (tenantData as any)?.abn,
          address: (tenantData as any)?.address,
        },
        employerSignatureData: approval.employerSignatureData,
        employerSignedAt: approval.employerSignedAt,
        employerName: approval.employerName,
        applicantSignatureData: signatureData,
        applicantSignedAt: new Date(),
        employeeApprovals: employeeApprovalsSnapshot,
      });

      await snapshot.save();
      console.log(
        `[CONTRACT SNAPSHOT] Snapshot created successfully: ${snapshot._id}`
      );
    } catch (snapshotError: any) {
      // Log error but don't fail the accept operation
      console.error(
        `[CONTRACT SNAPSHOT] Failed to create snapshot (approval still succeeded):`,
        snapshotError.message
      );
    }
  }

  // Get template for notification
  const template = await ContractTemplate.findById(templateId)
    .select("title")
    .lean();
  const templateTitle = template?.title || "Contract";

  // Get tenant/branch admins to notify
  const tenant = await Tenant.findById(tenantId).select("name").lean();
  const branch = await Branch.findById(branchId).select("name").lean();

  // Find tenant-owner/admin users for this tenant/branch to notify
  // Query users where at least one assignment matches the tenant/branch and role
  const adminUsers = await User.find({
    assignments: {
      $elemMatch: {
        tenantId: tenantId,
        branchId: branchId,
        role: { $in: ["tenant-owner", "admin"] },
      },
    },
  })
    .select("_id")
    .lean();

  // Send notifications to admins (wrap in try-catch to prevent notification errors from failing the operation)
  for (const adminUser of adminUsers) {
    try {
      await createNotification({
        tenantId,
        branchId,
        targetUserId: adminUser._id as Types.ObjectId,
        message: `Contract "${templateTitle}" has been ${action === "accept" ? "accepted" : "rejected"} by the applicant.`,
        type: action === "accept" ? "contract_accepted" : "contract_rejected",
        metadata: {
          templateId: templateId.toString(),
          templateTitle,
          applicantId: applicantId.toString(),
          action: action === "accept" ? "accepted" : "rejected",
          note: note || undefined,
        },
      });
    } catch (err) {
      // Log notification error but don't fail the operation
      console.error(
        `[CONTRACT APPROVAL] Failed to send notification to admin ${adminUser._id} (operation still succeeded):`,
        err
      );
    }
  }

  console.log(
    `[CONTRACT APPROVAL] Contract ${action === "accept" ? "accepted" : "rejected"} by applicant ${applicantId.toString()}`
  );

  return approval.toObject() as IContractApproval;
}

/**
 * Get contract by public access token (for viewing without login)
 */
export async function getContractByPublicToken(
  templateId: Types.ObjectId,
  applicantId: Types.ObjectId,
  token: string
): Promise<IContractApproval | null> {
  const approval = await ContractApproval.findOne({
    templateId,
    applicantId,
    publicAccessToken: token,
    publicTokenExpiresAt: { $gt: new Date() }, // Token must not be expired
  })
    .populate({
      path: "employeeApprovals.employeeId",
      select: "employeeFields designation",
    })
    .lean();

  if (!approval) {
    return null;
  }

  // Verify contract was sent to applicant
  if (!approval.sentToApplicantAt) {
    return null;
  }

  // Manually fetch designation names since nested populate may not work reliably
  const designationIds = new Set<string>();
  for (const ea of approval.employeeApprovals || []) {
    const emp = ea.employeeId as any;
    if (emp && emp._id && emp.designation) {
      const desigId =
        typeof emp.designation === "object" && emp.designation._id
          ? emp.designation._id.toString()
          : emp.designation.toString();
      designationIds.add(desigId);
    }
  }

  // Fetch all designations at once
  const designationIdArray = Array.from(designationIds);
  const designations =
    designationIdArray.length > 0
      ? await Designation.find({ _id: { $in: designationIdArray } })
          .select("name")
          .lean()
      : [];

  // Create a map for quick lookup
  const designationMap = new Map<string, string>();
  for (const d of designations) {
    designationMap.set(d._id.toString(), d.name);
  }

  // Inject designation name into each employee approval
  if (approval.employeeApprovals) {
    for (const ea of approval.employeeApprovals) {
      const emp = ea.employeeId as any;
      if (emp && emp._id && emp.designation) {
        const desigId =
          typeof emp.designation === "object" && emp.designation._id
            ? emp.designation._id.toString()
            : emp.designation.toString();
        const desigName = designationMap.get(desigId);
        if (desigName) {
          // Inject as a populated object-like structure
          emp.designation = { _id: desigId, name: desigName };
        }
      }
    }
  }

  return approval as IContractApproval;
}

/**
 * Generate and send OTP for accepting/rejecting contract (public access)
 */
export async function generateOTPForContract(
  templateId: Types.ObjectId,
  applicantId: Types.ObjectId,
  token: string
): Promise<{ success: boolean; message: string }> {
  const approval = await ContractApproval.findOne({
    templateId,
    applicantId,
    publicAccessToken: token,
    publicTokenExpiresAt: { $gt: new Date() },
  });

  if (!approval) {
    throw new Error("Invalid or expired access token");
  }

  // Verify contract was sent to applicant
  if (!approval.sentToApplicantAt) {
    throw new Error("Contract has not been sent to applicant yet");
  }

  // Check if already responded
  if (approval.applicantStatus && approval.applicantStatus !== "pending") {
    throw new Error(`Contract has already been ${approval.applicantStatus}`);
  }

  // Generate 6-digit OTP
  const crypto = require("crypto");
  const otpCode = crypto.randomInt(100000, 999999).toString();

  // Store OTP (expires in 10 minutes)
  approval.otpCode = otpCode;
  approval.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await approval.save();

  // Get applicant email
  const applicant = await EmployeeModel.findById(applicantId)
    .populate("employeeProfile")
    .lean();

  if (!applicant) {
    throw new Error("Applicant not found");
  }

  const userId = (applicant.employeeProfile as any)?.userId;
  const user = await User.findById(userId).select("email fullName").lean();

  if (!user?.email) {
    throw new Error("Applicant email not found");
  }

  // Send OTP via email
  try {
    await emailService.sendContractOTPEmail({
      recipientEmail: user.email,
      recipientName: user.fullName || "there",
      otpCode,
    });
  } catch (emailError: any) {
    console.error("[CONTRACT APPROVAL] Failed to send OTP email:", emailError);
    throw new Error("Failed to send OTP email");
  }

  return {
    success: true,
    message: "OTP sent successfully to your email",
  };
}

/**
 * Verify OTP and accept/reject contract (public access)
 */
export interface PublicAcceptRejectContractParams {
  templateId: Types.ObjectId;
  applicantId: Types.ObjectId;
  token: string;
  action: "accept" | "reject";
  otpCode: string;
  note?: string;
  signatureData?: string; // Optional: base64 signature image for accept
}

export async function publicAcceptOrRejectContract(
  params: PublicAcceptRejectContractParams
): Promise<IContractApproval | null> {
  const {
    templateId,
    applicantId,
    token,
    action,
    otpCode,
    note,
    signatureData,
  } = params;

  // Find approval by public token
  const approval = await ContractApproval.findOne({
    templateId,
    applicantId,
    publicAccessToken: token,
    publicTokenExpiresAt: { $gt: new Date() },
  });

  if (!approval) {
    throw new Error("Invalid or expired access token");
  }

  // Verify contract was sent to applicant
  if (!approval.sentToApplicantAt) {
    throw new Error("Contract has not been sent to applicant yet");
  }

  // Verify OTP
  if (!approval.otpCode || approval.otpCode !== otpCode) {
    throw new Error("Invalid OTP code");
  }

  if (!approval.otpExpiresAt || approval.otpExpiresAt < new Date()) {
    throw new Error("OTP has expired. Please request a new one.");
  }

  // Check if already responded
  if (approval.applicantStatus && approval.applicantStatus !== "pending") {
    throw new Error(`Contract has already been ${approval.applicantStatus}`);
  }

  // Initialize applicantHistory if it doesn't exist
  if (!approval.applicantHistory) {
    approval.applicantHistory = [];
  }

  // Create history entry for this action
  const historyEntry = {
    status:
      action === "accept"
        ? "accepted"
        : ("rejected" as "accepted" | "rejected"),
    note: note || undefined,
    respondedAt: new Date(),
    createdAt: new Date(),
  };

  // Append to history
  approval.applicantHistory.push(historyEntry);

  // Update approval document
  if (action === "accept") {
    approval.applicantStatus = "accepted";
    approval.acceptedAt = new Date();
    approval.rejectedAt = undefined;

    // Save applicant signature if provided
    if (signatureData) {
      approval.applicantSignatureData = signatureData;
      approval.applicantSignedAt = new Date();
    }
  } else {
    approval.applicantStatus = "rejected";
    approval.rejectedAt = new Date();
    approval.acceptedAt = undefined;
  }

  // Update current/latest note
  if (note) {
    approval.applicantNote = note;
  }

  // Clear OTP after successful use
  approval.otpCode = undefined;
  approval.otpExpiresAt = undefined;

  await approval.save();

  // Create snapshot if contract was accepted
  if (action === "accept") {
    console.log(
      `[CONTRACT APPROVAL] Creating snapshot for approval ${approval._id}...`
    );
    console.log(
      `[CONTRACT APPROVAL] signatureData received: ${signatureData ? "yes (" + signatureData.substring(0, 50) + "...)" : "no"}`
    );

    try {
      // Fetch template data for snapshot
      const template = await ContractTemplate.findById(templateId).lean();
      console.log(
        `[CONTRACT APPROVAL] Template fetched: ${template ? "yes" : "no"}`
      );

      // Fetch applicant data for snapshot
      const applicant = await EmployeeModel.findById(applicantId)
        .populate("designation")
        .lean();
      console.log(
        `[CONTRACT APPROVAL] Applicant fetched: ${applicant ? "yes" : "no"}`
      );

      // Fetch organization data
      const tenant = await Tenant.findById(approval.tenantId)
        .select("name")
        .lean();
      const branch = await Branch.findById(approval.branchId)
        .select("name")
        .lean();

      if (template && applicant) {
        // Enrich employee approvals with Name and Designation before saving to snapshot
        let enrichedEmployeeApprovals = approval.employeeApprovals || [];
        try {
          if (enrichedEmployeeApprovals.length > 0) {
            const empIds = enrichedEmployeeApprovals.map(
              (ea: any) => ea.employeeId
            );
            const employees = await EmployeeModel.find({
              _id: { $in: empIds },
            }).lean();

            // Manual fetch for designations
            const desigIds = employees
              .map(
                (e: any) =>
                  e.designation && (e.designation._id || e.designation)
              )
              .filter((id: any) => id);

            let designationMap: Record<string, string> = {};
            if (desigIds.length > 0) {
              try {
                const DesignationModel =
                  require("@/database/models/designation.model").Designation;
                const designations = await DesignationModel.find({
                  _id: { $in: desigIds },
                })
                  .select("name")
                  .lean();
                designations.forEach((d: any) => {
                  designationMap[d._id.toString()] = d.name;
                });
              } catch (dErr) {
                console.error(
                  "Error fetching designations for snapshot enrichment:",
                  dErr
                );
              }
            }

            enrichedEmployeeApprovals = enrichedEmployeeApprovals.map(
              (ea: any) => {
                const eaObj = ea.toObject ? ea.toObject() : ea;
                const empIdStr = ea.employeeId.toString();
                const emp = employees.find(
                  (e: any) => e._id.toString() === empIdStr
                );

                if (emp) {
                  const firstName =
                    emp.employeeFields?.personaldetails?.firstname || "";
                  const lastName =
                    emp.employeeFields?.personaldetails?.lastname || "";

                  return {
                    ...eaObj,
                    employeeName: `${firstName} ${lastName}`.trim(),
                    designation:
                      (emp.designation &&
                        designationMap[
                          (emp.designation._id || emp.designation).toString()
                        ]) ||
                      "",
                  };
                }
                return eaObj;
              }
            );
          }
        } catch (enrichError) {
          console.error(
            "[CONTRACT APPROVAL] Failed to enrich employee approvals for snapshot:",
            enrichError
          );
          // Fallback to original if enrichment fails, to ensure snapshot is still created
          enrichedEmployeeApprovals = (approval.employeeApprovals || []).map(
            (ea: any) => (ea.toObject ? ea.toObject() : ea)
          );
        }

        // Create the snapshot - structure must match ContractSnapshot schema
        const snapshotData = {
          approvalId: approval._id,
          templateId: templateId,
          applicantId: applicantId,
          tenantId: approval.tenantId,
          branchId: approval.branchId,
          createdAt: new Date(),
          templateSnapshot: {
            title: template.title,
            description: template.description,
            version: template.version,
            category: (template as any).category,
            builder: template.builder,
          },
          applicantSnapshot: {
            employeeFields: applicant.employeeFields,
            employeeProfile: applicant.employeeProfile,
            designation: applicant.designation,
            email: (applicant as any).email,
          },
          organizationSnapshot: {
            tenantName: tenant?.name,
            branchName: branch?.name,
          },
          // Signature fields at top level (as per schema)
          employerSignatureData: approval.employerSignatureData,
          employerName: approval.employerName,
          employerSignedAt: approval.employerSignedAt,
          applicantSignatureData: signatureData, // Required field
          applicantSignedAt: new Date(), // Required field
          employeeApprovals: enrichedEmployeeApprovals,
        };

        console.log(
          `[CONTRACT APPROVAL] Creating snapshot with approvalId: ${approval._id}`
        );
        const createdSnapshot = await ContractSnapshot.create(snapshotData);
        console.log(
          `[CONTRACT APPROVAL] Snapshot created successfully with ID: ${createdSnapshot._id}`
        );
      } else {
        console.log(
          `[CONTRACT APPROVAL] Missing data for snapshot - template: ${!!template}, applicant: ${!!applicant}`
        );
      }
    } catch (snapshotError) {
      console.error(
        "[CONTRACT APPROVAL] Failed to create snapshot:",
        snapshotError
      );
      // Don't fail the acceptance just because snapshot creation failed
    }
  }

  // Get template for notification
  const template = await ContractTemplate.findById(templateId)
    .select("title")
    .lean();
  const templateTitle = template?.title || "Contract";

  // Get tenant/branch from approval
  const tenantId = approval.tenantId;
  const branchId = approval.branchId;

  // Find tenant/branch admins to notify
  const tenant = await Tenant.findById(tenantId).select("name").lean();
  const branch = await Branch.findById(branchId).select("name").lean();

  // Find tenant-owner/admin users for this tenant/branch to notify
  const adminUsers = await User.find({
    assignments: {
      $elemMatch: {
        tenantId: tenantId,
        branchId: branchId,
        role: { $in: ["tenant-owner", "admin"] },
      },
    },
  })
    .select("_id")
    .lean();

  // Send notifications to admins
  for (const adminUser of adminUsers) {
    try {
      await createNotification({
        tenantId,
        branchId,
        targetUserId: adminUser._id as Types.ObjectId,
        message: `Contract "${templateTitle}" has been ${action === "accept" ? "accepted" : "rejected"} by the applicant.`,
        type: action === "accept" ? "contract_accepted" : "contract_rejected",
        metadata: {
          templateId: templateId.toString(),
          templateTitle,
          applicantId: applicantId.toString(),
          action: action === "accept" ? "accepted" : "rejected",
          note: note || undefined,
        },
      });
    } catch (notificationError) {
      console.error(
        "[CONTRACT APPROVAL] Failed to send notification:",
        notificationError
      );
    }
  }

  console.log(
    `[CONTRACT APPROVAL] Contract ${action === "accept" ? "accepted" : "rejected"} by applicant ${applicantId.toString()} via public access`
  );

  return approval;
}

/**
 * Get contract snapshot by approval ID
 * Returns the saved snapshot if it exists, for rendering finalized contracts
 */
export async function getSnapshotByApprovalId(
  approvalId: Types.ObjectId
): Promise<any | null> {
  const snapshot = await ContractSnapshot.findOne({ approvalId }).lean();
  return snapshot;
}
