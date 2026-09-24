import { Response } from "express";
import { Types, isValidObjectId } from "mongoose";
import { WithUser } from "@/common/middlewares/authMiddleware";
import * as service from "./contractTemplate.service";
import * as approvalService from "./contractApproval.service";
import * as pdfService from "./contractPdf.service";
import EmployeeModel from "@/database/models/employee.model";
import { EmployeeProfile } from "@/database/models/employeeProfile.model";
import { ContractApproval } from "@/database/models/contractApproval.model";
import { ContractTemplateApproval } from "@/database/models/contractTemplateApproval.model";
import { ContractSnapshot } from "@/database/models/contractSnapshot.model";
import type PDFDocumentType from "pdfkit";

export async function create(req: WithUser, res: Response) {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const userId = new Types.ObjectId(req.user.userId);

  const {
    title,
    description,
    contractTypeId,
    contractTypeIds,
    employmentType,
    employmentTypes,
    designationIds,
    designationId,
    version,
    recommended,
    builder,
  } = req.body as any;

  // Normalize contractTypeIds: accept array or single value (backward compatible)
  const normalizedContractTypeIds: string[] = Array.isArray(contractTypeIds)
    ? contractTypeIds.filter((id: any) => id && isValidObjectId(String(id)))
    : contractTypeId && isValidObjectId(String(contractTypeId))
      ? [String(contractTypeId)]
      : [];

  if (normalizedContractTypeIds.length === 0) {
    return res.status(400).json({ message: "Invalid contractTypeId(s)" });
  }

  // Normalize employmentTypes: accept array or single value (backward compatible)
  const normalizedEmploymentTypes: string[] = Array.isArray(employmentTypes)
    ? employmentTypes.map((et: any) => String(et)).filter(Boolean)
    : employmentType
      ? [String(employmentType)]
      : [];

  // Normalize designationIds: prefer array from body; fallback to single designationId
  const normalizedDesignationIds: Types.ObjectId[] = Array.isArray(
    designationIds
  )
    ? (designationIds as string[])
        .filter((id) => isValidObjectId(id))
        .map((id) => new Types.ObjectId(id))
    : designationId && isValidObjectId(designationId)
      ? [new Types.ObjectId(designationId)]
      : [];

  const doc = await service.create({
    tenantId,
    branchId,
    userId,
    contractTypeIds: normalizedContractTypeIds.map(
      (id) => new Types.ObjectId(id)
    ),
    employmentTypes: normalizedEmploymentTypes,
    designationIds: normalizedDesignationIds,
    title,
    description,
    version,
    recommended,
    builder,
  });

  return res
    .status(201)
    .json({ message: "Contract template created", data: doc });
}

export async function list(req: WithUser, res: Response) {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const { search, contractTypeId, employmentType, designationId } =
    req.query as {
      search?: string;
      contractTypeId?: string;
      employmentType?: string;
      designationId?: string;
    };

  const docs = await service.list({
    tenantId,
    branchId,
    search,
    contractTypeId:
      contractTypeId && isValidObjectId(contractTypeId)
        ? new Types.ObjectId(contractTypeId)
        : undefined,
    employmentType: employmentType || undefined,
    designationId:
      designationId && isValidObjectId(designationId)
        ? new Types.ObjectId(designationId)
        : undefined,
  });
  return res
    .status(200)
    .json({ message: "Fetched contract templates", data: docs });
}

export async function remove(req: WithUser, res: Response) {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const id = new Types.ObjectId(req.params.id);
  const ok = await service.remove(tenantId, branchId, id);
  if (!ok) return res.status(404).json({ message: "Template not found" });
  return res.status(200).json({ message: "Deleted" });
}

export async function get(req: WithUser, res: Response) {
  const templateId = new Types.ObjectId(req.params.id);

  // Permission is already validated by checkPermission middleware
  // Use activeAssignment to get tenant/branch
  if (
    !req.user.activeAssignment?.tenantId ||
    !req.user.activeAssignment?.branchId
  ) {
    return res.status(400).json({
      message: "No active organization assignment found",
    });
  }

  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const doc = await service.getById(tenantId, branchId, templateId);
  if (!doc) return res.status(404).json({ message: "Template not found" });
  return res.status(200).json({ message: "Fetched", data: doc });
}

export async function update(req: WithUser, res: Response) {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const id = new Types.ObjectId(req.params.id);

  // Check if template is published - block editing
  const existing = await service.getById(tenantId, branchId, id);
  if (existing?.status === "published") {
    return res.status(403).json({
      message: "Editing is locked after publishing.",
    });
  }

  const {
    title,
    description,
    version,
    recommended,
    builder,
    employmentTypes,
    contractTypeIds,
    designationIds,
  } = req.body as any;
  const payload: service.UpdateContractTemplateArgs = {
    title,
    description,
    version,
    recommended,
    builder,
    employmentTypes,
    contractTypeIds: Array.isArray(contractTypeIds)
      ? contractTypeIds
          .filter((id: any) => Types.ObjectId.isValid(id))
          .map((id: string) => new Types.ObjectId(id))
      : undefined,
    designationIds: Array.isArray(designationIds)
      ? designationIds
          .filter((id: any) => Types.ObjectId.isValid(id))
          .map((id: string) => new Types.ObjectId(id))
      : undefined,
  };
  const doc = await service.update(tenantId, branchId, id, payload);
  if (!doc) return res.status(404).json({ message: "Template not found" });
  return res.status(200).json({ message: "Updated", data: doc });
}

export async function publish(req: WithUser, res: Response) {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const id = new Types.ObjectId(req.params.id);

  // Check for pending approvals
  const hasPending = await approvalService.hasPendingApprovals(
    id,
    tenantId,
    branchId
  );
  if (hasPending) {
    return res.status(400).json({
      message: "Cannot publish while approvals are pending.",
    });
  }

  const doc = await service.publish(tenantId, branchId, id);
  if (!doc) return res.status(404).json({ message: "Template not found" });
  return res.status(200).json({ message: "Published", data: doc });
}

export async function sendApproval(req: WithUser, res: Response) {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const templateId = new Types.ObjectId(req.params.id);

  // Verify template exists
  const template = await service.getById(tenantId, branchId, templateId);
  if (!template) {
    return res.status(404).json({ message: "Template not found" });
  }

  const { employees, applicantId, selfSignRequired } = req.body as {
    employees: Array<{
      employeeId: string;
      requireSignature: boolean;
      signatureType?: "typed" | "drawn" | "upload";
    }>;
    applicantId: string;
    selfSignRequired?: boolean;
  };

  if (!Array.isArray(employees) || employees.length === 0) {
    return res
      .status(400)
      .json({ message: "At least one employee is required" });
  }

  if (!applicantId) {
    return res.status(400).json({ message: "applicantId is required" });
  }

  try {
    const approval = await approvalService.sendApprovalRequests({
      templateId,
      tenantId,
      branchId,
      employees,
      templateTitle: template.title,
      applicantId: new Types.ObjectId(applicantId),
      selfSignRequired: selfSignRequired || false,
      senderUserId: new Types.ObjectId(req.user.userId), // Current user as sender
    });

    return res.status(200).json({
      message: "Approval requests sent",
      data: approval,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: error.message || "Failed to send approval requests",
    });
  }
}

export async function getApprovals(req: WithUser, res: Response) {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const templateId = new Types.ObjectId(req.params.id);

  // Verify template exists
  const template = await service.getById(tenantId, branchId, templateId);
  if (!template) {
    return res.status(404).json({ message: "Template not found" });
  }

  const approvals = await approvalService.getApprovals(
    templateId,
    tenantId,
    branchId
  );

  return res.status(200).json({
    message: "Fetched approvals",
    data: approvals,
  });
}

