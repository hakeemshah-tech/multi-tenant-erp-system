import { Response } from "express";
import { Types } from "mongoose";
import { WithUser } from "@/common/middlewares/authMiddleware";
import EmployeeFieldConfig from "@/database/models/EmployeeFieldConfig";
import PersonalSettingsMaster from "@/database/models/PersonalSettingsMaster.model";

/**
 * @desc Get personal details config (gender, pronouns, residencystatus, typeofvisa)
 * @route GET /employee-field-config/personal-settings
 */
export const getPersonalSettings = async (req: WithUser, res: Response) => {
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

  // Find the personaldetails section
  const personalSection = config.sections?.find(
    (s: any) => s.sectionKey === "personaldetails"
  );

  if (!personalSection) {
    return res.status(404).json({
      message: "Personal details section not found in configuration",
    });
  }

  // Get master data
  const master = await PersonalSettingsMaster.getOrCreate();

  // Extract options for the four fields from config
  const configSettings: {
    gender?: { options: string[] };
    pronouns?: { options: string[] };
    residencystatus?: { options: string[] };
    typeofvisa?: { options: string[] };
  } = {};

  for (const field of personalSection.fields || []) {
    if (field.key === "gender" && Array.isArray(field.options)) {
      configSettings.gender = { options: field.options };
    } else if (field.key === "pronouns" && Array.isArray(field.options)) {
      configSettings.pronouns = { options: field.options };
    } else if (
      field.key === "residencystatus" &&
      Array.isArray(field.options)
    ) {
      configSettings.residencystatus = { options: field.options };
    } else if (field.key === "typeofvisa" && Array.isArray(field.options)) {
      configSettings.typeofvisa = { options: field.options };
    }
  }

  // Helper to get selected master options (stored in field metadata)
  // Returns which master options the employer has selected
  const getSelectedMasterOptions = (fieldKey: string): string[] => {
    const field = personalSection.fields?.find((f: any) => f.key === fieldKey);

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
    return fieldKey === "gender"
      ? master.gender.defaultOptions || []
      : fieldKey === "pronouns"
        ? master.pronouns.defaultOptions || []
        : fieldKey === "residencystatus"
          ? master.residencystatus.defaultOptions || []
          : master.typeofvisa.defaultOptions || [];
  };

  // Get all master options for each field
  const genderAllMaster = master.gender.options || [];
  const genderSelected = getSelectedMasterOptions("gender");
  const genderDefaults = master.gender.defaultOptions || [];

  const pronounsAllMaster = master.pronouns.options || [];
  const pronounsSelected = getSelectedMasterOptions("pronouns");
  const pronounsDefaults = master.pronouns.defaultOptions || [];

  const residencystatusAllMaster = master.residencystatus.options || [];
  const residencystatusSelected = getSelectedMasterOptions("residencystatus");
  const residencystatusDefaults = master.residencystatus.defaultOptions || [];

  const typeofvisaAllMaster = master.typeofvisa.options || [];
  const typeofvisaSelected = getSelectedMasterOptions("typeofvisa");
  const typeofvisaDefaults = master.typeofvisa.defaultOptions || [];

  return res.status(200).json({
    message: "Personal settings fetched successfully",
    data: {
      gender: {
        allMasterOptions: genderAllMaster,
        defaultMasterOptions: genderDefaults,
        selectedMasterOptions: genderSelected,
      },
      pronouns: {
        allMasterOptions: pronounsAllMaster,
        defaultMasterOptions: pronounsDefaults,
        selectedMasterOptions: pronounsSelected,
      },
      residencystatus: {
        allMasterOptions: residencystatusAllMaster,
        defaultMasterOptions: residencystatusDefaults,
        selectedMasterOptions: residencystatusSelected,
      },
      typeofvisa: {
        allMasterOptions: typeofvisaAllMaster,
        defaultMasterOptions: typeofvisaDefaults,
        selectedMasterOptions: typeofvisaSelected,
      },
    },
  });
};

/**
 * @desc Update personal details config (gender, pronouns, residencystatus, typeofvisa)
 * @route PUT /employee-field-config/personal-settings
 */
export const updatePersonalSettings = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);

  const { gender, pronouns, residencystatus, typeofvisa } = req.body;

  const config = await EmployeeFieldConfig.findOne({
    tenantId,
    branchId,
  });

  if (!config) {
    return res.status(404).json({
      message: "Employee field configuration not found",
    });
  }

  // Find the personaldetails section
  const personalSection = config.sections?.find(
    (s: any) => s.sectionKey === "personaldetails"
  );

  if (!personalSection) {
    return res.status(404).json({
      message: "Personal details section not found in configuration",
    });
  }

  // Update options for each field - save selected master options
  // Only master options are saved, no custom options
  let changed = false;

  // Helper to find or create a field
  const findOrCreateField = (fieldKey: string) => {
    let field = personalSection.fields?.find((f: any) => f.key === fieldKey);
    if (!field) {
      // Create the field if it doesn't exist
      if (!personalSection.fields) {
        personalSection.fields = [];
      }
      field = {
        key: fieldKey,
        label:
          fieldKey === "gender"
            ? "Gender"
            : fieldKey === "pronouns"
              ? "Pronouns"
              : fieldKey === "residencystatus"
                ? "Residency Status"
                : "Type Of Visa",
        placeholder: `Select ${fieldKey === "gender" ? "Gender" : fieldKey === "pronouns" ? "Pronouns" : fieldKey === "residencystatus" ? "Residency Status" : "Type Of Visa"}`,
        required: false,
        hint: "",
        type: "select",
        options: [],
        isAdditional: false,
      };
      personalSection.fields.push(field);
    }
    return field;
  };

  // Update gender
  if (
    gender?.selectedMasterOptions !== undefined &&
    Array.isArray(gender.selectedMasterOptions)
  ) {
    const field = findOrCreateField("gender");
    // Update field.options with selected master options (so they're used in forms)
    field.options = [...gender.selectedMasterOptions];
    // Also save as metadata for tracking
    (field as any).selectedMasterOptions = gender.selectedMasterOptions;
    changed = true;
  }

  // Update pronouns
  if (
    pronouns?.selectedMasterOptions !== undefined &&
    Array.isArray(pronouns.selectedMasterOptions)
  ) {
    const field = findOrCreateField("pronouns");
    field.options = [...pronouns.selectedMasterOptions];
    (field as any).selectedMasterOptions = pronouns.selectedMasterOptions;
    changed = true;
  }

  // Update residencystatus
  if (
    residencystatus?.selectedMasterOptions !== undefined &&
    Array.isArray(residencystatus.selectedMasterOptions)
  ) {
    const field = findOrCreateField("residencystatus");
    field.options = [...residencystatus.selectedMasterOptions];
    (field as any).selectedMasterOptions =
      residencystatus.selectedMasterOptions;
    changed = true;
  }

  // Update typeofvisa
  if (
    typeofvisa?.selectedMasterOptions !== undefined &&
    Array.isArray(typeofvisa.selectedMasterOptions)
  ) {
    const field = findOrCreateField("typeofvisa");
    field.options = [...typeofvisa.selectedMasterOptions];
    (field as any).selectedMasterOptions = typeofvisa.selectedMasterOptions;
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
    message: "Personal settings updated successfully",
    data: {
      gender,
      pronouns,
      residencystatus,
      typeofvisa,
    },
  });
};
