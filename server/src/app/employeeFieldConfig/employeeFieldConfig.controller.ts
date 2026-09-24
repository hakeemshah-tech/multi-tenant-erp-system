import { Response } from "express";
import * as employeeFieldConfigService from "./employeeFieldConfig.service";
import { isValidObjectId, Types } from "mongoose";
import { WithUser } from "@/common/middlewares/authMiddleware";
import { CreateOrUpdateEmployeeFieldConfigInput } from "./employeeFieldConfig.types";
import employeeModel from "@/database/models/employee.model";
import { defaultEmployeeProfileConfigData } from "@/database/defaults/defaultConfigEmployeeProfile";
import EmployeeModel from "@/database/models/employee.model";
import { EmployeeProfile } from "@/database/models/employeeProfile.model";

function extractAdditionalFieldKeys(sections: any[]): {
  sectionKey: string;
  innerSectionKey: string | null;
  fieldKey: string;
  defaultValue?: any;
}[] {
  const result: {
    sectionKey: string;
    innerSectionKey: string | null;
    fieldKey: string;
    defaultValue?: any;
  }[] = [];

  for (const section of sections) {
    for (const field of section.fields || []) {
      if (field.isAdditional) {
        result.push({
          sectionKey: section.sectionKey,
          innerSectionKey: null,
          fieldKey: field.key,
          defaultValue: field.defaultValue,
        });
      }
    }

    for (const inner of section.innerSections || []) {
      for (const field of inner.fields || []) {
        if (field.isAdditional) {
          result.push({
            sectionKey: section.sectionKey,
            innerSectionKey: inner.sectionKey,
            fieldKey: field.key,
            defaultValue: field.defaultValue,
          });
        }
      }
    }
  }

  return result;
}

/**
 * @desc Create or update employee field config
 * @route POST /employee-field-config
 */
export const createOrUpdateEmployeeFieldConfig = async (
  req: WithUser,
  res: Response
) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const designationId = req.body.designationId
    ? new Types.ObjectId(req.body.designationId)
    : null;

  const data: CreateOrUpdateEmployeeFieldConfigInput = req.body;

  console.log(
    "🔍 [DEBUG] Full request body:",
    JSON.stringify(req.body, null, 2).substring(0, 1000)
  );

  // Deep search for jobRole in the sections
  const searchForJobRole = (obj: any, path = "root"): void => {
    if (Array.isArray(obj)) {
      obj.forEach((item, idx) => searchForJobRole(item, `${path}[${idx}]`));
    } else if (obj && typeof obj === "object") {
      Object.keys(obj).forEach((key) => {
        const value = obj[key];
        if (key === "jobRole") {
          console.log(`🔍 [DEBUG] Found jobRole at ${path}.${key}:`, value);
        }
        searchForJobRole(value, `${path}.${key}`);
      });
    }
  };

  searchForJobRole(data.sections);

  const config = await employeeFieldConfigService.createOrUpdateConfig(
    tenantId,
    branchId,
    designationId,
    data.sections,
    {
      req,
      actorUserId: req.user.userId,
      actorEmail: req.user.email,
      actorName: req.user.fullName,
      diff: Array.isArray(req.body.diff) ? req.body.diff : [],
    }
  );

  // === AFTER SAVING CONFIG ===
  // const additionalFieldsToEnsure = extractAdditionalFieldKeys(data.sections);

  // if (additionalFieldsToEnsure.length > 0) {
  //   const employees = await employeeModel.find({
  //     tenantId,
  //     branchId,
  //   });

  //   for (const employee of employees) {
  //     let changed = false;

  //     // Remove any null entries from the array
  //     employee.additionalFields = (employee.additionalFields || []).filter(
  //       Boolean
  //     );

  //     // Remove stale fields
  //     const filteredFields = employee.additionalFields.filter((f: any) =>
  //       additionalFieldsToEnsure.some(
  //         (newF) =>
  //           f &&
  //           f.fieldKey === newF.fieldKey &&
  //           f.sectionKey === newF.sectionKey &&
  //           (f.innerSectionKey ?? null) === (newF.innerSectionKey ?? null)
  //       )
  //     );

  //     if (filteredFields.length !== employee.additionalFields.length) {
  //       employee.additionalFields = filteredFields;
  //       changed = true;
  //     }

  //     // Add missing fields and update null values to defaults
  //     for (const newField of additionalFieldsToEnsure) {
  //       const existingField = employee.additionalFields.find(
  //         (f: any) =>
  //           f &&
  //           f.fieldKey === newField.fieldKey &&
  //           f.sectionKey === newField.sectionKey &&
  //           (f.innerSectionKey ?? null) === (newField.innerSectionKey ?? null)
  //       );

  //       if (!existingField) {
  //         // Field doesn't exist, create it with default value
  //         employee.additionalFields.push({
  //           sectionKey: newField.sectionKey,
  //           innerSectionKey: newField.innerSectionKey ?? null,
  //           fieldKey: newField.fieldKey,
  //           value: newField.defaultValue !== undefined ? newField.defaultValue : null,
  //         });
  //         changed = true;
  //       } else if (
  //         existingField.value === null &&
  //         newField.defaultValue !== undefined
  //       ) {
  //         // Field exists but has null value, update to default if available
  //         existingField.value = newField.defaultValue;
  //         changed = true;
  //       }
  //     }

  //     if (changed) {
  //       await employee.save();
  //     }
  //   }
  // }

  return res.status(200).json({
    message: "Employee field configuration saved successfully",
    data: config,
  });
};