export async function acceptOrRejectContract(req: WithUser, res: Response) {
  const templateId = new Types.ObjectId(req.params.id);
  const { action, note, signatureData } = req.body as {
    action: "accept" | "reject";
    note?: string;
    signatureData?: string;
  };

  if (!action || (action !== "accept" && action !== "reject")) {
    return res
      .status(400)
      .json({ message: "Invalid action. Must be 'accept' or 'reject'" });
  }

  // Get applicantId from user's employee profile
  const userId = req.user.userId;
  const assignments = req.user.assignments || [];

  if (assignments.length === 0) {
    return res
      .status(400)
      .json({ message: "No organization assignments found" });
  }

  try {
    // Find the employee profile for this user
    const employeeProfile = await EmployeeProfile.findOne({ userId }).lean();

    if (!employeeProfile) {
      return res.status(400).json({ message: "No employee profile found" });
    }

    // Collect all employeeIds across all organizations the user belongs to
    // Similar to getMyContracts - we need to check all assignments
    const employeeIds: Types.ObjectId[] = [];
    const tenantBranchPairs: Array<{
      tenantId: Types.ObjectId;
      branchId: Types.ObjectId;
      employeeId: Types.ObjectId;
    }> = [];

    for (const assignment of assignments) {
      const tenantId = new Types.ObjectId(assignment.tenantId);
      const branchId = new Types.ObjectId(assignment.branchId);

      // Find the employee document for this tenant/branch
      const employee = await EmployeeModel.findOne({
        employeeProfile: employeeProfile._id,
        tenantId,
        branchId,
        isDeleted: false,
      }).lean();

      if (employee) {
        employeeIds.push(employee._id);
        tenantBranchPairs.push({
          tenantId,
          branchId,
          employeeId: employee._id,
        });
        console.log(
          `[ACCEPT/REJECT CONTRACT] Found employeeId ${employee._id.toString()} for tenantId ${tenantId.toString()}, branchId ${branchId.toString()}`
        );
      }
    }

    if (employeeIds.length === 0) {
      return res
        .status(400)
        .json({ message: "No employee IDs found across organizations" });
    }

    // Try to find the contract approval for this template across all tenant/branch pairs
    let foundApproval = false;
    let approvedTenantId: Types.ObjectId | null = null;
    let approvedBranchId: Types.ObjectId | null = null;
    let approvedApplicantId: Types.ObjectId | null = null;

    for (const { tenantId, branchId, employeeId } of tenantBranchPairs) {
      // Check if there's a contract approval for this template, applicant, and tenant/branch
      const approval = await ContractApproval.findOne({
        templateId,
        applicantId: employeeId,
        tenantId,
        branchId,
        sentToApplicantAt: { $exists: true, $ne: null }, // Contract must have been sent
      }).lean();

      if (approval) {
        foundApproval = true;
        approvedTenantId = tenantId;
        approvedBranchId = branchId;
        approvedApplicantId = employeeId;
        console.log(
          `[ACCEPT/REJECT CONTRACT] Found approval for templateId ${templateId.toString()}, applicantId ${employeeId.toString()}, tenantId ${tenantId.toString()}, branchId ${branchId.toString()}`
        );
        break; // Found the approval, no need to check other pairs
      }
    }

    if (
      !foundApproval ||
      !approvedTenantId ||
      !approvedBranchId ||
      !approvedApplicantId
    ) {
      console.log(
        `[ACCEPT/REJECT CONTRACT] No approval found for templateId ${templateId.toString()} across any organization`
      );
      return res.status(404).json({ message: "Contract approval not found" });
    }

    // Call the service to accept/reject with the correct tenant/branch/applicant
    const approval = await approvalService.acceptOrRejectContract({
      templateId,
      applicantId: approvedApplicantId,
      tenantId: approvedTenantId,
      branchId: approvedBranchId,
      action,
      note,
      signatureData,
    });

    if (!approval) {
      return res.status(404).json({ message: "Contract approval not found" });
    }

    return res.status(200).json({
      message: `Contract ${action === "accept" ? "accepted" : "rejected"} successfully`,
      data: approval,
    });
  } catch (error: any) {
    console.error("[ACCEPT/REJECT CONTRACT] Error:", error);
    if (error.message === "Contract has not been sent to applicant yet") {
      return res.status(400).json({ message: error.message });
    }
    if (error.message.includes("already been")) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({
      message: error.message || `Failed to ${action} contract`,
    });
  }
}

export async function getMyContracts(req: WithUser, res: Response) {
  const userId = req.user.userId;
  const assignments = req.user.assignments || [];

  if (assignments.length === 0) {
    return res.status(200).json({
      message:
        "No organization assignments found - returning empty contracts list",
      data: [],
    });
  }

  try {
    // Find the employee profile for this user
    const employeeProfile = await EmployeeProfile.findOne({ userId }).lean();

    if (!employeeProfile) {
      return res.status(200).json({
        message: "No employee profile found - returning empty contracts list",
        data: [],
      });
    }

    // Collect all employeeIds and tenant/branch pairs across all organizations
    const employeeIds: Types.ObjectId[] = [];
    const tenantBranchPairs: Array<{
      tenantId: Types.ObjectId;
      branchId: Types.ObjectId;
    }> = [];

    for (const assignment of assignments) {
      const tenantId = new Types.ObjectId(assignment.tenantId);
      const branchId = new Types.ObjectId(assignment.branchId);

      // Find the employee document for this tenant/branch
      const employee = await EmployeeModel.findOne({
        employeeProfile: employeeProfile._id,
        tenantId,
        branchId,
        isDeleted: false,
      }).lean();

      if (employee) {
        employeeIds.push(employee._id);
        tenantBranchPairs.push({ tenantId, branchId });
      }
    }

    // If no employeeIds found, return empty array
    if (employeeIds.length === 0) {
      return res.status(200).json({
        message:
          "No employee IDs found across organizations - returning empty contracts list",
        data: [],
      });
    }

    // Fetch contracts for all employeeIds (they should all be the same person across orgs)
    // Pass all employeeIds to ensure we find contracts regardless of which organization they were sent from
    console.log(
      `[CONTRACT CONTROLLER] Fetching contracts for ${employeeIds.length} employeeIds:`,
      employeeIds.map((id) => id.toString())
    );
    const contracts = await approvalService.getMyContracts(
      employeeIds,
      tenantBranchPairs
    );
    console.log(`[CONTRACT CONTROLLER] Found ${contracts.length} contracts`);

    return res.status(200).json({
      message: "Contracts fetched successfully",
      data: contracts,
    });
  } catch (error: any) {
    console.error("[CONTRACT CONTROLLER] Error fetching my contracts:", error);
    return res.status(500).json({
      message: error.message || "Failed to fetch contracts",
    });
  }
}

export async function getEmployeeApprovals(req: WithUser, res: Response) {
  const userId = new Types.ObjectId(req.user.userId);
  const assignments = req.user.assignments || [];

  // If user has no assignments, return empty array
  if (assignments.length === 0) {
    return res.status(200).json({
      message:
        "No organization assignments found - returning empty approvals list",
      data: [],
    });
  }

  try {
    // Find the employee profile for this user
    const employeeProfile = await EmployeeProfile.findOne({ userId }).lean();

    if (!employeeProfile) {
      return res.status(200).json({
        message: "No employee profile found - returning empty approvals list",
        data: [],
      });
    }

    // Collect all employeeIds across all organizations the user belongs to
    const employeeIds: Types.ObjectId[] = [];
    const tenantBranchPairs: Array<{
      tenantId: Types.ObjectId;
      branchId: Types.ObjectId;
    }> = [];

    for (const assignment of assignments) {
      const tenantId = new Types.ObjectId(assignment.tenantId);
      const branchId = new Types.ObjectId(assignment.branchId);

      // Find the employee document for this tenant/branch
      const employee = await EmployeeModel.findOne({
        employeeProfile: employeeProfile._id,
        tenantId,
        branchId,
        isDeleted: false,
      }).lean();

      if (employee) {
        employeeIds.push(employee._id);
        tenantBranchPairs.push({ tenantId, branchId });
        console.log(
          `[CONTRACT APPROVAL CONTROLLER] Found employeeId ${employee._id.toString()} for tenantId ${tenantId.toString()}, branchId ${branchId.toString()}`
        );
      }
    }

    // If no employeeIds found, return empty array
    if (employeeIds.length === 0) {
      return res.status(200).json({
        message:
          "No employee IDs found across organizations - returning empty approvals list",
        data: [],
      });
    }

    console.log(
      `[CONTRACT APPROVAL CONTROLLER] Found ${employeeIds.length} employeeId(s) for userId ${userId.toString()}`
    );

    // Fetch approvals for all employeeIds across all organizations
    const approvals = await approvalService.getEmployeeApprovalsForMultipleIds(
      employeeIds,
      tenantBranchPairs
    );

    return res.status(200).json({
      message: "Fetched employee approvals",
      data: approvals,
    });
  } catch (error: any) {
    console.error(
      "[CONTRACT APPROVAL CONTROLLER] Error fetching employee approvals:",
      error
    );
    return res.status(500).json({
      message: error.message || "Failed to fetch employee approvals",
    });
  }
}

