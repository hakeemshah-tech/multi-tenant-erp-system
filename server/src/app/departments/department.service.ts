import { Department } from "@/database/models/department.model";
import { AppError } from "@/common/utils/app-error";
import {
  CreateDepartmentInput,
  UpdateDepartmentInput,
} from "./department.types";
import mongoose from "mongoose";
import {
  logDepartmentCreate,
  logDepartmentUpdate,
  logDepartmentDelete,
} from "@/audit/department-audit";

type AuditOpts = {
  req?: Request | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
};

export const createDepartment = async (
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  data: CreateDepartmentInput,
  audit?: AuditOpts
) => {
  // Check for duplicate department name (case-insensitive) within the same tenant and branch
  const existingDepartment = await Department.findOne({
    tenantId,
    branchId,
    name: { $regex: new RegExp(`^${data.name.trim()}$`, "i") },
    isDeleted: false,
  });

  if (existingDepartment) {
    throw new AppError(
      `Department with name "${data.name}" already exists in this organisation`,
      409
    );
  }

  const department = await Department.create({
    tenantId,
    branchId,
    ...data,
  });

  // 🔐 AUDIT
  try {
    await logDepartmentCreate({
      ctx: {
        req: audit?.req ?? null,
        tenantId: String(tenantId),
        branchId: String(branchId),
        actorUserId: audit?.actorUserId ?? null,
        actorEmail: audit?.actorEmail ?? null,
        actorName: audit?.actorName ?? null,
      },
      department: {
        _id: String(department._id),
        name: department.name,
        description: (department as any).description,
      },
      payload: data as Record<string, any>,
    });
  } catch (e) {
    console.error("[audit] department.create failed:", e);
  }

  return department;
};

/**
 * Get all departments for a tenant and branch
 * @param status - 'active' | 'inactive' | 'all' - Filter by status
 */
export const getDepartments = async (
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  status: "active" | "inactive" | "all" = "active"
) => {
  const filter: any = { tenantId, branchId };

  if (status === "active") {
    filter.isDeleted = false;
  } else if (status === "inactive") {
    filter.isDeleted = true;
  }
  // If status is "all", don't filter by isDeleted

  return Department.find(filter).lean();
};

/**
 * Get single department by ID for a specific tenant and branch
 * (Allows fetching both active and inactive departments)
 */
export const getDepartmentById = async (
  id: string,
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId
) => {
  const department = await Department.findOne({
    _id: id,
    tenantId,
    branchId,
  }).lean();

  if (!department) throw new AppError("Department not found", 404);
  return department;
};

/**
 * Update department details
 */
export const updateDepartment = async (
  id: string,
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  data: UpdateDepartmentInput,
  audit?: AuditOpts
) => {
  // Fetch current for accurate diff (allow both active and inactive)
  const before = await Department.findOne({
    _id: id,
    tenantId,
    branchId,
  }).lean();

  if (!before) throw new AppError("Department not found", 404);

  // Check for duplicate department name if name is being updated
  // Only check against active departments
  if (
    data.name &&
    data.name.trim().toLowerCase() !==
      (before.name as string).trim().toLowerCase()
  ) {
    const existingDepartment = await Department.findOne({
      tenantId,
      branchId,
      name: { $regex: new RegExp(`^${data.name.trim()}$`, "i") },
      isDeleted: false,
      _id: { $ne: id }, // Exclude the current department
    });

    if (existingDepartment) {
      throw new AppError(
        `Department with name "${data.name}" already exists in this organisation`,
        409
      );
    }
  }

  const department = await Department.findOneAndUpdate(
    { _id: id, tenantId, branchId },
    data,
    { new: true }
  );

  if (!department) throw new AppError("Department not found", 404);

  // 🔐 AUDIT
  try {
    await logDepartmentUpdate({
      ctx: {
        req: audit?.req ?? null,
        tenantId: String(tenantId),
        branchId: String(branchId),
        actorUserId: audit?.actorUserId ?? null,
        actorEmail: audit?.actorEmail ?? null,
        actorName: audit?.actorName ?? null,
      },
      departmentId: String(department._id),
      before,
      after: department.toObject(),
      updatePayload: data as Record<string, any>,
    });
  } catch (e) {
    console.error("[audit] department.update failed:", e);
  }

  return department;
};

/**
 * Toggle department active/inactive status
 */
export const toggleDepartmentStatus = async (
  id: string,
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  audit?: AuditOpts
) => {
  // Fetch current department
  const before = await Department.findOne({
    _id: id,
    tenantId,
    branchId,
  }).lean();

  if (!before) throw new AppError("Department not found", 404);

  const newStatus = !before.isDeleted; // Toggle status
  const result = await Department.findOneAndUpdate(
    { _id: id, tenantId, branchId },
    {
      isDeleted: newStatus,
      deletedAt: newStatus ? new Date() : null,
    },
    { new: true }
  );

  if (!result) throw new AppError("Department not found", 404);

  // 🔐 AUDIT
  try {
    await logDepartmentUpdate({
      ctx: {
        req: audit?.req ?? null,
        tenantId: String(tenantId),
        branchId: String(branchId),
        actorUserId: audit?.actorUserId ?? null,
        actorEmail: audit?.actorEmail ?? null,
        actorName: audit?.actorName ?? null,
      },
      departmentId: String(result._id),
      before,
      after: result.toObject(),
      updatePayload: { isDeleted: newStatus } as Record<string, any>,
    });
  } catch (e) {
    console.error("[audit] department.status-toggle failed:", e);
  }

  return {
    message: newStatus
      ? "Department marked as inactive successfully"
      : "Department marked as active successfully",
    data: result,
  };
};
