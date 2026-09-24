import { Response } from "express";
import * as departmentService from "./department.service";
import {
  CreateDepartmentInput,
  UpdateDepartmentInput,
} from "./department.types";
import { Types } from "mongoose";
import { WithUser } from "@/common/middlewares/authMiddleware";

/**
 * @desc Create a new department
 * @route POST /departments
 */
export const createDepartment = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);

  const data: CreateDepartmentInput = req.body;

  const department = await departmentService.createDepartment(
    tenantId,
    branchId,
    data,
    {
      req,
      actorUserId: req.user.userId ?? null,
      actorEmail: req.user.email ?? null,
      actorName: req.user.fullName ?? null,
    }
  );

  return res.status(201).json({
    message: "Department created successfully",
    data: department,
  });
};

/**
 * @desc Get all departments for a tenant
 * @route GET /departments
 */
export const getDepartments = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);

  // Get status filter from query params (active, inactive, or all)
  const status =
    (req.query.status as "active" | "inactive" | "all") || "active";

  const departments = await departmentService.getDepartments(
    tenantId,
    branchId,
    status
  );

  return res.status(200).json({
    message: "Fetched departments successfully",
    data: departments,
    total: departments.length,
  });
};

/**
 * @desc Get a specific department by ID
 * @route GET /departments/:id
 */
export const getDepartmentById = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const departmentId = req.params.id;

  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const department = await departmentService.getDepartmentById(
    departmentId,
    tenantId,
    branchId
  );

  return res.status(200).json({
    message: "Fetched department successfully",
    data: department,
  });
};

/**
 * @desc Update department by ID
 * @route PUT /departments/:id
 */
export const updateDepartment = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const departmentId = req.params.id;
  const data: UpdateDepartmentInput = req.body;

  const updated = await departmentService.updateDepartment(
    departmentId,
    tenantId,
    branchId,
    data,
    {
      req,
      actorUserId: req.user.userId ?? null,
      actorEmail: req.user.email ?? null,
      actorName: req.user.fullName ?? null,
    }
  );

  return res.status(200).json({
    message: "Department updated successfully",
    data: updated,
  });
};

/**
 * @desc Toggle department active/inactive status
 * @route PATCH /departments/:id/toggle-status
 */
export const toggleDepartmentStatus = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const departmentId = req.params.id;

  const result = await departmentService.toggleDepartmentStatus(
    departmentId,
    tenantId,
    branchId,
    {
      req,
      actorUserId: req.user.userId ?? null,
      actorEmail: req.user.email ?? null,
      actorName: req.user.fullName ?? null,
    }
  );

  return res.status(200).json({
    message: result.message,
    data: result.data,
  });
};