export async function getAllApprovals(req: WithUser, res: Response) {
  try {
    const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
    const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);

    console.log(
      `[CONTRACT APPROVAL CONTROLLER] Fetching approvals for tenantId: ${tenantId.toString()}, branchId: ${branchId.toString()}`
    );
    console.log(
      `[CONTRACT APPROVAL CONTROLLER] User: ${req.user.email}, Role: ${req.user.activeAssignment?.role}`
    );

    const approvals = await approvalService.getAllApprovals(tenantId, branchId);

    console.log(
      `[CONTRACT APPROVAL CONTROLLER] Found ${approvals.length} approvals`
    );

    return res.status(200).json({
      message: "Fetched all approvals",
      data: approvals,
    });
  } catch (error: any) {
    console.error("[CONTRACT APPROVAL CONTROLLER] Error:", error);
    return res.status(500).json({
      message: error.message || "Failed to fetch approvals",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}

// Get single approval by ID with all employee approvals
export async function getApprovalById(req: WithUser, res: Response) {
  try {
    const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
    const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
    const approvalId = req.params.approvalId;

    if (!isValidObjectId(approvalId)) {
      return res.status(400).json({ message: "Invalid approval ID" });
    }

    console.log(
      `[CONTRACT APPROVAL CONTROLLER] Fetching approval by ID: ${approvalId}`
    );

    // Fetch the approval document with all employee approvals
    const approval = await ContractApproval.findOne({
      _id: new Types.ObjectId(approvalId),
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
      .populate({
        path: "employeeApprovals.employeeId",
        select: "employeeFields employeeProfile designation",
      })
      .lean();

    if (!approval) {
      return res.status(404).json({ message: "Approval not found" });
    }

    console.log(
      `[CONTRACT APPROVAL CONTROLLER] Found approval with ${approval.employeeApprovals?.length || 0} employee approvals`
    );

    // Manually fetch designation names and inject into employee objects
    // (nested populate may not work reliably)
    if (approval.employeeApprovals && approval.employeeApprovals.length > 0) {
      const designationIds = new Set<string>();
      for (const ea of approval.employeeApprovals) {
        const emp = ea.employeeId as any;
        if (emp && emp._id && emp.designation) {
          const desigId =
            typeof emp.designation === "object" && emp.designation._id
              ? emp.designation._id.toString()
              : emp.designation.toString();
          designationIds.add(desigId);
        }
      }

      if (designationIds.size > 0) {
        const { Designation } = require("@/database/models/designation.model");
        const designations = await Designation.find({
          _id: { $in: Array.from(designationIds) },
        })
          .select("name")
          .lean();

        const designationMap = new Map<string, string>();
        for (const d of designations) {
          designationMap.set(d._id.toString(), d.name);
        }
        console.log(
          `[CONTRACT APPROVAL CONTROLLER] Fetched ${designations.length} designations for injection`
        );

        // Inject designation name into each employee approval
        for (const ea of approval.employeeApprovals) {
          const emp = ea.employeeId as any;
          if (emp && emp._id && emp.designation) {
            const desigId =
              typeof emp.designation === "object" && emp.designation._id
                ? emp.designation._id.toString()
                : emp.designation.toString();
            const desigName = designationMap.get(desigId);
            if (desigName) {
              emp.designation = { _id: desigId, name: desigName };
            }
          }
        }
      }
    }

    return res.status(200).json({
      message: "Fetched approval",
      data: approval,
    });
  } catch (error: any) {
    console.error("[CONTRACT APPROVAL CONTROLLER] Error:", error);
    return res.status(500).json({
      message: error.message || "Failed to fetch approval",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}

// Sender signs the contract (for selfSignRequired approvals)
export async function senderSign(req: WithUser, res: Response) {
  const approvalId = req.params.approvalId;

  if (!isValidObjectId(approvalId)) {
    return res.status(400).json({ message: "Invalid approval ID" });
  }

  const { signatureData } = req.body as { signatureData: string };

  if (!signatureData) {
    return res.status(400).json({ message: "Signature data is required" });
  }

  try {
    const approval = await ContractApproval.findById(approvalId);

    if (!approval) {
      return res.status(404).json({ message: "Approval not found" });
    }

    // Verify current user is the sender
    if (approval.senderUserId?.toString() !== req.user.userId) {
      return res
        .status(403)
        .json({ message: "You are not authorized to sign this contract" });
    }

    // Check if selfSignRequired is true
    if (!approval.selfSignRequired) {
      return res
        .status(400)
        .json({ message: "Self-sign is not required for this approval" });
    }

    // Check if already signed
    if (approval.senderSignatureData) {
      return res
        .status(400)
        .json({ message: "You have already signed this contract" });
    }

    // Update with sender signature
    approval.senderSignatureData = signatureData;
    approval.senderSignedAt = new Date();
    await approval.save();

    return res.status(200).json({
      message: "Contract signed successfully",
      data: approval.toObject(),
    });
  } catch (error: any) {
    console.error("[SENDER SIGN] Error:", error);
    return res.status(500).json({
      message: error.message || "Failed to sign contract",
    });
  }
}

export async function sendSingleApproval(req: WithUser, res: Response) {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const templateId = new Types.ObjectId(req.params.id);
  const employeeId = new Types.ObjectId(req.params.employeeId);

  // Verify template exists
  const template = await service.getById(tenantId, branchId, templateId);
  if (!template) {
    return res.status(404).json({ message: "Template not found" });
  }

  const { requireSignature, signatureType, applicantId } = req.body as {
    requireSignature?: boolean;
    signatureType?: "typed" | "drawn" | "upload";
    applicantId: string;
  };

  if (!applicantId) {
    return res.status(400).json({ message: "applicantId is required" });
  }

  try {
    const approval = await approvalService.sendSingleApprovalRequest({
      templateId,
      tenantId,
      branchId,
      employeeId,
      applicantId: new Types.ObjectId(applicantId),
      requireSignature: requireSignature || false,
      signatureType,
      templateTitle: template.title,
    });

    // Find the specific employee approval in the document
    const employeeApproval = approval.employeeApprovals.find(
      (ea: any) => ea.employeeId.toString() === employeeId.toString()
    );

    return res.status(200).json({
      message: "Approval request sent",
      data: {
        employeeId: employeeId.toString(),
        status: employeeApproval?.status || "pending",
      },
    });
  } catch (error: any) {
    if (error.message === "Approval request already sent for this employee") {
      return res.status(400).json({
        message: error.message,
      });
    }
    return res.status(500).json({
      message: error.message || "Failed to send approval request",
    });
  }
}

export async function sendAllApprovals(req: WithUser, res: Response) {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const templateId = new Types.ObjectId(req.params.id);

  // Verify template exists
  const template = await service.getById(tenantId, branchId, templateId);
  if (!template) {
    return res.status(404).json({ message: "Template not found" });
  }

  const { employeeSettings, applicantId } = req.body as {
    employeeSettings: Array<{
      employeeId: string;
      requireSignature: boolean;
      signatureType?: "typed" | "drawn" | "upload";
    }>;
    applicantId: string;
  };

  if (!Array.isArray(employeeSettings) || employeeSettings.length === 0) {
    return res.status(400).json({ message: "Employee settings are required" });
  }

  if (!applicantId) {
    return res.status(400).json({ message: "applicantId is required" });
  }

  try {
    const approval = await approvalService.sendAllPendingApprovals({
      templateId,
      tenantId,
      branchId,
      applicantId: new Types.ObjectId(applicantId),
      employeeSettings,
      templateTitle: template.title,
    });

    // Return only the newly created ones (status pending)
    const newApprovals = approval.employeeApprovals
      .filter((ea: any) => ea.status === "pending")
      .map((ea: any) => ({
        employeeId: ea.employeeId.toString(),
        status: ea.status,
      }));

    return res.status(200).json({
      message: "Approval requests sent",
      data: newApprovals,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: error.message || "Failed to send approval requests",
    });
  }
}

export async function sendToApplicant(req: WithUser, res: Response) {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const templateId = new Types.ObjectId(req.params.id);

  const { applicantId } = req.body as { applicantId: string };

  console.log(
    `[CONTRACT CONTROLLER] sendToApplicant called: templateId=${templateId.toString()}, applicantId=${applicantId}, tenantId=${tenantId.toString()}, branchId=${branchId.toString()}`
  );

  if (!applicantId) {
    return res.status(400).json({ message: "applicantId is required" });
  }

  // Verify template exists
  const template = await service.getById(tenantId, branchId, templateId);
  if (!template) {
    return res.status(404).json({ message: "Template not found" });
  }

  try {
    const approval = await approvalService.sendToApplicant({
      templateId,
      tenantId,
      branchId,
      applicantId: new Types.ObjectId(applicantId),
      templateTitle: template.title,
    });

    if (!approval) {
      console.log(
        `[CONTRACT CONTROLLER] Approval not found for templateId=${templateId.toString()}, applicantId=${applicantId}`
      );
      return res.status(404).json({ message: "Approval not found" });
    }

    console.log(
      `[CONTRACT CONTROLLER] Contract sent successfully to applicant ${applicantId}, sentToApplicantAt=${approval.sentToApplicantAt}`
    );

    return res.status(200).json({
      message: "Contract sent to applicant successfully",
      data: approval,
    });
  } catch (error: any) {
    console.error(`[CONTRACT CONTROLLER] Error sending to applicant:`, error);
    if (
      error.message ===
      "Cannot send to applicant: not all employees have approved the contract"
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }
    if (error.message === "Contract has already been sent to the applicant") {
      // Allow resending if applicant rejected - this is handled in the service
      // If it's not a rejection case, return the error
      return res.status(400).json({
        message: error.message,
      });
    }
    return res.status(500).json({
      message: error.message || "Failed to send contract to applicant",
    });
  }
}

/**
 * Self-sign a contract as employer when no approvers are configured.
 * Creates a contract approval with the employer's signature, ready for "Send to Applicant".
 */
export async function selfSign(req: WithUser, res: Response) {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const templateId = new Types.ObjectId(req.params.id);

  const { applicantId, signatureData, employerName } = req.body as {
    applicantId: string;
    signatureData: string;
    employerName?: string;
  };

  console.log(
    `[CONTRACT CONTROLLER] selfSign called: templateId=${templateId.toString()}, applicantId=${applicantId}, tenantId=${tenantId.toString()}, branchId=${branchId.toString()}`
  );

  if (!applicantId) {
    return res.status(400).json({ message: "applicantId is required" });
  }

  if (!signatureData) {
    return res.status(400).json({ message: "signatureData is required" });
  }

  // Verify template exists
  const template = await service.getById(tenantId, branchId, templateId);
  if (!template) {
    return res.status(404).json({ message: "Template not found" });
  }

  try {
    // Create or update the contract approval with employer's self-signature
    const approval = await approvalService.createSelfSignedApproval({
      templateId,
      tenantId,
      branchId,
      applicantId: new Types.ObjectId(applicantId),
      templateTitle: template.title,
      employerSignatureData: signatureData,
      employerName: employerName || "Employer",
      signedByUserId: new Types.ObjectId(req.user.userId),
    });

    console.log(
      `[CONTRACT CONTROLLER] Contract self-signed successfully for applicant ${applicantId}`
    );

    return res.status(200).json({
      message: "Contract self-signed successfully",
      data: approval,
    });
  } catch (error: any) {
    console.error(`[CONTRACT CONTROLLER] Error in selfSign:`, error);
    return res.status(500).json({
      message: error.message || "Failed to self-sign contract",
    });
  }
}

export async function updateApprovalById(req: WithUser, res: Response) {
  const approvalId = new Types.ObjectId(req.params.approvalId);

  // Validate employeeId parameter
  if (!req.params.employeeId || req.params.employeeId === "undefined") {
    return res.status(400).json({
      message: "Employee ID is required",
    });
  }

  const employeeId = new Types.ObjectId(req.params.employeeId);

  // Check user role
  const userRole = req.user.activeAssignment?.role || req.user.role;
  const isAdmin = userRole === "tenant-owner" || userRole === "admin";

  let userEmployeeId: Types.ObjectId | null = null;

  // For employees, verify they're approving their own approval
  if (!isAdmin) {
    try {
      const userId = new Types.ObjectId(req.user.userId);
      const assignments = req.user.assignments || [];

      if (assignments.length === 0) {
        return res.status(403).json({
          message:
            "Forbidden: insufficient role - no organization assignments found",
        });
      }

      // Find the employee profile for this user
      const employeeProfile = await EmployeeProfile.findOne({ userId }).lean();

      if (!employeeProfile) {
        return res.status(403).json({
          message: "Forbidden: insufficient role - employee profile not found",
        });
      }

      // Check all assignments to find the employeeId that matches the request
      for (const assignment of assignments) {
        const assignmentTenantId = new Types.ObjectId(assignment.tenantId);
        const assignmentBranchId = new Types.ObjectId(assignment.branchId);

        // Find the employee document for this tenant/branch
        const employee = await EmployeeModel.findOne({
          employeeProfile: employeeProfile._id,
          tenantId: assignmentTenantId,
          branchId: assignmentBranchId,
          isDeleted: false,
        }).lean();

        if (!employee) {
          continue; // Try next assignment
        }

        const currentEmployeeId = employee._id;

        // Verify the employeeId in the request matches the current employee
        if (currentEmployeeId.toString() === employeeId.toString()) {
          userEmployeeId = currentEmployeeId;
          break; // Found the matching employee
        }
      }

      if (
        !userEmployeeId ||
        userEmployeeId.toString() !== employeeId.toString()
      ) {
        return res.status(403).json({
          message: "You can only approve or reject your own contract approvals",
        });
      }
    } catch (error: any) {
      console.error(
        "[CONTRACT TEMPLATE CONTROLLER] Error checking employee authorization:",
        error
      );
      return res.status(403).json({
        message: "Forbidden: insufficient role",
      });
    }
  }

  const { requireSignature, signatureType } = req.body as {
    requireSignature?: boolean;
    signatureType?: "typed" | "drawn" | "upload";
  };

  const { status, respondedAt, note, signatureData } = req.body as {
    status?: "pending" | "approved" | "rejected";
    respondedAt?: string;
    note?: string; // Optional note/comment from the employee
    signatureData?: string;
  };

  // If status is being updated, set respondedAt to now
  const finalRespondedAt =
    status && (status === "approved" || status === "rejected")
      ? respondedAt
        ? new Date(respondedAt)
        : new Date()
      : respondedAt
        ? new Date(respondedAt)
        : undefined;

  try {
    // First, verify the approval exists and the employeeId is in it
    const approval = await ContractApproval.findById(approvalId).lean();

    if (!approval) {
      return res.status(404).json({ message: "Contract approval not found" });
    }

    // Verify the employeeId is in the employeeApprovals array
    const employeeApproval = approval.employeeApprovals?.find(
      (ea: any) => ea.employeeId?.toString() === employeeId.toString()
    );

    if (!employeeApproval) {
      return res.status(403).json({
        message: "Forbidden: you don't have access to approve this contract",
      });
    }

    // Update the approval using the unique _id
    const updatedApproval = await approvalService.updateApprovalById({
      approvalId,
      employeeId,
      status,
      requireSignature,
      signatureType,
      signatureData,
      respondedAt: finalRespondedAt,
      note: note?.trim() || undefined, // Save note if provided
    });

    if (!updatedApproval) {
      return res.status(404).json({ message: "Contract approval not found" });
    }

    return res.status(200).json({
      message: `Contract ${status === "approved" ? "approved" : status === "rejected" ? "rejected" : "updated"} successfully`,
      data: updatedApproval,
    });
  } catch (error: any) {
    console.error(
      "[CONTRACT TEMPLATE CONTROLLER] Error updating approval:",
      error
    );
    return res.status(500).json({
      message: error.message || "Failed to update approval",
    });
  }
}

export async function updateApproval(req: WithUser, res: Response) {
  const templateId = new Types.ObjectId(req.params.id);

  // Validate employeeId parameter
  if (!req.params.employeeId || req.params.employeeId === "undefined") {
    return res.status(400).json({
      message: "Employee ID is required",
    });
  }

  const employeeId = new Types.ObjectId(req.params.employeeId);

  // Check user role
  const userRole = req.user.activeAssignment?.role || req.user.role;
  const isAdmin = userRole === "tenant-owner" || userRole === "admin";

  let tenantId: Types.ObjectId;
  let branchId: Types.ObjectId;
  let userEmployeeId: Types.ObjectId | null = null;

  // For admins, use activeAssignment
  if (isAdmin) {
    const activeAssignment = req.user.activeAssignment;
    if (
      !activeAssignment ||
      !activeAssignment.tenantId ||
      !activeAssignment.branchId
    ) {
      return res.status(400).json({
        message: "No active organization assignment found",
      });
    }
    tenantId = new Types.ObjectId(activeAssignment.tenantId);
    branchId = new Types.ObjectId(activeAssignment.branchId);
  } else {
    // For employees, find the correct tenant/branch from the contract approval
    try {
      const userId = new Types.ObjectId(req.user.userId);
      const assignments = req.user.assignments || [];

      if (assignments.length === 0) {
        return res.status(403).json({
          message:
            "Forbidden: insufficient role - no organization assignments found",
        });
      }

      // Find the employee profile for this user
      const employeeProfile = await EmployeeProfile.findOne({ userId }).lean();

      if (!employeeProfile) {
        return res.status(403).json({
          message: "Forbidden: insufficient role - employee profile not found",
        });
      }

      // Check all assignments to find where the contract approval exists
      let foundApproval = false;

      for (const assignment of assignments) {
        const assignmentTenantId = new Types.ObjectId(assignment.tenantId);
        const assignmentBranchId = new Types.ObjectId(assignment.branchId);

        // Find the employee document for this tenant/branch
        const employee = await EmployeeModel.findOne({
          employeeProfile: employeeProfile._id,
          tenantId: assignmentTenantId,
          branchId: assignmentBranchId,
          isDeleted: false,
        }).lean();

        if (!employee) {
          continue; // Try next assignment
        }

        const currentEmployeeId = employee._id;

        // Verify the employeeId in the request matches the current employee
        if (currentEmployeeId.toString() !== employeeId.toString()) {
          continue; // This is not the employee making the request
        }

        // Check if there's a contract approval where this employee is in the employeeApprovals array
        const approval = await ContractApproval.findOne({
          templateId,
          tenantId: assignmentTenantId,
          branchId: assignmentBranchId,
          "employeeApprovals.employeeId": employeeId,
        }).lean();

        if (approval) {
          foundApproval = true;
          tenantId = assignmentTenantId;
          branchId = assignmentBranchId;
          userEmployeeId = currentEmployeeId;
          console.log(
            `[CONTRACT TEMPLATE CONTROLLER] Employee ${employeeId.toString()} found approval for template ${templateId.toString()} in tenantId ${tenantId.toString()}, branchId ${branchId.toString()}`
          );
          break; // Found the approval, no need to check other assignments
        }
      }

      if (!foundApproval || !userEmployeeId) {
        return res.status(403).json({
          message:
            "Forbidden: insufficient role - you don't have access to approve this contract",
        });
      }
    } catch (error: any) {
      console.error(
        "[CONTRACT TEMPLATE CONTROLLER] Error checking employee authorization:",
        error
      );
      return res.status(403).json({
        message: "Forbidden: insufficient role",
      });
    }
  }

  // Verify template exists
  const template = await service.getById(tenantId, branchId, templateId);
  if (!template) {
    return res.status(404).json({ message: "Template not found" });
  }

  // For employees, verify they're approving their own approval
  if (!isAdmin) {
    if (
      !userEmployeeId ||
      userEmployeeId.toString() !== employeeId.toString()
    ) {
      return res.status(403).json({
        message: "You can only approve or reject your own contract approvals",
      });
    }
  }

  const { requireSignature, signatureType } = req.body as {
    requireSignature?: boolean;
    signatureType?: "typed" | "drawn" | "upload";
  };

  const { status, respondedAt, note } = req.body as {
    status?: "pending" | "approved" | "rejected";
    respondedAt?: string;
    note?: string; // Optional note/comment from the employee
  };

  // If status is being updated, set respondedAt to now
  const finalRespondedAt =
    status && (status === "approved" || status === "rejected")
      ? respondedAt
        ? new Date(respondedAt)
        : new Date()
      : respondedAt
        ? new Date(respondedAt)
        : undefined;

  try {
    const approval = await approvalService.updateApproval({
      templateId,
      employeeId,
      tenantId,
      branchId,
      status,
      requireSignature,
      signatureType,
      respondedAt: finalRespondedAt,
      note: note?.trim() || undefined, // Save note if provided
    });

    if (!approval) {
      return res.status(404).json({ message: "Approval record not found" });
    }

    // Find the specific employee approval in the document
    const employeeApproval = approval.employeeApprovals.find(
      (ea: any) => ea.employeeId.toString() === employeeId.toString()
    );

    if (!employeeApproval) {
      return res
        .status(404)
        .json({ message: "Employee approval not found in document" });
    }

    return res.status(200).json({
      message: "Approval updated successfully",
      data: {
        employeeId: employeeId.toString(),
        status: employeeApproval.status,
        requireSignature: employeeApproval.requireSignature,
        signatureType: employeeApproval.signatureType,
        respondedAt: employeeApproval.respondedAt,
        note: employeeApproval.note,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      message: error.message || "Failed to update approval",
    });
  }
}

export async function duplicate(req: WithUser, res: Response) {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const userId = new Types.ObjectId(req.user.userId);
  const id = new Types.ObjectId(req.params.id);
  const { version } = req.body as { version: string };
  if (!version) return res.status(400).json({ message: "version is required" });
  const doc = await service.duplicate(tenantId, branchId, userId, id, {
    version,
  });
  return res.status(201).json({ message: "Duplicated", data: doc });
}

export async function exportPdf(req: WithUser, res: Response) {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const id = new Types.ObjectId(req.params.id);
  const doc = await service.getById(tenantId, branchId, id);
  if (!doc) return res.status(404).json({ message: "Template not found" });

  // lazy import pdfkit
  const PDFDocument = (await import("pdfkit")) as unknown as {
    default: typeof PDFDocumentType;
  };
  const pdf = new (PDFDocument.default as any)({ size: "A4", margin: 56 }); // ~20mm

  const filenameSafe =
    `${doc.title || "Contract Template"}_${doc.version || "v1"}.pdf`.replace(
      /\s+/g,
      "_"
    );
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=\"${filenameSafe}\"`
  );
  pdf.pipe(res);

  // Helpers
  const pageWidth = (pdf as any).page.width as number;
  const pageMargin = (pdf as any).page.margins.left as number;
  const contentWidth = pageWidth - pageMargin * 2;
  const lineGap = 6; // spacing between paragraphs

  const moveDownGap = (gap = lineGap) => pdf.moveDown(gap / 12); // pdf.moveDown is approx in lines

  const header = () => {
    const title =
      (doc as any).builder?.body?.title || doc.title || "Contract Template";
    pdf
      .font("Helvetica-Bold")
      .fontSize(16)
      .text(title.toUpperCase(), { align: "center" });
    pdf.moveDown(0.2);
    pdf
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#475569")
      .text(`Version: ${doc.version || "v1"}`, { align: "center" });
    pdf.fillColor("#111827");
    moveDownGap(10);
  };

  const footer = () => {
    const y = (pdf as any).page.height - (pdf as any).page.margins.bottom + 10;
    pdf.save();
    pdf
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#6B7280")
      .text(
        `Page ${(pdf as any)._pageBuffer?.length || (pdf as any).page.index + 1}`,
        pageMargin,
        y,
        { align: "center", width: contentWidth }
      );
    pdf.restore();
  };

  const ensureSpace = (min = 80) => {
    if (
      (pdf as any).y + min >
      (pdf as any).page.height - (pdf as any).page.margins.bottom
    ) {
      (pdf as any).addPage();
      header();
    }
  };

  const sectionHeading = (text: string) => {
    ensureSpace(40);
    pdf.font("Helvetica-Bold").fontSize(12).text(text.toUpperCase());
    moveDownGap(4);
  };

  const paragraph = (text?: string, options?: { indent?: number }) => {
    if (!text) return;
    const indent = options?.indent ?? 0;
    pdf
      .font("Helvetica")
      .fontSize(11)
      .text(text, pageMargin + indent, (pdf as any).y, {
        width: contentWidth - indent,
        align: "justify",
      });
    moveDownGap();
  };

  const numberedClause = (num: string, heading?: string, body?: string) => {
    ensureSpace(40);
    pdf
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(`${num}. ${heading || "Clause"}`);
    if (body) {
      pdf
        .font("Helvetica")
        .fontSize(11)
        .text(body, { width: contentWidth, align: "justify" });
    }
    moveDownGap(4);
  };

  const drawScheduleTable = (
    rows: { order: number; label: string; value: string }[]
  ) => {
    if (!rows.length) return;
    ensureSpace(60);
    const col1 = 40; // order
    const col2 = 220; // label
    const x = pageMargin;
    let y = (pdf as any).y;
    const rowH = 24;
    const w1 = col1;
    const w2 = col2 - col1;
    const w3 = contentWidth - col2;

    // Table header
    pdf.font("Helvetica-Bold").fontSize(11).text("SCHEDULE", x, y);
    y += 18;
    pdf
      .moveTo(x, y)
      .lineTo(x + contentWidth, y)
      .strokeColor("#D1D5DB")
      .lineWidth(1)
      .stroke();
    y += 8;

    rows.forEach((r) => {
      ensureSpace(30);
      // row border
      pdf
        .strokeColor("#E5E7EB")
        .rect(x, y - 4, contentWidth, rowH)
        .stroke();
      // columns content
      pdf
        .fillColor("#111827")
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(String(r.order), x + 8, y, { width: w1 - 16 });
      pdf
        .font("Helvetica-Bold")
        .text(r.label, x + col1 + 8, y, { width: w2 - 16 });
      pdf.font("Helvetica").text(r.value, x + col2 + 8, y, { width: w3 - 16 });
      y += rowH;
      (pdf as any).y = y; // advance cursor
    });
    moveDownGap();
  };

  const drawSignatures = (roles: any[]) => {
    if (!roles.length) return;
    ensureSpace(140);
    pdf.font("Helvetica-Bold").fontSize(11).text("SIGNATURES");
    moveDownGap(2);

    const boxW = (contentWidth - 16) / 2;
    const boxH = 120;
    const x1 = pageMargin;
    const x2 = pageMargin + boxW + 16;
    let y = (pdf as any).y;
    const drawBox = (x: number, role: any) => {
      pdf.strokeColor("#D1D5DB").rect(x, y, boxW, boxH).stroke();
      pdf
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#111827")
        .text(role?.label || role?.key || "Signer", x + 10, y + 8, {
          width: boxW - 20,
        });
      pdf.font("Helvetica").fontSize(10);
      const line = (ly: number, label: string) => {
        pdf.text(label, x + 10, ly);
        pdf
          .moveTo(x + 80, ly + 12)
          .lineTo(x + boxW - 10, ly + 12)
          .strokeColor("#E5E7EB")
          .stroke();
      };
      line(y + 28, "Signature");
      line(y + 52, "Name");
      line(y + 76, "Title");
      line(y + 100, "Date");
    };

    const a = roles[0];
    const b = roles[1];
    drawBox(x1, a || { label: "Employer Representative" });
    if (b) drawBox(x2, b);
    (pdf as any).y = y + boxH + 10;
  };

  // Begin document
  header();

  const builder: any = (doc as any).builder || {};
  const body = builder.body || {};
  const schedule = (builder.schedule || []) as any[];
  const signing = (builder.signing?.roles || []) as any[];

  // Description
  if (doc.description) {
    paragraph(doc.description);
  }

  // Backgrounds: new array format, fallback to legacy A–C
  const backgroundsArray: string[] = Array.isArray((body as any).backgrounds)
    ? (body as any).backgrounds.filter(
        (t: any) => typeof t === "string" && t.trim().length > 0
      )
    : [];
  if (backgroundsArray.length > 0) {
    sectionHeading("Background");
    backgroundsArray.forEach((text: string, idx: number) => {
      const letter = String.fromCharCode(65 + idx);
      paragraph(`${letter}. ${text}`);
    });
  } else if (
    body.background &&
    (body.background.A || body.background.B || body.background.C)
  ) {
    sectionHeading("Background");
    if (body.background.A) paragraph(`A. ${body.background.A}`);
    if (body.background.B) paragraph(`B. ${body.background.B}`);
    if (body.background.C) paragraph(`C. ${body.background.C}`);
  }

  // Clauses
  const clauses = Array.isArray(body.clauses) ? body.clauses : [];
  if (clauses.length) {
    sectionHeading("Clauses");
    clauses.forEach((c: any, idx: number) => {
      const num = `${idx + 1}`;
      numberedClause(num, c.heading, c.text);
      if (Array.isArray(c.subclauses)) {
        c.subclauses.forEach((s: any, si: number) => {
          paragraph(`${num}.${si + 1} ${s.text || ""}`, { indent: 16 });
        });
      }
    });
  }

  // Schedule (table layout)
  if (schedule.length) {
    sectionHeading("Schedule");
    const rows = schedule
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((r) => ({
        order: r.order || 0,
        label: r.label || r.key,
        value: r.defaultText || (r.fieldRef ? `{{${r.fieldRef}}}` : ""),
      }));
    drawScheduleTable(rows);
  }

  // Signatures
  if (signing.length) {
    sectionHeading("Signing");
    drawSignatures(signing.sort((a, b) => (a.order || 0) - (b.order || 0)));
  }

  footer();
  pdf.end();
}

/**
 * Get contract by public token (no authentication required)
 */
export async function getPublicContract(req: any, res: Response) {
  const { templateId, applicantId } = req.params;
  const { token } = req.query;

  if (!templateId || !applicantId || !token) {
    return res
      .status(400)
      .json({ message: "templateId, applicantId, and token are required" });
  }

  if (!isValidObjectId(templateId) || !isValidObjectId(applicantId)) {
    return res
      .status(400)
      .json({ message: "Invalid templateId or applicantId" });
  }

  try {
    const approval = await approvalService.getContractByPublicToken(
      new Types.ObjectId(templateId),
      new Types.ObjectId(applicantId),
      token as string
    );

    if (!approval) {
      return res
        .status(404)
        .json({
          message: "Contract not found or access token is invalid/expired",
        });
    }

    // Check if contract is accepted - if so, try to use snapshot data
    const ContractSnapshot =
      require("../../database/models/contractSnapshot.model").ContractSnapshot;
    let snapshot = null;
    if (approval.applicantStatus === "accepted") {
      try {
        snapshot = await ContractSnapshot.findOne({
          approvalId: approval._id,
        }).lean();

        // Hydrate missing employee info in snapshot.employeeApprovals
        if (
          snapshot &&
          snapshot.employeeApprovals &&
          snapshot.employeeApprovals.length > 0
        ) {
          // Check for missing names
          const needsHydration = snapshot.employeeApprovals.some(
            (ea: any) => !ea.employeeName && ea.employeeId
          );

          if (needsHydration) {
            const empIds = snapshot.employeeApprovals
              .filter((ea: any) => ea.employeeId)
              .map((ea: any) => ea.employeeId);

            if (empIds.length > 0) {
              const employees = await EmployeeModel.find({
                _id: { $in: empIds },
              })
                .populate("designation")
                .lean();

              snapshot.employeeApprovals = snapshot.employeeApprovals.map(
                (ea: any) => {
                  if (ea.employeeId) {
                    const empIdStr = ea.employeeId.toString();
                    const emp = employees.find(
                      (e: any) => e._id.toString() === empIdStr
                    );
                    if (emp) {
                      // Only update if missing, or update always? Better update always for "Title" which might change?
                      // But snapshot should be point in time.
                      // However, if it was missing, we must fill it.
                      const existingName = ea.employeeName;
                      const existingDesignation = ea.designation;

                      const firstName =
                        emp.employeeFields?.personaldetails?.firstname || "";
                      const lastName =
                        emp.employeeFields?.personaldetails?.lastname || "";
                      const liveName = `${firstName} ${lastName}`.trim();
                      const liveDesignation =
                        (emp.designation as any)?.name || "";

                      return {
                        ...ea,
                        employeeName: existingName || liveName,
                        designation: existingDesignation || liveDesignation,
                      };
                    }
                  }
                  return ea;
                }
              );
            }
          }
        }

        console.log(
          `[GET PUBLIC CONTRACT] Snapshot found: ${snapshot ? "yes" : "no"}`
        );
      } catch (err) {
        console.warn("Failed to fetch snapshot:", err);
      }
    }

    // If snapshot exists, use snapshot data; otherwise fetch live data
    let templateData;
    let applicantData;

    if (snapshot) {
      // Use snapshot data for accepted contracts
      console.log(
        `[GET PUBLIC CONTRACT] Using snapshot data for accepted contract`
      );
      templateData = {
        _id: snapshot.templateId,
        title: snapshot.templateSnapshot?.title,
        description: snapshot.templateSnapshot?.description,
        version: snapshot.templateSnapshot?.version,
        builder: snapshot.templateSnapshot?.builder,
      };
      applicantData = {
        _id: snapshot.applicantId,
        employeeFields: snapshot.applicantSnapshot?.employeeFields,
        designation: snapshot.applicantSnapshot?.designation,
      };
    } else {
      // Fetch live data for pending contracts
      const template = await service.getById(
        approval.tenantId,
        approval.branchId,
        new Types.ObjectId(templateId)
      );

      if (!template) {
        return res.status(404).json({ message: "Contract template not found" });
      }
      templateData = template;

      // Get the applicant employee data (for rendering employee fields)
      const EmployeeModel =
        require("../../database/models/employee.model").default;
      try {
        applicantData = await EmployeeModel.findById(applicantId)
          .populate("designation")
          .lean();
      } catch (err) {
        console.warn("Failed to fetch applicant data:", err);
      }
    }

    return res.status(200).json({
      message: "Contract retrieved successfully",
      data: {
        template: templateData,
        approval: {
          _id: approval._id,
          applicantStatus: approval.applicantStatus,
          sentToApplicantAt: approval.sentToApplicantAt,
          // Include signature data (from snapshot if available, else from approval)
          employerSignatureData:
            snapshot?.employerSignatureData || approval.employerSignatureData,
          employerName: snapshot?.employerName || approval.employerName,
          employerSignedAt:
            snapshot?.employerSignedAt || approval.employerSignedAt,
          // New self-sign fields
          senderSignatureData:
            snapshot?.senderSignatureData || approval.senderSignatureData,
          senderSignedAt: snapshot?.senderSignedAt || approval.senderSignedAt,
          applicantSignatureData:
            snapshot?.applicantSignatureData || approval.applicantSignatureData,
          applicantSignedAt:
            snapshot?.applicantSignedAt || approval.applicantSignedAt,
          employeeApprovals:
            snapshot?.employeeApprovals || approval.employeeApprovals,
        },
        applicant: applicantData,
        // Include flag to indicate if snapshot data is being used
        usingSnapshot: !!snapshot,
      },
    });
  } catch (error: any) {
    console.error("[GET PUBLIC CONTRACT] Error:", error);
    return res.status(500).json({
      message: error.message || "Failed to retrieve contract",
    });
  }
}

/**
 * Generate OTP for public contract acceptance/rejection
 */
export async function generatePublicOTP(req: any, res: Response) {
  const { templateId, applicantId } = req.params;
  const { token } = req.body;

  if (!templateId || !applicantId || !token) {
    return res
      .status(400)
      .json({ message: "templateId, applicantId, and token are required" });
  }

  if (!isValidObjectId(templateId) || !isValidObjectId(applicantId)) {
    return res
      .status(400)
      .json({ message: "Invalid templateId or applicantId" });
  }

  try {
    const result = await approvalService.generateOTPForContract(
      new Types.ObjectId(templateId),
      new Types.ObjectId(applicantId),
      token
    );

    return res.status(200).json({
      message: result.message,
      data: { success: result.success },
    });
  } catch (error: any) {
    console.error("[GENERATE PUBLIC OTP] Error:", error);
    return res.status(400).json({
      message: error.message || "Failed to generate OTP",
    });
  }
}

/**
 * Accept or reject contract with OTP verification (public access)
 */
export async function publicAcceptOrRejectContract(req: any, res: Response) {
  const { templateId, applicantId } = req.params;
  const { token, action, otpCode, note, signatureData } = req.body;

  if (!templateId || !applicantId || !token || !action || !otpCode) {
    return res.status(400).json({
      message:
        "templateId, applicantId, token, action, and otpCode are required",
    });
  }

  if (!isValidObjectId(templateId) || !isValidObjectId(applicantId)) {
    return res
      .status(400)
      .json({ message: "Invalid templateId or applicantId" });
  }

  if (action !== "accept" && action !== "reject") {
    return res
      .status(400)
      .json({ message: "Invalid action. Must be 'accept' or 'reject'" });
  }

  try {
    const approval = await approvalService.publicAcceptOrRejectContract({
      templateId: new Types.ObjectId(templateId),
      applicantId: new Types.ObjectId(applicantId),
      token,
      action,
      otpCode,
      note,
      signatureData,
    });

    if (!approval) {
      return res.status(404).json({ message: "Contract approval not found" });
    }

    return res.status(200).json({
      message: `Contract ${action === "accept" ? "accepted" : "rejected"} successfully`,
      data: approval,
    });
  } catch (error: any) {
    console.error("[PUBLIC ACCEPT/REJECT CONTRACT] Error:", error);
    if (
      error.message.includes("Invalid") ||
      error.message.includes("expired") ||
      error.message.includes("already been")
    ) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({
      message: error.message || `Failed to ${action} contract`,
    });
  }
}

/**
 * Get contract snapshot by approval ID
 * Returns the saved snapshot for finalized contracts
 */
export async function getSnapshot(req: WithUser, res: Response) {
  const approvalId = req.params.approvalId;

  if (!approvalId || !isValidObjectId(approvalId)) {
    return res.status(400).json({ message: "Invalid approval ID" });
  }

  try {
    const snapshot = await approvalService.getSnapshotByApprovalId(
      new Types.ObjectId(approvalId)
    );

    if (!snapshot) {
      return res.status(404).json({ message: "Snapshot not found" });
    }

    return res.status(200).json({
      message: "Snapshot retrieved successfully",
      data: snapshot,
    });
  } catch (error: any) {
    console.error("[GET SNAPSHOT] Error:", error);
    return res.status(500).json({
      message: error.message || "Failed to retrieve snapshot",
    });
  }
}

/**
 * Download contract PDF (authenticated)
 * Generates PDF from snapshot and stores hash on first download
 */
export async function downloadSnapshotPdf(req: WithUser, res: Response) {
  const approvalId = req.params.approvalId;

  if (!approvalId || !isValidObjectId(approvalId)) {
    return res.status(400).json({ message: "Invalid approval ID" });
  }

  try {
    // Find snapshot by approval ID
    const snapshot = await ContractSnapshot.findOne({
      approvalId: new Types.ObjectId(approvalId),
    });
    if (!snapshot) {
      return res
        .status(404)
        .json({
          message:
            "Contract snapshot not found. The contract may not have been signed yet.",
        });
    }

    // Generate PDF
    const { buffer } = await pdfService.generateContractPdfBuffer(
      snapshot._id as Types.ObjectId
    );

    // Compute hash and store if not already done
    if (!snapshot.pdfHash) {
      const hash = pdfService.computePdfHash(buffer);
      snapshot.pdfHash = hash;
      snapshot.pdfGeneratedAt = new Date();
      await snapshot.save();
      console.log(
        `[PDF DOWNLOAD] Hash stored for snapshot ${snapshot._id}: ${hash.substring(0, 16)}...`
      );
    }

    // Send PDF
    const filename =
      `${snapshot.templateSnapshot?.title || "Contract"}_${new Date().toISOString().split("T")[0]}.pdf`.replace(
        /\s+/g,
        "_"
      );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (error: any) {
    console.error("[PDF DOWNLOAD] Error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to generate PDF" });
  }
}

/**
 * Download contract PDF (public access)
 */
export async function downloadPublicSnapshotPdf(req: any, res: Response) {
  const { templateId, applicantId } = req.params;
  const token = req.query.token as string;

  if (!templateId || !applicantId || !token) {
    return res.status(400).json({ message: "Missing required parameters" });
  }

  if (!isValidObjectId(templateId) || !isValidObjectId(applicantId)) {
    return res
      .status(400)
      .json({ message: "Invalid templateId or applicantId" });
  }

  try {
    // Verify access token
    const approval = await approvalService.getContractByPublicToken(
      new Types.ObjectId(templateId),
      new Types.ObjectId(applicantId),
      token
    );

    if (!approval) {
      return res
        .status(404)
        .json({
          message: "Contract not found or access token is invalid/expired",
        });
    }

    // Find snapshot
    const snapshot = await ContractSnapshot.findOne({
      approvalId: approval._id,
    });
    if (!snapshot) {
      return res
        .status(404)
        .json({
          message:
            "Contract snapshot not found. The contract may not have been signed yet.",
        });
    }

    // Generate PDF
    const { buffer } = await pdfService.generateContractPdfBuffer(
      snapshot._id as Types.ObjectId
    );

    // Compute hash and store if not already done
    if (!snapshot.pdfHash) {
      const hash = pdfService.computePdfHash(buffer);
      snapshot.pdfHash = hash;
      snapshot.pdfGeneratedAt = new Date();
      await snapshot.save();
      console.log(
        `[PDF DOWNLOAD PUBLIC] Hash stored for snapshot ${snapshot._id}: ${hash.substring(0, 16)}...`
      );
    }

    // Send PDF
    const filename =
      `${snapshot.templateSnapshot?.title || "Contract"}_${new Date().toISOString().split("T")[0]}.pdf`.replace(
        /\s+/g,
        "_"
      );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (error: any) {
    console.error("[PDF DOWNLOAD PUBLIC] Error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to generate PDF" });
  }
}

/**
 * Verify PDF integrity (tamper check) - authenticated
 */
export async function verifyPdfIntegrity(req: WithUser, res: Response) {
  const approvalId = req.params.approvalId;

  if (!approvalId || !isValidObjectId(approvalId)) {
    return res.status(400).json({ message: "Invalid approval ID" });
  }

  if (!req.file) {
    return res.status(400).json({ message: "No PDF file uploaded" });
  }

  try {
    const snapshot = await ContractSnapshot.findOne({
      approvalId: new Types.ObjectId(approvalId),
    });
    if (!snapshot) {
      return res.status(404).json({ message: "Contract snapshot not found" });
    }

    const result = await pdfService.verifyPdfTamper(
      snapshot._id as Types.ObjectId,
      req.file.buffer
    );

    return res.status(200).json({
      message: result.message,
      data: {
        isValid: result.isValid,
        storedHash: result.storedHash
          ? `${result.storedHash.substring(0, 16)}...`
          : null,
        uploadedHash: `${result.uploadedHash.substring(0, 16)}...`,
      },
    });
  } catch (error: any) {
    console.error("[PDF VERIFY] Error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to verify PDF" });
  }
}

/**
 * Verify PDF integrity (tamper check) - public access
 */
export async function verifyPublicPdfIntegrity(req: any, res: Response) {
  const { templateId, applicantId } = req.params;
  const token = req.query.token as string;

  if (!templateId || !applicantId || !token) {
    return res.status(400).json({ message: "Missing required parameters" });
  }

  if (!isValidObjectId(templateId) || !isValidObjectId(applicantId)) {
    return res
      .status(400)
      .json({ message: "Invalid templateId or applicantId" });
  }

  if (!req.file) {
    return res.status(400).json({ message: "No PDF file uploaded" });
  }

  try {
    // Verify access token
    const approval = await approvalService.getContractByPublicToken(
      new Types.ObjectId(templateId),
      new Types.ObjectId(applicantId),
      token
    );

    if (!approval) {
      return res
        .status(404)
        .json({
          message: "Contract not found or access token is invalid/expired",
        });
    }

    const snapshot = await ContractSnapshot.findOne({
      approvalId: approval._id,
    });
    if (!snapshot) {
      return res.status(404).json({ message: "Contract snapshot not found" });
    }

    const result = await pdfService.verifyPdfTamper(
      snapshot._id as Types.ObjectId,
      req.file.buffer
    );

    return res.status(200).json({
      message: result.message,
      data: {
        isValid: result.isValid,
        storedHash: result.storedHash
          ? `${result.storedHash.substring(0, 16)}...`
          : null,
        uploadedHash: `${result.uploadedHash.substring(0, 16)}...`,
      },
    });
  } catch (error: any) {
    console.error("[PDF VERIFY PUBLIC] Error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to verify PDF" });
  }
}

/**
 * Save client-side generated PDF hash (authenticated)
 * This allows the frontend to generate PDFs using html2pdf.js and still enable tamper detection
 */
export async function saveClientPdfHash(req: WithUser, res: Response) {
  const { approvalId } = req.params;
  const { hash } = req.body;

  if (!approvalId || !isValidObjectId(approvalId)) {
    return res.status(400).json({ message: "Invalid approval ID" });
  }

  if (!hash || typeof hash !== "string" || hash.length !== 64) {
    return res
      .status(400)
      .json({
        message: "Invalid hash. Expected SHA-256 hex string (64 characters)",
      });
  }

  try {
    const snapshot = await ContractSnapshot.findOne({
      approvalId: new Types.ObjectId(approvalId),
    });
    if (!snapshot) {
      return res.status(404).json({ message: "Contract snapshot not found" });
    }

    // Only save hash if not already set (first download wins)
    if (!snapshot.pdfHash) {
      snapshot.pdfHash = hash;
      snapshot.pdfGeneratedAt = new Date();
      await snapshot.save();
      console.log(
        `[SAVE PDF HASH] Hash saved for snapshot ${snapshot._id}: ${hash.substring(0, 16)}...`
      );
    }

    return res.status(200).json({
      message: "PDF hash saved successfully",
      data: { hashSaved: !snapshot.pdfHash || snapshot.pdfHash === hash },
    });
  } catch (error: any) {
    console.error("[SAVE PDF HASH] Error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to save PDF hash" });
  }
}

/**
 * Save client-side generated PDF hash (public)
 */
export async function savePublicClientPdfHash(req: Request, res: Response) {
  const { templateId, applicantId } = req.params;
  const token = req.query.token as string;
  const { hash } = req.body;

  if (!templateId || !applicantId || !token) {
    return res.status(400).json({ message: "Missing required parameters" });
  }

  if (!isValidObjectId(templateId) || !isValidObjectId(applicantId)) {
    return res
      .status(400)
      .json({ message: "Invalid templateId or applicantId" });
  }

  if (!hash || typeof hash !== "string" || hash.length !== 64) {
    return res
      .status(400)
      .json({
        message: "Invalid hash. Expected SHA-256 hex string (64 characters)",
      });
  }

  try {
    // Verify access token
    const approval = await approvalService.getContractByPublicToken(
      new Types.ObjectId(templateId),
      new Types.ObjectId(applicantId),
      token
    );

    if (!approval) {
      return res
        .status(404)
        .json({
          message: "Contract not found or access token is invalid/expired",
        });
    }

    const snapshot = await ContractSnapshot.findOne({
      approvalId: approval._id,
    });
    if (!snapshot) {
      return res.status(404).json({ message: "Contract snapshot not found" });
    }

    // Only save hash if not already set (first download wins)
    if (!snapshot.pdfHash) {
      snapshot.pdfHash = hash;
      snapshot.pdfGeneratedAt = new Date();
      await snapshot.save();
      console.log(
        `[SAVE PDF HASH PUBLIC] Hash saved for snapshot ${snapshot._id}: ${hash.substring(0, 16)}...`
      );
    }

    return res.status(200).json({
      message: "PDF hash saved successfully",
      data: { hashSaved: !snapshot.pdfHash || snapshot.pdfHash === hash },
    });
  } catch (error: any) {
    console.error("[SAVE PDF HASH PUBLIC] Error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to save PDF hash" });
  }
}

/**
 * Cache PDF and save hash (authenticated)
 * Stores the client-side generated PDF for consistent downloads
 */
export async function cachePdfAndHash(req: WithUser, res: Response) {
  const { approvalId } = req.params;

  if (!approvalId || !isValidObjectId(approvalId)) {
    return res.status(400).json({ message: "Invalid approval ID" });
  }

  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ message: "PDF file is required" });
  }

  try {
    const snapshot = await ContractSnapshot.findOne({
      approvalId: new Types.ObjectId(approvalId),
    });
    if (!snapshot) {
      return res.status(404).json({ message: "Contract snapshot not found" });
    }

    // Only cache if not already cached (first download wins)
    if (!snapshot.pdfData) {
      const hash = pdfService.computePdfHash(req.file.buffer);
      snapshot.pdfData = req.file.buffer;
      snapshot.pdfHash = hash;
      snapshot.pdfGeneratedAt = new Date();
      await snapshot.save();
      console.log(
        `[CACHE PDF] PDF cached for snapshot ${snapshot._id}, hash: ${hash.substring(0, 16)}...`
      );
    }

    return res.status(200).json({
      message: "PDF cached successfully",
      data: { cached: true },
    });
  } catch (error: any) {
    console.error("[CACHE PDF] Error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to cache PDF" });
  }
}

