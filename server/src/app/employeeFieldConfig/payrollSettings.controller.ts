import { Response } from "express";
import { Types } from "mongoose";
import { WithUser } from "@/common/middlewares/authMiddleware";
import * as employeeFieldConfigService from "./employeeFieldConfig.service";
import EmployeeFieldConfig from "@/database/models/EmployeeFieldConfig";

/**
 * @desc Get payroll default values
 * @route GET /employee-field-config/payroll-settings
 */
export const getPayrollSettings = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);

  const config = await EmployeeFieldConfig.findOne({
    tenantId,
    branchId,
  }).lean();

  if (!config) {
    return res.status(404).json({
      message: "Employee field configuration not found",
    });
  }

  // Find the payrolldetailsForEmployee section
  const payrollSection = config.sections?.find(
    (s: any) => s.sectionKey === "payrolldetailsForEmployee"
  );

  if (!payrollSection) {
    return res.status(404).json({
      message: "Payroll section not found in configuration",
    });
  }

  // Find the awardsandlevels inner section
  const awardsAndLevelsSection = payrollSection.innerSections?.find(
    (inn: any) => inn.sectionKey === "awardsandlevels"
  );

  if (!awardsAndLevelsSection) {
    return res.status(404).json({
      message: "Awards and levels section not found",
    });
  }

  // Extract default values for the four fields
  const settings: Record<string, any> = {};
  for (const field of awardsAndLevelsSection.fields || []) {
    if (
      field.key === "supercontribution" ||
      field.key === "probationperiod" ||
      field.key === "casualrate" ||
      field.key === "annualleave"
    ) {
      settings[field.key] = field.defaultValue ?? null;
    }
  }

  return res.status(200).json({
    message: "Payroll settings fetched successfully",
    data: settings,
  });
};

/**
 * @desc Update payroll default values
 * @route PUT /employee-field-config/payroll-settings
 */
export const updatePayrollSettings = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);

  const { supercontribution, probationperiod, casualrate, annualleave } =
    req.body;

  // Get current config
  const config = await EmployeeFieldConfig.findOne({
    tenantId,
    branchId,
  });

  if (!config) {
    return res.status(404).json({
      message: "Employee field configuration not found",
    });
  }

  // Find and update the fields
  const payrollSection = config.sections.find(
    (s: any) => s.sectionKey === "payrolldetailsForEmployee"
  );

  if (!payrollSection) {
    return res.status(404).json({
      message: "Payroll section not found in configuration",
    });
  }

  const awardsAndLevelsSection = payrollSection.innerSections?.find(
    (inn: any) => inn.sectionKey === "awardsandlevels"
  );

  if (!awardsAndLevelsSection) {
    return res.status(404).json({
      message: "Awards and levels section not found",
    });
  }

  // Update default values
  let changed = false;
  for (const field of awardsAndLevelsSection.fields || []) {
    if (field.key === "supercontribution" && supercontribution !== undefined) {
      field.defaultValue = supercontribution;
      changed = true;
    } else if (
      field.key === "probationperiod" &&
      probationperiod !== undefined
    ) {
      field.defaultValue = probationperiod;
      changed = true;
    } else if (field.key === "casualrate" && casualrate !== undefined) {
      field.defaultValue = casualrate;
      changed = true;
    } else if (field.key === "annualleave" && annualleave !== undefined) {
      field.defaultValue = annualleave;
      changed = true;
    }
  }

  if (!changed) {
    return res.status(400).json({
      message: "No valid fields to update",
    });
  }

  // Mark the sections as modified
  config.markModified("sections");

  await config.save();

  return res.status(200).json({
    message: "Payroll settings updated successfully",
    data: {
      supercontribution,
      probationperiod,
      casualrate,
      annualleave,
    },
  });
};