/**
 * @desc Get employee field config by tenant, branch, and optional designation
 * @route GET /employee-field-config
 */
export const getEmployeeFieldConfig = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const designationId = req.query.designationId
    ? (req.query.designationId as string)
    : null;

  // Get the base config
  const config = await employeeFieldConfigService.getConfig(tenantId, branchId);

  // If designationId is provided, filter documents by designation
  let filteredConfig = config;
  if (designationId && config) {
    filteredConfig = await employeeFieldConfigService.getConfigForEmployee(
      tenantId,
      branchId,
      designationId
    );
  }

  return res.status(200).json({
    message: "Employee field configuration fetched successfully",
    data: filteredConfig,
  });
};

/**
 * @desc Get employee field config by tenant, branch, and optional designation
 * @route GET /employee-field-config
 */
export const getEmployeeProfileFieldConfig = async (
  req: WithUser,
  res: Response
) => {
  return res.status(200).json({
    message: "Employee Profile field configuration fetched successfully",
    data: defaultEmployeeProfileConfigData,
  });
};

/**
 * @desc Reset employee field config to default
 * @route POST /employee-field-config/reset
 */
export const resetEmployeeFieldConfigToDefault = async (
  req: WithUser,
  res: Response
) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const designationId = req.body.designationId
    ? new Types.ObjectId(req.body.designationId)
    : null;

  const reset = await employeeFieldConfigService.resetToDefault(
    tenantId,
    branchId,
    designationId
  );

  return res.status(200).json({
    message: "Employee field configuration reset to default",
    data: reset,
  });
};

export const getEmployeeFieldConfigByOrg = async (
  req: WithUser,
  res: Response
) => {
  const {
    tenantId: tenantIdStr,
    branchId: branchIdStr,
    designationId: designationIdStr,
  } = req.query as {
    tenantId?: string;
    branchId?: string;
    designationId?: string;
  };

  if (!tenantIdStr || !branchIdStr) {
    return res.status(400).json({
      message: "tenantId and branchId are required query parameters",
    });
  }
  if (!isValidObjectId(tenantIdStr) || !isValidObjectId(branchIdStr)) {
    return res.status(400).json({ message: "Invalid tenantId or branchId" });
  }
  const tenantId = new Types.ObjectId(tenantIdStr);
  const branchId = new Types.ObjectId(branchIdStr);
  const designationId =
    designationIdStr && isValidObjectId(designationIdStr)
      ? new Types.ObjectId(designationIdStr)
      : null;

  // ✅ authorization: user must have an assignment for this tenant+branch
  const hasAccess = req.user.assignments?.some(
    (a) =>
      a.tenantId?.toString() === tenantId.toString() &&
      a.branchId?.toString() === branchId.toString()
  );

  // if (!hasAccess) {
  //   return res
  //     .status(403)
  //     .json({ message: "Not authorized for this organization." });
  // }

  const config = await employeeFieldConfigService.getConfig(
    tenantId,
    branchId,
    designationId ?? undefined
  );

  return res.status(200).json({
    message: "Employee field configuration fetched successfully",
    data: config,
  });
};

// -----------------------------------

/**
 * NEW:
 * @desc Get employee field config for the logged-in user by branch (org) ID.
 *       Validates membership via req.user.assignments (branchId match).
 * @route GET /employee-field-config/my/:branchId
 */