/**
 * Get cached PDF (authenticated)
 * Returns the cached PDF if available
 */
export async function getCachedPdf(req: WithUser, res: Response) {
  const { approvalId } = req.params;

  if (!approvalId || !isValidObjectId(approvalId)) {
    return res.status(400).json({ message: "Invalid approval ID" });
  }

  try {
    const snapshot = await ContractSnapshot.findOne({
      approvalId: new Types.ObjectId(approvalId),
    });
    if (!snapshot) {
      return res.status(404).json({ message: "Contract snapshot not found" });
    }

    if (!snapshot.pdfData) {
      return res.status(404).json({ message: "No cached PDF available" });
    }

    const filename =
      `${snapshot.templateSnapshot?.title || "Contract"}_${new Date().toISOString().split("T")[0]}.pdf`.replace(
        /\s+/g,
        "_"
      );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", snapshot.pdfData.length);
    res.send(snapshot.pdfData);
  } catch (error: any) {
    console.error("[GET CACHED PDF] Error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to get cached PDF" });
  }
}

/**
 * Cache PDF and save hash (public)
 */
export async function cachePublicPdfAndHash(req: Request, res: Response) {
  const { templateId, applicantId } = req.params;
  const token = req.query.token as string;

  if (!templateId || !applicantId || !token) {
    return res.status(400).json({ message: "Missing required parameters" });
  }

  if (!isValidObjectId(templateId) || !isValidObjectId(applicantId)) {
    return res
      .status(400)
      .json({ message: "Invalid templateId or applicantId" });
  }

  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ message: "PDF file is required" });
  }

  try {
    const approval = await approvalService.getContractByPublicToken(
      new Types.ObjectId(templateId),
      new Types.ObjectId(applicantId),
      token
    );

    if (!approval) {
      return res
        .status(404)
        .json({
          message: "Contract not found or access token is invalid/expired",
        });
    }

    const snapshot = await ContractSnapshot.findOne({
      approvalId: approval._id,
    });
    if (!snapshot) {
      return res.status(404).json({ message: "Contract snapshot not found" });
    }

    // Only cache if not already cached
    if (!snapshot.pdfData) {
      const hash = pdfService.computePdfHash(req.file.buffer);
      snapshot.pdfData = req.file.buffer;
      snapshot.pdfHash = hash;
      snapshot.pdfGeneratedAt = new Date();
      await snapshot.save();
      console.log(
        `[CACHE PDF PUBLIC] PDF cached for snapshot ${snapshot._id}, hash: ${hash.substring(0, 16)}...`
      );
    }

    return res.status(200).json({
      message: "PDF cached successfully",
      data: { cached: true },
    });
  } catch (error: any) {
    console.error("[CACHE PDF PUBLIC] Error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to cache PDF" });
  }
}

