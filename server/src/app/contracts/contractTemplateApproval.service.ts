import { Types } from "mongoose";
import {
  ContractTemplateApproval,
  IContractTemplateApproval,
} from "@/database/models/contractTemplateApproval.model";
import EmployeeModel from "@/database/models/employee.model";
import { EmployeeProfile } from "@/database/models/employeeProfile.model";
import { createNotification } from "@/services/notification.service";

// Drop old unique index on startup if it exists
export async function migrateContractApprovalIndexes() {
  try {
    const collection = ContractTemplateApproval.collection;
    const indexes = await collection.indexes();

    // Check if old index exists (templateId_1_employeeId_1 without applicantId)
    const oldIndex = indexes.find(
      (idx: any) =>
        idx.key?.templateId === 1 &&
        idx.key?.employeeId === 1 &&
        !idx.key?.applicantId &&
        idx.unique === true
    );

    if (oldIndex) {
      console.log(
        "[CONTRACT APPROVAL] Dropping old unique index: templateId_1_employeeId_1"
      );
      await collection.dropIndex(oldIndex.name);
      console.log("[CONTRACT APPROVAL] Old index dropped successfully");
    }
  } catch (error: any) {
    // Index might not exist, which is fine
    if (error.code !== 27) {
      // 27 = IndexNotFound
      console.error("[CONTRACT APPROVAL] Error migrating indexes:", error);
    }
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
  applicantId?: Types.ObjectId; // The employee whose contract is being sent for approval
  selfSignRequired?: boolean; // Whether sender needs to sign
  senderUserId?: Types.ObjectId; // The user who sent the approval
}

export async function sendApprovalRequests(
  params: SendApprovalParams
): Promise<IContractTemplateApproval[]> {
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

  const approvalRecords: IContractTemplateApproval[] = [];

  // Ensure applicantId is always set (required for proper tracking)
  // If not provided, this should be handled by the caller, but we'll use a fallback for safety
  const finalApplicantId = applicantId;

  for (const emp of employees) {
    const employeeId = new Types.ObjectId(emp.employeeId);

    // Check if approval already exists for this template+employee+applicant combination
    const query: any = {
      templateId,
      employeeId,
      applicantId: finalApplicantId || employeeId, // Use applicantId if provided, otherwise employeeId
    };

    const existing = await ContractTemplateApproval.findOne(query).lean();

    if (existing) {
      // Skip if already exists (preserve existing status)
      approvalRecords.push(existing as IContractTemplateApproval);
      continue;
    }

    // Create new approval record
    // Always set applicantId (required for proper tracking per applicant)
    const approval = await ContractTemplateApproval.create({
      templateId,
      tenantId,
      branchId,
      employeeId,
      applicantId: finalApplicantId || employeeId, // Always set applicantId
      requireSignature: emp.requireSignature || false,
      signatureType: emp.signatureType,
      status: "pending",
      selfSignRequired: selfSignRequired || false,
      senderUserId: senderUserId,
    });

    approvalRecords.push(approval.toObject() as IContractTemplateApproval);

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
        requireSignature: emp.requireSignature || false,
        signatureType: emp.signatureType,
        action: "approve_or_reject",
      },
    });

    console.log(
      `[CONTRACT APPROVAL] Notification created: ${notification._id}, targetUserId: ${notification.targetUserId?.toString()}, tenantId: ${notification.tenantId?.toString()}, branchId: ${notification.branchId?.toString()}`
    );
  }

  return approvalRecords;
}