export const getMyEmployeeFieldConfigByBranch = async (
  req: WithUser,
  res: Response
) => {
  const { branchId: branchIdParam } = req.params;

  if (!branchIdParam || !isValidObjectId(branchIdParam)) {
    return res.status(400).json({ message: "Invalid branchId" });
  }
  const branchId = new Types.ObjectId(branchIdParam);

  const match = (req.user.assignments || []).find(
    (a) => String(a.branchId) === String(branchId)
  );
  if (!match) {
    return res.status(403).json({
      message: "Forbidden: you are not assigned to this organization (branch).",
    });
  }

  const tenantId = new Types.ObjectId(match.tenantId);

  // Get employee's designation
  const employeeProfile = await EmployeeProfile.findOne({
    userId: req.user.userId,
  });
  let employeeDesignationId = null;

  if (employeeProfile) {
    const employee = await EmployeeModel.findOne({
      employeeProfile: employeeProfile._id,
      tenantId,
      branchId,
      isDeleted: false,
    })
      .populate("designation")
      .lean();

    if (employee?.designation) {
      // If designation is an object (populated), extract _id
      // If it's already a string/ObjectId, convert to string
      const designationObj = employee.designation as any;
      employeeDesignationId =
        typeof designationObj === "object" && designationObj._id
          ? String(designationObj._id)
          : String(employee.designation);

      console.log("🔍 [DEBUG] Employee designation ID:", employeeDesignationId);
    }
  }

  // 👇 new, filtered service
  const config = await employeeFieldConfigService.getConfigForEmployee(
    tenantId,
    branchId,
    employeeDesignationId
  );

  return res.status(200).json({
    message: "Employee field configuration fetched successfully",
    data: config, // null or filtered config
  });
};

/**
 * @desc Extract Employment Type options from EmployeeFieldConfig for logged-in employer's org
 * @route GET /employee-field-config/employment-types
 */
export const getEmploymentTypeOptions = async (
  req: WithUser,
  res: Response
) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);

  const config = await employeeFieldConfigService.getConfig(
    tenantId,
    branchId,
    null
  );

  const options: string[] = [];
  if (config && Array.isArray((config as any).sections)) {
    const sections = (config as any).sections as any[];
    const empDetails = sections.find(
      (s) => (s.sectionKey || "").toLowerCase() === "employeedetails"
    );
    const fields = empDetails?.fields || [];
    const empTypeField = fields.find(
      (f: any) => (f.key || "").toLowerCase() === "employeetype"
    );
    if (empTypeField && Array.isArray(empTypeField.options)) {
      options.push(
        ...empTypeField.options.filter((x: any) => typeof x === "string")
      );
    }
  }

  return res.status(200).json({
    message: "Employment type options fetched successfully",
    data: options,
  });
};

/**
 * @desc Create or update employee field config
 * @route POST /employee-field-config
 */
// export const createOrUpdateEmployeeFieldConfig = async (
//   req: WithUser,
//   res: Response
// ) => {
//   const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
//   const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
//   const designationId = req.body.designationId
//     ? new Types.ObjectId(req.body.designationId)
//     : null;

//   const data: CreateOrUpdateEmployeeFieldConfigInput = req.body;

//   const config = await employeeFieldConfigService.createOrUpdateConfig(
//     tenantId,
//     branchId,
//     designationId,
//     data.sections
//   );

//   return res.status(200).json({
//     message: "Employee field configuration saved successfully",
//     data: config,
//   });
// };

// for (const employee of employees) {
//   let changed = false;

//   for (const newField of additionalFieldsToEnsure) {
//     const alreadyExists = employee.additionalFields.some(
//       (f: any) =>
//         f.fieldKey === newField.fieldKey &&
//         f.sectionKey === newField.sectionKey &&
//         f.innerSectionKey === (newField.innerSectionKey ?? null)
//     );

//     if (!alreadyExists) {
//       employee.additionalFields.push({
//         sectionKey: newField.sectionKey,
//         innerSectionKey: newField.innerSectionKey ?? null,
//         fieldKey: newField.fieldKey,
//         value: null,
//       });
//       changed = true;
//     }
//   }

//   if (changed) {
//     await employee.save();
//   }
// }

// function extractAdditionalFieldKeys(
//   sections: CreateOrUpdateEmployeeFieldConfigInput["sections"]
// ) {
//   const keys: {
//     sectionKey: string;
//     innerSectionKey?: string;
//     fieldKey: string;
//   }[] = [];

//   sections.forEach((section) => {
//     // Top-level fields
//     section.fields.forEach((field) => {
//       if (field.isAdditional) {
//         keys.push({
//           sectionKey: section.sectionKey,
//           fieldKey: field.key,
//         });
//       }
//     });

//     // Inner sections
//     section.innerSections?.forEach((inner) => {
//       inner.fields.forEach((field) => {
//         if (field.isAdditional) {
//           keys.push({
//             sectionKey: section.sectionKey,
//             innerSectionKey: inner.sectionKey,
//             fieldKey: field.key,
//           });
//         }
//       });
//     });
//   });

//   return keys;
// }