/**
 * Get cached PDF (public)
 */
export async function getPublicCachedPdf(req: Request, res: Response) {
  const { templateId, applicantId } = req.params;
  const token = req.query.token as string;

  if (!templateId || !applicantId || !token) {
    return res.status(400).json({ message: "Missing required parameters" });
  }

  if (!isValidObjectId(templateId) || !isValidObjectId(applicantId)) {
    return res
      .status(400)
      .json({ message: "Invalid templateId or applicantId" });
  }

  try {
    const approval = await approvalService.getContractByPublicToken(
      new Types.ObjectId(templateId),
      new Types.ObjectId(applicantId),
      token
    );

    if (!approval) {
      return res
        .status(404)
        .json({
          message: "Contract not found or access token is invalid/expired",
        });
    }

    const snapshot = await ContractSnapshot.findOne({
      approvalId: approval._id,
    });
    if (!snapshot) {
      return res.status(404).json({ message: "Contract snapshot not found" });
    }

    if (!snapshot.pdfData) {
      return res.status(404).json({ message: "No cached PDF available" });
    }

    const filename =
      `${snapshot.templateSnapshot?.title || "Contract"}_${new Date().toISOString().split("T")[0]}.pdf`.replace(
        /\s+/g,
        "_"
      );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", snapshot.pdfData.length);
    res.send(snapshot.pdfData);
  } catch (error: any) {
    console.error("[GET CACHED PDF PUBLIC] Error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to get cached PDF" });
  }
}