export async function getApprovals(
  templateId: Types.ObjectId,
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId
): Promise<any[]> {
  const approvals = await ContractTemplateApproval.find({
    templateId,
    tenantId,
    branchId,
  })
    .sort({ createdAt: -1 })
    .lean();

  // Normalize employeeId and applicantId to string for consistent frontend handling
  return approvals.map((approval: any) => ({
    ...approval,
    employeeId: approval.employeeId?.toString() || approval.employeeId,
    applicantId:
      approval.applicantId?.toString() || approval.applicantId || null,
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
  const totalCount = await ContractTemplateApproval.countDocuments({
    tenantId,
    branchId,
  });
  console.log(
    `[CONTRACT APPROVAL SERVICE] Total approvals in DB: ${totalCount}`
  );

  const approvals = await ContractTemplateApproval.find({
    tenantId,
    branchId,
  })
    .populate({
      path: "templateId",
      select: "title description version",
    })
    .populate({
      path: "employeeId",
      select: "employeeFields employeeProfile",
    })
    .populate({
      path: "applicantId",
      select: "employeeFields employeeProfile",
    })
    .sort({ createdAt: -1 })
    .lean();

  console.log(
    `[CONTRACT APPROVAL SERVICE] Found ${approvals.length} approvals after populate`
  );
  if (approvals.length > 0) {
    console.log(
      `[CONTRACT APPROVAL SERVICE] Sample approval structure:`,
      JSON.stringify(approvals[0], null, 2)
    );
  }

  // Preserve populated data and add normalized IDs
  return approvals.map((approval: any) => {
    const result: any = {
      ...approval,
    };

    // Preserve populated template data
    if (
      approval.templateId &&
      typeof approval.templateId === "object" &&
      approval.templateId._id
    ) {
      result.templateId = approval.templateId;
    } else {
      result.templateId =
        approval.templateId?.toString() || approval.templateId;
    }

    // Preserve populated employee data
    if (
      approval.employeeId &&
      typeof approval.employeeId === "object" &&
      approval.employeeId._id
    ) {
      result.employeeId = approval.employeeId;
    } else {
      result.employeeId =
        approval.employeeId?.toString() || approval.employeeId;
    }

    // Preserve populated applicant data (if exists)
    if (
      approval.applicantId &&
      typeof approval.applicantId === "object" &&
      approval.applicantId._id
    ) {
      result.applicantId = approval.applicantId;
    } else if (approval.applicantId) {
      result.applicantId = approval.applicantId.toString();
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
  const result = await ContractTemplateApproval.deleteOne({
    templateId,
    employeeId,
    tenantId,
    branchId,
  });
  return result.deletedCount > 0;
}

export async function hasPendingApprovals(
  templateId: Types.ObjectId,
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId
): Promise<boolean> {
  const count = await ContractTemplateApproval.countDocuments({
    templateId,
    tenantId,
    branchId,
    status: "pending",
  });
  return count > 0;
}

export interface UpdateApprovalParams {
  templateId: Types.ObjectId;
  employeeId: Types.ObjectId;
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  requireSignature?: boolean;
  signatureType?: "typed" | "drawn" | "upload";
}

export async function updateApproval(
  params: UpdateApprovalParams
): Promise<IContractTemplateApproval | null> {
  const {
    templateId,
    employeeId,
    tenantId,
    branchId,
    requireSignature,
    signatureType,
  } = params;

  const updateData: any = {};
  if (requireSignature !== undefined) {
    updateData.requireSignature = requireSignature;
  }
  if (signatureType !== undefined) {
    updateData.signatureType = signatureType;
  }

  const approval = await ContractTemplateApproval.findOneAndUpdate(
    {
      templateId,
      employeeId,
      tenantId,
      branchId,
    },
    updateData,
    { new: true }
  ).lean();

  return approval as IContractTemplateApproval | null;
}

export interface SendSingleApprovalParams {
  templateId: Types.ObjectId;
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  employeeId: Types.ObjectId;
  requireSignature: boolean;
  signatureType?: "typed" | "drawn" | "upload";
  templateTitle: string;
}

export async function sendSingleApprovalRequest(
  params: SendSingleApprovalParams
): Promise<IContractTemplateApproval> {
  const {
    templateId,
    tenantId,
    branchId,
    employeeId,
    requireSignature,
    signatureType,
    templateTitle,
  } = params;

  // Check if approval already exists
  const existing = await ContractTemplateApproval.findOne({
    templateId,
    employeeId,
  }).lean();

  if (existing) {
    throw new Error("Approval request already sent for this employee");
  }

  // Create new approval record
  const approval = await ContractTemplateApproval.create({
    templateId,
    tenantId,
    branchId,
    employeeId,
    requireSignature: requireSignature || false,
    signatureType,
    status: "pending",
  });

  // Get employee to find employeeProfile ID and employee's tenantId/branchId
  const employee = await EmployeeModel.findById(employeeId)
    .select("employeeProfile tenantId branchId")
    .lean();

  if (!employee?.employeeProfile) {
    console.error(
      `[CONTRACT APPROVAL] Employee ${employeeId.toString()} has no employeeProfile`
    );
    return approval.toObject() as IContractTemplateApproval;
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
    return approval.toObject() as IContractTemplateApproval;
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
      requireSignature: requireSignature || false,
      signatureType,
      action: "approve_or_reject",
    },
  });

  console.log(
    `[CONTRACT APPROVAL] Notification created: ${notification._id}, targetUserId: ${notification.targetUserId?.toString()}, tenantId: ${notification.tenantId?.toString()}, branchId: ${notification.branchId?.toString()}`
  );

  return approval.toObject() as IContractTemplateApproval;
}

export interface SendAllApprovalsParams {
  templateId: Types.ObjectId;
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  employeeSettings: Array<{
    employeeId: string;
    requireSignature: boolean;
    signatureType?: "typed" | "drawn" | "upload";
  }>;
  templateTitle: string;
}

export async function sendAllPendingApprovals(
  params: SendAllApprovalsParams
): Promise<IContractTemplateApproval[]> {
  const { templateId, tenantId, branchId, employeeSettings, templateTitle } =
    params;

  // Get all existing approvals
  const existingApprovals = await ContractTemplateApproval.find({
    templateId,
    tenantId,
    branchId,
  }).lean();

  const existingEmployeeIds = new Set(
    existingApprovals.map((a) => a.employeeId.toString())
  );

  // Filter employees who haven't been sent yet
  const employeesToSend = employeeSettings.filter(
    (emp) => !existingEmployeeIds.has(emp.employeeId)
  );

  if (employeesToSend.length === 0) {
    return existingApprovals as IContractTemplateApproval[];
  }

  const newApprovals: IContractTemplateApproval[] = [];

  for (const emp of employeesToSend) {
    const employeeId = new Types.ObjectId(emp.employeeId);

    // Create new approval record
    const approval = await ContractTemplateApproval.create({
      templateId,
      tenantId,
      branchId,
      employeeId,
      requireSignature: emp.requireSignature || false,
      signatureType: emp.signatureType,
      status: "pending",
    });

    newApprovals.push(approval.toObject() as IContractTemplateApproval);

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
        requireSignature: emp.requireSignature || false,
        signatureType: emp.signatureType,
        action: "approve_or_reject",
      },
    });

    console.log(
      `[CONTRACT APPROVAL] Notification created: ${notification._id}, targetUserId: ${notification.targetUserId?.toString()}, tenantId: ${notification.tenantId?.toString()}, branchId: ${notification.branchId?.toString()}`
    );
  }

  // Return all approvals (existing + new)
  return [...existingApprovals, ...newApprovals] as IContractTemplateApproval[];
}
