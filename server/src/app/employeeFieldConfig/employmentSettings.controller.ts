import { Response } from "express";
import { Types } from "mongoose";
import { WithUser } from "@/common/middlewares/authMiddleware";
import EmployeeFieldConfig from "@/database/models/EmployeeFieldConfig";
import EmploymentSettingsMaster from "@/database/models/EmploymentSettingsMaster.model";

/**
 * @desc Get employment details config (worktype, employeetype, employmentstatus)
 * @route GET /employee-field-config/employment-settings
 */
export const getEmploymentSettings = async (req: WithUser, res: Response) => {
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

  // Find the employeedetails section
  const employmentSection = config.sections?.find(
    (s: any) => s.sectionKey === "employeedetails"
  );

  if (!employmentSection) {
    return res.status(404).json({
      message: "Employment details section not found in configuration",
    });
  }

  // Get master data
  const master = await EmploymentSettingsMaster.getOrCreate();

  // Extract options for the three fields from config
  const configSettings: {
    worktype?: { options: string[] };
    employeetype?: { options: string[] };
    employmentstatus?: { options: string[] };
  } = {};

  for (const field of employmentSection.fields || []) {
    if (field.key === "worktype" && Array.isArray(field.options)) {
      configSettings.worktype = { options: field.options };
    } else if (field.key === "employeetype" && Array.isArray(field.options)) {
      configSettings.employeetype = { options: field.options };
    } else if (
      field.key === "employmentstatus" &&
      Array.isArray(field.options)
    ) {
      configSettings.employmentstatus = { options: field.options };
    }
  }

  // Helper to get selected master options (stored in field metadata)
  // Returns which master options the employer has selected
  const getSelectedMasterOptions = (fieldKey: string): string[] => {
    const field = employmentSection.fields?.find(
      (f: any) => f.key === fieldKey
    );

    // First check if selectedMasterOptions metadata exists
    if (
      field &&
      (field as any).selectedMasterOptions &&
      Array.isArray((field as any).selectedMasterOptions)
    ) {
      return (field as any).selectedMasterOptions;
    }

    // Fallback: check field.options (in case selectedMasterOptions wasn't saved but options were)
    if (
      field &&
      field.options &&
      Array.isArray(field.options) &&
      field.options.length > 0
    ) {
      return field.options;
    }

    // If no selection exists yet, return default options (auto-select defaults on first load)
    return fieldKey === "worktype"
      ? master.worktype.defaultOptions || []
      : fieldKey === "employeetype"
        ? master.employeetype.defaultOptions || []
        : master.employmentstatus.defaultOptions || [];
  };

  // Get all master options for each field
  const worktypeAllMaster = master.worktype.options || [];
  const worktypeSelected = getSelectedMasterOptions("worktype");
  const worktypeDefaults = master.worktype.defaultOptions || [];

  const employeetypeAllMaster = master.employeetype.options || [];
  const employeetypeSelected = getSelectedMasterOptions("employeetype");
  const employeetypeDefaults = master.employeetype.defaultOptions || [];

  const employmentstatusAllMaster = master.employmentstatus.options || [];
  const employmentstatusSelected = getSelectedMasterOptions("employmentstatus");
  const employmentstatusDefaults = master.employmentstatus.defaultOptions || [];

  const settings = {
    worktype: {
      allMasterOptions: worktypeAllMaster, // All available master options
      defaultMasterOptions: worktypeDefaults, // Default options (for reference)
      selectedMasterOptions: worktypeSelected, // Currently selected options
    },
    employeetype: {
      allMasterOptions: employeetypeAllMaster,
      defaultMasterOptions: employeetypeDefaults,
      selectedMasterOptions: employeetypeSelected,
    },
    employmentstatus: {
      allMasterOptions: employmentstatusAllMaster,
      defaultMasterOptions: employmentstatusDefaults,
      selectedMasterOptions: employmentstatusSelected,
    },
  };

  return res.status(200).json({
    message: "Employment settings fetched successfully",
    data: settings,
  });
};

/**
 * @desc Update employment details config (worktype, employeetype, employmentstatus)
 * @route PUT /employee-field-config/employment-settings
 */
export const updateEmploymentSettings = async (
  req: WithUser,
  res: Response
) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);

  const { worktype, employeetype, employmentstatus } = req.body;

  // Get master data to ensure we don't save master options as custom
  const master = await EmploymentSettingsMaster.getOrCreate();

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
  const employmentSection = config.sections.find(
    (s: any) => s.sectionKey === "employeedetails"
  );

  if (!employmentSection) {
    return res.status(404).json({
      message: "Employment details section not found in configuration",
    });
  }

  // Update options for each field - save selected master options
  // Only master options are saved, no custom options
  let changed = false;

  // Helper to find or create a field
  const findOrCreateField = (fieldKey: string) => {
    let field = employmentSection.fields?.find((f: any) => f.key === fieldKey);
    if (!field) {
      // Create the field if it doesn't exist
      if (!employmentSection.fields) {
        employmentSection.fields = [];
      }
      field = {
        key: fieldKey,
        label:
          fieldKey === "worktype"
            ? "Work Type"
            : fieldKey === "employeetype"
              ? "Employment Type"
              : "Employment Status",
        placeholder: `Select ${fieldKey === "worktype" ? "Work Type" : fieldKey === "employeetype" ? "Employment Type" : "Employment Status"}`,
        required: false,
        hint: "",
        type: "select",
        options: [],
        isAdditional: true,
      };
      employmentSection.fields.push(field);
    }
    return field;
  };

  // Update worktype
  if (
    worktype?.selectedMasterOptions !== undefined &&
    Array.isArray(worktype.selectedMasterOptions)
  ) {
    const field = findOrCreateField("worktype");
    // Update field.options with selected master options (so they're used in forms)
    field.options = [...worktype.selectedMasterOptions];
    // Also save as metadata for tracking
    (field as any).selectedMasterOptions = worktype.selectedMasterOptions;
    changed = true;
  }

  // Update employeetype
  if (
    employeetype?.selectedMasterOptions !== undefined &&
    Array.isArray(employeetype.selectedMasterOptions)
  ) {
    const field = findOrCreateField("employeetype");
    field.options = [...employeetype.selectedMasterOptions];
    (field as any).selectedMasterOptions = employeetype.selectedMasterOptions;
    changed = true;
  }

  // Update employmentstatus
  if (
    employmentstatus?.selectedMasterOptions !== undefined &&
    Array.isArray(employmentstatus.selectedMasterOptions)
  ) {
    const field = findOrCreateField("employmentstatus");
    field.options = [...employmentstatus.selectedMasterOptions];
    (field as any).selectedMasterOptions =
      employmentstatus.selectedMasterOptions;
    changed = true;
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
    message: "Employment settings updated successfully",
    data: {
      worktype,
      employeetype,
      employmentstatus,
    },
  });
};
