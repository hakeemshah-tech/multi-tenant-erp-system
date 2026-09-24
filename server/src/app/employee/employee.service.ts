import mongoose, { Types } from "mongoose";
import EmployeeModel from "@/database/models/employee.model";
import { EmployeeInput, CreateEmployeeServiceInput } from "./employee.types";
import EmployeeFieldConfig from "@/database/models/EmployeeFieldConfig";
import { EmployeeProfile } from "@/database/models/employeeProfile.model";
import { User } from "@/database/models/user.model";
import { Role } from "@/database/models/role.model";
import { getAggregatedRoles } from "./employeePermission.service";
import { getRolePermissions } from "../rolePermissions/rolePermission.service";
import get from "lodash/get";
import set from "lodash/set";
// 🔎 ClickHouse client + table name
import { ch, AUDIT_DB_TABLE } from "@/audit/clickhouse"; // ⬅️ adjust path if needed
import { randomUUID } from "crypto";
import isEqual from "lodash/isEqual";
import { logUpdate } from "@/audit/logger";
import {
  buildAdditionalPath,
  isEqualForAudit,
  normalizeArrayOfObjectsForAudit,
  normalizeForAuditValue,
} from "@/common/utils/general";
import { createEmployeeDataChangeNotification } from "@/services/notification.service";

/**
 * Create a new employee record
 */
export const createEmployee = async ({
  tenantId,
  branchId,
  data,
}: CreateEmployeeServiceInput) => {
  return await EmployeeModel.create({
    tenantId,
    branchId,
    designation: new Types.ObjectId(data.designationId),
    employeeProfile: new Types.ObjectId(data.employeeProfileId),
    reportingto: new Types.ObjectId(data.reportingto),
    additionalDesignationIds: data.additionalDesignationIds
      ? data.additionalDesignationIds.map((id) => new Types.ObjectId(id))
      : [],
    additionalFields: data.additionalFields || {},
  });
};
/**
 * Get an employee by ID (excluding soft-deleted)
 */
// export const getEmployeeById = async (id: Types.ObjectId) => {
//   return await EmployeeModel.findOne({ _id: id, isDeleted: false })
//     .populate({
//       path: "designation",
//       populate: {
//         path: "departmentIds", // this assumes `designation.departmentIds` is a ref
//       },
//     })
//     .populate({ path: "employeeProfile", populate: { path: "userId" } })
//     .lean();
// };

// export const getEmployeeById = async (id: Types.ObjectId) => {
//   // Step 1: Fetch employee with nested population
//   const employee = await EmployeeModel.findOne({ _id: id, isDeleted: false })
//     .populate({
//       path: "designation",
//       populate: {
//         path: "departmentIds",
//       },
//     })
//     .populate({ path: "employeeProfile", populate: { path: "userId" } })
//     .lean();

//   if (!employee) return null;

//   // Step 2: Get relevant field config
//   const config = await EmployeeFieldConfig.findOne({
//     tenantId: employee.tenantId,
//     branchId: employee.branchId,
//     // optionally: designationId: employee.designation?._id
//   }).lean();

//   if (!config) return employee;

//   // Step 3: Extract reference fields with their target models
//   const referenceFields: {
//     sectionKey: string;
//     innerSectionKey: string | null;
//     fieldKey: string;
//     referenceModel: string;
//   }[] = [];

//   for (const section of config.sections) {
//     for (const field of section.fields) {
//       if (field.type === "reference") {
//         referenceFields.push({
//           sectionKey: section.sectionKey,
//           innerSectionKey: null,
//           fieldKey: field.key,
//           referenceModel: field.referenceModel,
//         });
//       }
//     }

//     for (const inner of section.innerSections || []) {
//       for (const field of inner.fields) {
//         if (field.type === "reference") {
//           referenceFields.push({
//             sectionKey: section.sectionKey,
//             innerSectionKey: inner.sectionKey,
//             fieldKey: field.key,
//             referenceModel: field.referenceModel,
//           });
//         }
//       }
//     }
//   }

//   // Step 4: Enrich additionalFields dynamically
//   const enrichedAdditionalFields = await Promise.all(
//     (employee.additionalFields || []).map(async (field: any) => {
//       const refMeta = referenceFields.find(
//         (ref) =>
//           ref.sectionKey === field.sectionKey &&
//           ref.innerSectionKey === field.innerSectionKey &&
//           ref.fieldKey === field.fieldKey
//       );

//       if (refMeta && Types.ObjectId.isValid(field.value)) {
//         try {
//           const refModel = mongoose.model(refMeta.referenceModel);
//           const refDoc = await refModel
//             .findById(field.value)
//             .select("-__v")
//             .lean();

//           return {
//             ...field,
//             value: refDoc ? { _id: refDoc._id, ...refDoc } : field.value,
//           };
//         } catch {
//           return field;
//         }
//       }

//       return field;
//     })
//   );

//   return {
//     ...employee,
//     additionalFields: enrichedAdditionalFields,
//   };
// };

// export const getEmployeeById = async (id: Types.ObjectId) => {
//   // Step 1: Fetch employee with nested population
//   const employee = await EmployeeModel.findOne({ _id: id, isDeleted: false })
//     .populate({
//       path: "designation",
//       populate: {
//         path: "departmentIds",
//       },
//     })
//     .populate({ path: "employeeProfile", populate: { path: "userId" } })
//     .lean();

//   if (!employee) return null;

//   // Step 2: Get relevant field config
//   const config = await EmployeeFieldConfig.findOne({
//     tenantId: employee.tenantId,
//     branchId: employee.branchId,
//   }).lean();

//   if (!config) return employee;

//   // Step 3: Extract reference fields with their target models
//   const referenceFields: {
//     sectionKey: string;
//     innerSectionKey: string | null;
//     fieldKey: string;
//     referenceModel: string;
//   }[] = [];

//   for (const section of config.sections) {
//     for (const field of section.fields) {
//       if (field.type === "reference") {
//         referenceFields.push({
//           sectionKey: section.sectionKey,
//           innerSectionKey: null,
//           fieldKey: field.key,
//           referenceModel: field.referenceModel,
//         });
//       }
//     }

//     for (const inner of section.innerSections || []) {
//       for (const field of inner.fields) {
//         if (field.type === "reference") {
//           referenceFields.push({
//             sectionKey: section.sectionKey,
//             innerSectionKey: inner.sectionKey,
//             fieldKey: field.key,
//             referenceModel: field.referenceModel,
//           });
//         }
//       }
//     }
//   }

//   // Step 4: Enrich additionalFields dynamically
//   const enrichedAdditionalFields = await Promise.all(
//     (employee.additionalFields || []).map(async (field: any) => {
//       const refMeta = referenceFields.find(
//         (ref) =>
//           ref.sectionKey === field.sectionKey &&
//           ref.innerSectionKey === field.innerSectionKey &&
//           ref.fieldKey === field.fieldKey
//       );

//       if (refMeta && Types.ObjectId.isValid(field.value)) {
//         try {
//           const refModel = mongoose.model(refMeta.referenceModel);

//           let refDoc;
//           let name;

//           if (refMeta.referenceModel === "Employee") {
//             refDoc = await refModel
//               .findById(field.value)
//               .populate({
//                 path: "employeeProfile",
//                 select: "personaldetails.firstname",
//               })
//               .select("_id")
//               .lean();

//             name = refDoc?.employeeProfile?.personaldetails?.firstname;
//           } else {
//             refDoc = await refModel
//               .findById(field.value)
//               .select("_id name")
//               .lean();
//             name = refDoc?.name;
//           }

//           return {
//             ...field,
//             value: refDoc
//               ? {
//                   _id: refDoc._id,
//                   name: name ?? "",
//                 }
//               : field.value,
//           };
//         } catch {
//           return field;
//         }
//       }

//       return field;
//     })
//   );

//   // Step 5: Return enriched employee
//   return {
//     ...employee,
//     additionalFields: enrichedAdditionalFields,
//   };
// };

// This for organization >> Employee by ID GET
export const getEmployeeById = async (id: Types.ObjectId) => {
  console.log(
    "🔍 DEBUG: getEmployeeById - Fetching fresh employee data from database"
  );

  // 1) Fetch employee with employeeProfile populated (ALWAYS FRESH FROM DB)
  const employee = await EmployeeModel.findOne({ _id: id, isDeleted: false })
    .populate({
      path: "designation",
      populate: { path: "departmentIds" },
    })
    .populate({
      path: "additionalDesignationIds",
      select: "name _id roleIds",
    })
    .populate({ path: "employeeProfile", populate: { path: "userId" } })
    .lean();

  console.log("🔍 DEBUG: getEmployeeById - Fresh employee data:", {
    employeeId: employee?._id,
    employeeFields: employee?.employeeFields,
    personaldetails: employee?.employeeFields?.personaldetails,
    address: employee?.employeeFields?.address,
    main: employee?.employeeFields?.main,
    documents: employee?.employeeFields?.documents,
  });

  if (!employee) return null;

  // 2) Load field config for this tenant/branch (needed to know which keys are 'reference' and to which model)
  const config = await EmployeeFieldConfig.findOne({
    tenantId: employee.tenantId,
    branchId: employee.branchId,
  }).lean();

  if (!config) return employee;

  // 3) Build map of reference fields -> their target model
  const referenceFields: {
    sectionKey: string;
    innerSectionKey: string | null;
    fieldKey: string;
    referenceModel: string;
  }[] = [];

  for (const section of config.sections || []) {
    for (const field of section.fields || []) {
      if (field.type === "reference") {
        referenceFields.push({
          sectionKey: section.sectionKey,
          innerSectionKey: null,
          fieldKey: field.key,
          referenceModel: field.referenceModel,
        });
      }
    }
    for (const inner of section.innerSections || []) {
      for (const field of inner.fields || []) {
        if (field.type === "reference") {
          referenceFields.push({
            sectionKey: section.sectionKey,
            innerSectionKey: inner.sectionKey,
            fieldKey: field.key,
            referenceModel: field.referenceModel,
          });
        }
      }
    }
  }

  // 4) Enrich *employeeFields.additionalFields* (not employee.additionalFields!)
  const sourceAdditional =
    (employee.employeeFields?.additionalFields as any[]) || [];

  const enrichedAdditionalFields = await Promise.all(
    sourceAdditional.map(async (field: any) => {
      const refMeta = referenceFields.find(
        (ref) =>
          ref.sectionKey === field.sectionKey &&
          (ref.innerSectionKey ?? null) === (field.innerSectionKey ?? null) &&
          ref.fieldKey === field.fieldKey
      );

      // Only enrich when config says it's a reference and the value is an ObjectId
      if (refMeta && Types.ObjectId.isValid(field.value)) {
        try {
          if (refMeta.referenceModel === "Employee") {
            // Fetch the employee and use the MIRRORED first name
            const refEmp = await EmployeeModel.findById(field.value)
              .select("_id employeeFields.personaldetails.firstname")
              .lean();

            const name =
              refEmp?.employeeFields?.personaldetails?.firstname ?? "";

            return {
              ...field,
              value: refEmp
                ? {
                    _id: refEmp._id,
                    name,
                  }
                : field.value,
            };
          } else {
            // Generic model with a 'name' field
            const refModel = mongoose.model(refMeta.referenceModel);
            const refDoc = await refModel
              .findById(field.value)
              .select("_id name")
              .lean();

            return {
              ...field,
              value: refDoc
                ? {
                    _id: refDoc._id,
                    name: refDoc.name ?? "",
                  }
                : field.value,
            };
          }
        } catch {
          // On any error, leave as-is
          return field;
        }
      }

      return field;
    })
  );

  // 5) Return with employeeProfile populated and employeeFields.additionalFields replaced by enriched version
  const result = {
    ...employee,
    email: (employee?.employeeProfile as any)?.userId?.email,
    employeeFields: {
      ...(employee.employeeFields || {}),
      additionalFields: enrichedAdditionalFields,
    },
  };

  console.log(
    "🔍 DEBUG: getEmployeeById - Final result being sent to frontend:",
    {
      employeeId: result._id,
      employeeFields: result.employeeFields,
      personaldetails: result.employeeFields?.personaldetails,
      address: result.employeeFields?.address,
      main: result.employeeFields?.main,
      documents: result.employeeFields?.documents,
    }
  );

  // Debug: Check for any inner section fields in the result
  if (result.employeeFields) {
    Object.keys(result.employeeFields).forEach((sectionKey) => {
      const section = result.employeeFields[sectionKey];
      if (section && typeof section === "object" && !Array.isArray(section)) {
        Object.keys(section).forEach((innerSectionKey) => {
          const innerSection = section[innerSectionKey];
          if (
            innerSection &&
            typeof innerSection === "object" &&
            !Array.isArray(innerSection)
          ) {
            console.log("🔍 DEBUG: Found inner section in employeeFields:", {
              section: sectionKey,
              innerSection: innerSectionKey,
              fields: Object.keys(innerSection),
              values: innerSection,
            });
          }
        });
      }
    });
  }

  return result;
};

/**
 * Get all employees for a tenant and branch (excluding soft-deleted)
 */
export const getEmployees = async (
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId,
  filters: Partial<EmployeeInput> = {}
) => {
  return await EmployeeModel.find({
    tenantId,
    branchId,
    isDeleted: false,
    ...filters,
  })
    .populate("designation")
    .populate({
      path: "employeeProfile",
      populate: {
        path: "userId", // nested population
      },
    })
    .populate("reportingto")
    .lean();
};

/**
 * Get the maximum data access level for "employees" section from user's roles
 * Returns the highest data access level from roles that have "read" permission
 */
export const getCurrentUserDataAccessLevel = async (
  userId: Types.ObjectId,
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId
): Promise<number | null> => {
  try {
    // Get user's aggregated roles
    const aggregatedRoles = await getAggregatedRoles(
      userId,
      tenantId,
      branchId
    );

    // If system admin, return max level
    if (aggregatedRoles.isSystemAdmin) {
      return 7;
    }

    let maxDataAccessLevel: number | null = null;
    const EMPLOYEES_SECTION = "employees";

    // Check each role for read permission and data access level
    for (const roleId of aggregatedRoles.roleIds) {
      const { permissions, dataAccessLevels } = await getRolePermissions(
        tenantId,
        branchId,
        roleId
      );

      // Check if this role has read permission for "employees" section
      if (permissions[EMPLOYEES_SECTION]?.read) {
        const dataAccessLevel = dataAccessLevels?.[EMPLOYEES_SECTION];
        if (dataAccessLevel !== undefined && dataAccessLevel !== null) {
          // Take the maximum data access level
          if (
            maxDataAccessLevel === null ||
            dataAccessLevel > maxDataAccessLevel
          ) {
            maxDataAccessLevel = dataAccessLevel;
          }
        }
      }
    }

    return maxDataAccessLevel;
  } catch (error) {
    console.error("Error getting current user data access level:", error);
    return null;
  }
};

/**
 * Get an employee's level from their roles (via designations)
 * Returns the highest level from all roles
 */
export const getEmployeeLevel = async (
  employee: any,
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId
): Promise<number> => {
  const roleIds = new Set<string>();

  // Get roles from primary designation
  if (
    employee.designation &&
    typeof employee.designation === "object" &&
    "roleIds" in employee.designation
  ) {
    const primaryDesignation = employee.designation as any;
    if (Array.isArray(primaryDesignation.roleIds)) {
      primaryDesignation.roleIds.forEach((roleId: string) => {
        if (roleId) roleIds.add(roleId.toLowerCase().trim());
      });
    }
  }

  // Get roles from additional designations
  if (Array.isArray(employee.additionalDesignationIds)) {
    for (const additionalDesignation of employee.additionalDesignationIds) {
      if (
        additionalDesignation &&
        typeof additionalDesignation === "object" &&
        "roleIds" in additionalDesignation
      ) {
        const designation = additionalDesignation as any;
        if (Array.isArray(designation.roleIds)) {
          designation.roleIds.forEach((roleId: string) => {
            if (roleId) roleIds.add(roleId.toLowerCase().trim());
          });
        }
      }
    }
  }

  // Get direct additional roles from employee
  if (Array.isArray(employee.additionalRoleIds)) {
    employee.additionalRoleIds.forEach((roleId: string) => {
      if (roleId) roleIds.add(roleId.toLowerCase().trim());
    });
  }

  // If no roles, return default level 1
  if (roleIds.size === 0) {
    return 1;
  }

  // Fetch role levels and return the highest
  const roles = await Role.find({
    tenantId,
    branchId,
    roleId: { $in: Array.from(roleIds) },
    isDeleted: false,
  })
    .select("level")
    .lean();

  if (roles.length === 0) {
    return 1;
  }

  // Return the highest level
  return Math.max(...roles.map((r: any) => r.level || 1));
};

/**
 * Get employees with pagination and filtering
 */
export const getEmployeesWithPagination = async ({
  tenantId,
  branchId,
  page = 1,
  limit = 20,
  search = "",
  employmentStatus = "",
  currentUserId,
  skipPermissionCheck = false, // Set to true for tenant-owner, admin, or system admin
}: {
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  page?: number;
  limit?: number;
  search?: string;
  employmentStatus?: string;
  currentUserId?: Types.ObjectId; // Current user making the request
  skipPermissionCheck?: boolean; // Skip permission checks (for tenant-owner, admin, system admin)
}) => {
  const skip = (page - 1) * limit;

  // Build query
  const query: any = {
    tenantId,
    branchId,
    isDeleted: false,
  };

  // Get all employees first to filter by employment status
  let allEmployees = await EmployeeModel.find(query)
    .populate("designation")
    .populate({
      path: "additionalDesignationIds",
      select: "name _id roleIds",
    })
    .populate({
      path: "employeeProfile",
      populate: {
        path: "userId",
      },
    })
    .populate("reportingto")
    .lean();

  // Filter by data access level if currentUserId is provided and permission check is not skipped
  // Skip permission check for: tenant-owner, admin, system admin
  if (currentUserId && !skipPermissionCheck) {
    // Check if user is system admin first - system admin has full access, skip all filtering
    let isSystemAdmin = false;
    try {
      const aggregatedRoles = await getAggregatedRoles(
        currentUserId,
        tenantId,
        branchId
      );
      isSystemAdmin = aggregatedRoles.isSystemAdmin;
      if (isSystemAdmin) {
        console.log(
          "✅ System Admin detected - skipping all data access level filtering"
        );
      }
    } catch (error) {
      // If getAggregatedRoles fails, user might not have employee record
      // In this case, they're not system admin (system admin should have employee record)
      // Proceed with filtering for non-system-admin users
      console.warn(
        "⚠️ Could not get aggregated roles for user, proceeding with filtering:",
        error
      );
      isSystemAdmin = false;
    }

    // System admin has full access - skip all data access level filtering
    // Continue to employment status and search filtering below (those still apply)
    if (!isSystemAdmin) {
      const userDataAccessLevel = await getCurrentUserDataAccessLevel(
        currentUserId,
        tenantId,
        branchId
      );

      // If user has no data access level (no read permission), filter out all employees
      if (userDataAccessLevel === null) {
        allEmployees = [];
      } else {
        // If not system admin, filter employees based on their level
        // Collect all unique role IDs from all employees
        const allRoleIds = new Set<string>();
        allEmployees.forEach((emp: any) => {
          // Get roles from primary designation
          if (
            emp.designation &&
            typeof emp.designation === "object" &&
            "roleIds" in emp.designation
          ) {
            const primaryDesignation = emp.designation as any;
            if (Array.isArray(primaryDesignation.roleIds)) {
              primaryDesignation.roleIds.forEach((roleId: string) => {
                if (roleId) allRoleIds.add(roleId.toLowerCase().trim());
              });
            }
          }
          // Get roles from additional designations
          if (Array.isArray(emp.additionalDesignationIds)) {
            for (const additionalDesignation of emp.additionalDesignationIds) {
              if (
                additionalDesignation &&
                typeof additionalDesignation === "object" &&
                "roleIds" in additionalDesignation
              ) {
                const designation = additionalDesignation as any;
                if (Array.isArray(designation.roleIds)) {
                  designation.roleIds.forEach((roleId: string) => {
                    if (roleId) allRoleIds.add(roleId.toLowerCase().trim());
                  });
                }
              }
            }
          }
          // Get direct additional roles
          if (Array.isArray(emp.additionalRoleIds)) {
            emp.additionalRoleIds.forEach((roleId: string) => {
              if (roleId) allRoleIds.add(roleId.toLowerCase().trim());
            });
          }
        });

        // Batch fetch all roles at once
        const roles = await Role.find({
          tenantId,
          branchId,
          roleId: { $in: Array.from(allRoleIds) },
          isDeleted: false,
        })
          .select("roleId level")
          .lean();

        // Create a map of roleId -> level for quick lookup
        const roleLevelMap = new Map<string, number>();
        roles.forEach((r: any) => {
          roleLevelMap.set(r.roleId.toLowerCase(), r.level || 1);
        });

        // Filter employees based on their level
        const filteredEmployees = [];
        for (const emp of allEmployees) {
          let maxEmployeeLevel = 1;
          const empRoleIds = new Set<string>();

          // Collect role IDs for this employee
          if (
            emp.designation &&
            typeof emp.designation === "object" &&
            "roleIds" in emp.designation
          ) {
            const primaryDesignation = emp.designation as any;
            if (Array.isArray(primaryDesignation.roleIds)) {
              primaryDesignation.roleIds.forEach((roleId: string) => {
                if (roleId) empRoleIds.add(roleId.toLowerCase().trim());
              });
            }
          }
          if (Array.isArray(emp.additionalDesignationIds)) {
            for (const additionalDesignation of emp.additionalDesignationIds) {
              if (
                additionalDesignation &&
                typeof additionalDesignation === "object" &&
                "roleIds" in additionalDesignation
              ) {
                const designation = additionalDesignation as any;
                if (Array.isArray(designation.roleIds)) {
                  designation.roleIds.forEach((roleId: string) => {
                    if (roleId) empRoleIds.add(roleId.toLowerCase().trim());
                  });
                }
              }
            }
          }
          if (Array.isArray(emp.additionalRoleIds)) {
            emp.additionalRoleIds.forEach((roleId: string) => {
              if (roleId) empRoleIds.add(roleId.toLowerCase().trim());
            });
          }

          // Get the highest level from employee's roles
          empRoleIds.forEach((roleId) => {
            const level = roleLevelMap.get(roleId) || 1;
            if (level > maxEmployeeLevel) {
              maxEmployeeLevel = level;
            }
          });

          // Show employee if their level is <= user's data access level
          if (maxEmployeeLevel <= userDataAccessLevel) {
            filteredEmployees.push(emp);
          }
        }
        allEmployees = filteredEmployees;
      }
    }
    // System admin sees all employees (no filtering needed)
  }

  // Filter by employment status if provided
  if (employmentStatus) {
    allEmployees = allEmployees.filter((emp: any) => {
      const status =
        emp.employeeFields?.employeedetails?.employmentstatus ||
        emp.employeeProfile?.employeedetails?.employmentstatus;
      if (employmentStatus === "Onboard") {
        return status === "Onboard";
      } else if (employmentStatus === "applicant") {
        // For applicants: exclude "Onboard" status
        return status !== "Onboard";
      } else {
        return status === employmentStatus;
      }
    });
  }

  // Filter by search term (name, email)
  if (search) {
    const searchLower = search.toLowerCase();
    allEmployees = allEmployees.filter((emp: any) => {
      const pd =
        emp.employeeFields?.personaldetails ||
        emp.employeeProfile?.personaldetails;
      const firstName = pd?.firstname?.toLowerCase() || "";
      const lastName = pd?.lastname?.toLowerCase() || "";
      const fullName = `${firstName} ${lastName}`.trim();
      const email = emp.employeeProfile?.userId?.email?.toLowerCase() || "";
      return (
        fullName.includes(searchLower) ||
        email.includes(searchLower) ||
        emp._id.toString().includes(searchLower)
      );
    });
  }

  // Get total count
  const total = allEmployees.length;

  // Apply pagination
  const paginatedEmployees = allEmployees.slice(skip, skip + limit);

  return {
    data: paginatedEmployees,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Update an employee record
 */
export const updateEmployee = async (
  id: Types.ObjectId,
  updates: Partial<EmployeeInput>
) => {
  return await EmployeeModel.findOneAndUpdate(
    { _id: id, isDeleted: false },
    updates,
    { new: true }
  );
};

/**
 * Soft delete an employee
 */
export const deleteEmployee = async (id: Types.ObjectId) => {
  return await EmployeeModel.findOneAndUpdate(
    { _id: id },
    { isDeleted: true, deletedAt: new Date() },
    { new: true }
  );
};

/**
 * Upsert employer-only additional fields for a given section.
 * - Ensures the section exists in config
 * - Ensures section isAdditional === true and employeerOnlyEditable === true
 * - Validates field keys exist (top-level or inner)
 * - Upserts values into employeerOnlyAdditionalFields
 */
export const upsertEmployeerOnlyFields = async ({
  employeeId,
  tenantId,
  branchId,
  sectionKey,
  items,
}: {
  employeeId: Types.ObjectId;
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  sectionKey: string;
  items: Array<{
    sectionKey: string;
    innerSectionKey?: string;
    fieldKey: string;
    value: any;
  }>;
}) => {
  const employee = await EmployeeModel.findOne({
    _id: employeeId,
    isDeleted: false,
  });

  if (!employee) {
    throw new Error("Employee not found");
  }

  // Multi-tenant safety: ensure caller is on same tenant/branch
  if (
    !employee.tenantId.equals(tenantId) ||
    !employee.branchId.equals(branchId)
  ) {
    const err: any = new Error("Forbidden");
    err.status = 403;
    throw err;
  }

  const config = await EmployeeFieldConfig.findOne({
    tenantId,
    branchId,
  }).lean();

  if (!config) {
    const err: any = new Error("Employee field config not found");
    err.status = 400;
    throw err;
  }

  const section = config.sections.find(
    (s: any) =>
      s.sectionKey === sectionKey &&
      s.isAdditional === true &&
      s.employeerOnlyEditable === true
  );

  if (!section) {
    const err: any = new Error(
      "Invalid section. Section must be additional and employer-only editable."
    );
    err.status = 400;
    throw err;
  }

  // Build allowed fields lookup
  const allowedTopFields = new Set<string>(
    (section.fields || []).map((f: any) => f.key)
  );
  const allowedInner: Record<string, Set<string>> = {};
  for (const inn of section.innerSections || []) {
    allowedInner[inn.sectionKey] = new Set(
      (inn.fields || []).map((f: any) => f.key)
    );
  }

  // Validate each item
  for (const it of items) {
    if (it.sectionKey !== sectionKey) {
      const err: any = new Error("All items must match the sectionKey");
      err.status = 400;
      throw err;
    }
    if (it.innerSectionKey) {
      const allowed = allowedInner[it.innerSectionKey];
      if (!allowed || !allowed.has(it.fieldKey)) {
        const err: any = new Error(
          `Invalid fieldKey "${it.fieldKey}" for innerSection "${it.innerSectionKey}"`
        );
        err.status = 400;
        throw err;
      }
    } else {
      if (!allowedTopFields.has(it.fieldKey)) {
        const err: any = new Error(`Invalid fieldKey "${it.fieldKey}"`);
        err.status = 400;
        throw err;
      }
    }
  }

  // Upsert
  const list: any[] = employee.employeerOnlyAdditionalFields || [];

  for (const it of items) {
    const idx = list.findIndex(
      (f) =>
        f.sectionKey === sectionKey &&
        (f.innerSectionKey || undefined) ===
          (it.innerSectionKey || undefined) &&
        f.fieldKey === it.fieldKey
    );

    if (idx >= 0) {
      list[idx].value = it.value;
    } else {
      list.push({
        sectionKey,
        innerSectionKey: it.innerSectionKey,
        fieldKey: it.fieldKey,
        value: it.value,
      });
    }
  }

  employee.employeerOnlyAdditionalFields = list;
  const saved = await employee.save();

  // Return only the section slice (or whole list if you prefer)
  const updatedSlice = saved.employeerOnlyAdditionalFields.filter(
    (f: any) => f.sectionKey === sectionKey
  );

  return {
    employeerOnlyAdditionalFields: saved.employeerOnlyAdditionalFields,
    section: sectionKey,
    updated: updatedSlice,
  };
};

// ----------------- helpers -----------------
const isTrulyEmpty = (v: any) =>
  v === null ||
  v === undefined ||
  (typeof v === "string" && v.trim() === "") ||
  (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);

type FieldMeta = {
  employerOnly: boolean;
  type?: string;
  isAdditional?: boolean;
};

// Build meta maps for structured sections (we also annotate isAdditional here,
// so the structured branch can "spill" additional fields into the correct store)
const buildStructuredMaps = (section: any) => {
  const top: Record<string, FieldMeta> = {};
  const inner: Record<string, Record<string, FieldMeta>> = {};

  for (const f of section.fields || []) {
    top[f.key] = {
      employerOnly: !!f.employeerOnlyEditable,
      type: f.type,
      isAdditional: !!f.isAdditional,
    };
  }
  for (const inn of section.innerSections || []) {
    inner[inn.sectionKey] = inner[inn.sectionKey] || {};
    for (const f of inn.fields || []) {
      inner[inn.sectionKey][f.key] = {
        employerOnly: !!f.employeerOnlyEditable,
        type: f.type,
        isAdditional: !!f.isAdditional,
      };
    }
  }
  return { top, inner };
};

// For validating the isAdditional branch (we only need employerOnly + isAdditional)
const buildAdditionalFieldMaps = (section: any) => {
  const top: Record<string, { employerOnly: boolean; isAdditional: boolean }> =
    {};
  const inner: Record<
    string,
    Record<string, { employerOnly: boolean; isAdditional: boolean }>
  > = {};

  for (const f of section.fields || []) {
    top[f.key] = {
      employerOnly: !!f.employeerOnlyEditable,
      isAdditional: !!f.isAdditional,
    };
  }
  for (const inn of section.innerSections || []) {
    inner[inn.sectionKey] = inner[inn.sectionKey] || {};
    for (const f of inn.fields || []) {
      inner[inn.sectionKey][f.key] = {
        employerOnly: !!f.employeerOnlyEditable,
        isAdditional: !!f.isAdditional,
      };
    }
  }
  return { top, inner };
};

const pruneUndefinedDeep = (obj: any) => {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (v === undefined) {
      delete obj[key];
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      pruneUndefinedDeep(v);
      if (Object.keys(v).length === 0) delete obj[key];
    }
  }
};

// Back-compat builder (used earlier), left here if other code still calls it
const buildFieldMaps = (section: any) => {
  const top: Record<string, { employerOnly: boolean }> = {};
  const inner: Record<string, Record<string, { employerOnly: boolean }>> = {};

  for (const f of section.fields || []) {
    top[f.key] = { employerOnly: !!f.employeerOnlyEditable };
  }
  for (const inn of section.innerSections || []) {
    inner[inn.sectionKey] = inner[inn.sectionKey] || {};
    for (const f of inn.fields || []) {
      inner[inn.sectionKey][f.key] = {
        employerOnly: !!f.employeerOnlyEditable,
      };
    }
  }
  return { top, inner };
};

// Optional extra keys per section (e.g., "addressFor" for address[])
const EXTRA_WHITELIST_BY_SECTION: Record<string, Set<string>> = {
  address: new Set<string>(["addressFor"]),
};

// Convert possibly-mongoose value to a plain JSON-friendly object
const toPlain = (v: any) => {
  if (!v) return v;
  if (typeof v.toObject === "function") return v.toObject({ depopulate: true });
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return v;
  }
};

/* ======================================================
   Main
   ====================================================== */

// helpers in the same service file (or wherever normalizeForField is defined)
// function toDateOrUndefined(v: any): Date | undefined {
//   if (!v) return undefined;
//   const d = new Date(v);
//   return isNaN(d.getTime()) ? undefined : d;
// }

// ----------------------------------------------------NEW HERE-----------------------------------------

// export const upsertEmployeeFields = async ({
//   employeeId,
//   tenantId,
//   branchId,
//   sectionKey,
//   isAdditional,
//   data,
//   items,
// }: {
//   employeeId: Types.ObjectId;
//   tenantId: Types.ObjectId;
//   branchId: Types.ObjectId;
//   sectionKey: string;
//   isAdditional: boolean;
//   data?: Record<string, any> | any[];
//   items?: Array<{
//     sectionKey: string;
//     innerSectionKey?: string;
//     fieldKey: string;
//     value: any;
//     isShowInProfile?: boolean;
//   }>;
// }) => {
//   const employee = await EmployeeModel.findOne({
//     _id: employeeId,
//     isDeleted: false,
//   });

//   if (!employee) {
//     const err: any = new Error("Employee not found");
//     err.status = 404;
//     throw err;
//   }

//   // multi-tenant guard
//   if (
//     !employee.tenantId.equals(tenantId) ||
//     !employee.branchId.equals(branchId)
//   ) {
//     const err: any = new Error("Forbidden");
//     err.status = 403;
//     throw err;
//   }

//   const config = await EmployeeFieldConfig.findOne({
//     tenantId,
//     branchId,
//   }).lean();
//   if (!config) {
//     const err: any = new Error("Employee field config not found");
//     err.status = 400;
//     throw err;
//   }

//   // ✅ Find by sectionKey ONLY (per-field isAdditional allowed in any section)
//   const cfgSection = (config.sections || []).find(
//     (s: any) => s.sectionKey === sectionKey
//   );
//   if (!cfgSection) {
//     const err: any = new Error("Invalid sectionKey");
//     err.status = 400;
//     throw err;
//   }

//   // Ensure containers
//   employee.employeeFields = employee.employeeFields || {};
//   employee.employeeFields.additionalFields =
//     employee.employeeFields.additionalFields || [];
//   employee.employeerOnlyAdditionalFields =
//     employee.employeerOnlyAdditionalFields || [];

//   /* =======================
//      CASE A: Additional fields (items[])
//      ======================= */
//   if (isAdditional) {
//     // Enforce that every item corresponds to a field flagged isAdditional in config
//     const { top, inner } = buildAdditionalFieldMaps(cfgSection);
//     const sectionEmployerOnly = !!cfgSection.employeerOnlyEditable;

//     const efList = employee.employeeFields.additionalFields as any[];
//     const eoList = employee.employeerOnlyAdditionalFields as any[];

//     const metaOf = (it: { innerSectionKey?: string; fieldKey: string }) =>
//       it.innerSectionKey
//         ? inner[it.innerSectionKey!]?.[it.fieldKey]
//         : top[it.fieldKey];

//     const findIdx = (
//       list: any[],
//       it: { innerSectionKey?: string; fieldKey: string }
//     ) =>
//       list.findIndex(
//         (f) =>
//           f.sectionKey === sectionKey &&
//           (f.innerSectionKey || undefined) ===
//             (it.innerSectionKey || undefined) &&
//           f.fieldKey === it.fieldKey
//       );

//     for (const it of items || []) {
//       if (it.sectionKey !== sectionKey) {
//         const err: any = new Error("All items must match the sectionKey");
//         err.status = 400;
//         throw err;
//       }

//       const meta = metaOf(it);
//       if (!meta) {
//         const err: any = new Error(
//           `Invalid fieldKey "${it.fieldKey}" for section "${sectionKey}"` +
//             (it.innerSectionKey ? ` innerSection "${it.innerSectionKey}"` : "")
//         );
//         err.status = 400;
//         throw err;
//       }

//       // ✅ Only allow fields declared as additional in config
//       if (!meta.isAdditional) {
//         const err: any = new Error(
//           `Field "${it.fieldKey}" is not additional in config`
//         );
//         err.status = 400;
//         throw err;
//       }

//       // Decide destination:
//       // - section marked employer-only -> always employer-only
//       // - otherwise per-field employerOnly
//       const toEmployerOnly = sectionEmployerOnly || !!meta.employerOnly;

//       // DELETE semantics for additional: null/undefined/"" => remove
//       const isDelete =
//         it.value === null ||
//         it.value === undefined ||
//         (typeof it.value === "string" && it.value.trim() === "");

//       if (toEmployerOnly) {
//         const idx = findIdx(eoList, it);
//         if (isDelete) {
//           if (idx >= 0) eoList.splice(idx, 1);
//         } else if (idx >= 0) {
//           eoList[idx].value = it.value;
//         } else {
//           eoList.push({
//             sectionKey,
//             innerSectionKey: it.innerSectionKey,
//             fieldKey: it.fieldKey,
//             value: it.value,
//           });
//         }
//         // ensure it never lingers in the normal add list
//         const nIdx = findIdx(efList, it);
//         if (nIdx >= 0) efList.splice(nIdx, 1);
//       } else {
//         const idx = findIdx(efList, it);
//         if (isDelete) {
//           if (idx >= 0) efList.splice(idx, 1);
//         } else if (idx >= 0) {
//           efList[idx].value = it.value;
//           if (typeof it.isShowInProfile === "boolean") {
//             efList[idx].isShowInProfile = it.isShowInProfile;
//           }
//         } else {
//           efList.push({
//             sectionKey,
//             innerSectionKey: it.innerSectionKey,
//             fieldKey: it.fieldKey,
//             value: it.value,
//             isShowInProfile: !!it.isShowInProfile,
//           });
//         }
//         // ensure it never lingers in employer-only list
//         const eIdx = findIdx(eoList, it);
//         if (eIdx >= 0) eoList.splice(eIdx, 1);
//       }
//     }

//     employee.markModified("employeeFields.additionalFields");
//     employee.markModified("employeerOnlyAdditionalFields");

//     const saved = await employee.save();

//     return {
//       section: sectionKey,
//       isAdditional: true,
//       employeeFields: {
//         additionalFields: (saved.employeeFields.additionalFields || [])
//           .filter((f: any) => f.sectionKey === sectionKey)
//           .map(toPlain),
//       },
//       employeerOnlyAdditionalFields: (saved.employeerOnlyAdditionalFields || [])
//         .filter((f: any) => f.sectionKey === sectionKey)
//         .map(toPlain),
//     };
//   }

//   /* ==========================================
//      CASE B: Structured sections (NOT additional)
//      ========================================== */
//   const { top, inner } = buildStructuredMaps(cfgSection);
//   const sectionEmployerOnly = !!cfgSection.employeerOnlyEditable;

//   // -------- Array-shaped section (e.g., address[]) --------
//   if (Array.isArray(data)) {
//     const allowed = new Set<string>(Object.keys(top));
//     const extra = EXTRA_WHITELIST_BY_SECTION[sectionKey] || new Set<string>();

//     // Validate keys across rows
//     const submitted = new Set<string>();
//     for (const row of data) {
//       if (row && typeof row === "object" && !Array.isArray(row)) {
//         for (const k of Object.keys(row)) {
//           if (k !== "_id" && k !== "id") submitted.add(k);
//         }
//       }
//     }
//     const invalid = [...submitted].filter(
//       (k) => !allowed.has(k) && !extra.has(k)
//     );
//     if (invalid.length) {
//       const err: any = new Error(
//         `Invalid field(s) for section "${sectionKey}": ${invalid.join(", ")}`
//       );
//       err.status = 400;
//       throw err;
//     }

//     // Sanitize + normalize each row to POJO
//     const sanitized = (data as any[])
//       .map((row) => {
//         const out: Record<string, any> = {};
//         if (!row || typeof row !== "object" || Array.isArray(row)) return out;

//         for (const [k, raw] of Object.entries(row)) {
//           if (k === "_id" || k === "id") continue;
//           if (!allowed.has(k) && !extra.has(k)) continue;
//           const meta = top[k]; // undefined for extra keys (fine)
//           const v = normalizeForField(meta, raw);
//           if (v !== undefined) out[k] = v;
//         }
//         return out;
//       })
//       .filter((o) => Object.keys(o).length > 0);

//     (employee.employeeFields as any)[sectionKey] = sanitized;
//     employee.markModified(`employeeFields.${sectionKey}`);

//     const saved = await employee.save();

//     return {
//       section: sectionKey,
//       isAdditional: false,
//       employeeFields: {
//         [sectionKey]: toPlain((saved.employeeFields as any)[sectionKey]),
//       },
//       employeerOnlyAdditionalFields: (saved.employeerOnlyAdditionalFields || [])
//         .filter((f: any) => f.sectionKey === sectionKey)
//         .map(toPlain),
//     };
//   }

//   // -------- Object-shaped section (e.g., personaldetails, documents) --------
//   const incoming = (data || {}) as Record<string, any>;
//   const accepted: Record<string, any> = {};
//   const spillToAdditional: any[] = []; // NEW: for misrouted additional fields
//   const spillToEmployerOnly: any[] = [];
//   const unknownKeys: string[] = [];

//   for (const [k, raw] of Object.entries(incoming)) {
//     // Top-level field
//     if (top[k]) {
//       const meta = top[k];
//       const v = normalizeForField(meta, raw);
//       if (v === undefined) continue;

//       if (meta.isAdditional) {
//         // Additional field mistakenly sent in structured payload -> spill
//         const toEO = sectionEmployerOnly || !!meta.employerOnly;
//         (toEO ? spillToEmployerOnly : spillToAdditional).push({
//           sectionKey,
//           fieldKey: k,
//           value: v,
//         });
//       } else if (meta.employerOnly) {
//         spillToEmployerOnly.push({ sectionKey, fieldKey: k, value: v });
//       } else {
//         accepted[k] = v;
//       }
//       continue;
//     }

//     // Inner-section object
//     if (inner[k] && raw && typeof raw === "object" && !Array.isArray(raw)) {
//       const acceptedInner: Record<string, any> = {};
//       for (const [innerFieldKey, innerRaw] of Object.entries(raw)) {
//         const meta = inner[k][innerFieldKey];
//         if (!meta) {
//           unknownKeys.push(`${k}.${innerFieldKey}`);
//           continue;
//         }
//         const v = normalizeForField(meta, innerRaw);
//         if (v === undefined) continue;

//         if (meta.isAdditional) {
//           const toEO = sectionEmployerOnly || !!meta.employerOnly;
//           (toEO ? spillToEmployerOnly : spillToAdditional).push({
//             sectionKey,
//             innerSectionKey: k,
//             fieldKey: innerFieldKey,
//             value: v,
//           });
//         } else if (meta.employerOnly) {
//           spillToEmployerOnly.push({
//             sectionKey,
//             innerSectionKey: k,
//             fieldKey: innerFieldKey,
//             value: v,
//           });
//         } else {
//           acceptedInner[innerFieldKey] = v;
//         }
//       }
//       if (Object.keys(acceptedInner).length > 0) {
//         // Merge with any existing group (convert existing to plain first)
//         const prevGroup =
//           toPlain(employee.employeeFields?.[sectionKey]?.[k]) || {};
//         accepted[k] = { ...prevGroup, ...acceptedInner };
//       }
//       continue;
//     }

//     // Unknown path
//     unknownKeys.push(k);
//   }

//   if (unknownKeys.length > 0) {
//     const err: any = new Error(
//       `Invalid field(s) for section "${sectionKey}": ${unknownKeys.join(", ")}`
//     );
//     err.status = 400;
//     throw err;
//   }

//   // Merge accepted with existing section, as POJO
//   const currentValue = (employee.employeeFields as any)[sectionKey];
//   const currentPlain = toPlain(currentValue) || {};
//   const merged = { ...currentPlain, ...accepted };
//   pruneUndefinedDeep(merged);

//   (employee.employeeFields as any)[sectionKey] = merged;
//   employee.markModified(`employeeFields.${sectionKey}`);

//   // Upsert employer-only spillover
//   if (spillToEmployerOnly.length) {
//     const eoList = employee.employeerOnlyAdditionalFields as any[];
//     for (const it of spillToEmployerOnly) {
//       const idx = eoList.findIndex(
//         (f: any) =>
//           f.sectionKey === sectionKey &&
//           (f.innerSectionKey || undefined) ===
//             (it.innerSectionKey || undefined) &&
//           f.fieldKey === it.fieldKey
//       );
//       if (idx >= 0) eoList[idx].value = it.value;
//       else eoList.push(it);
//     }
//     employee.markModified("employeerOnlyAdditionalFields");
//   }

//   // Upsert additional spillover
//   if (spillToAdditional.length) {
//     const addList = employee.employeeFields.additionalFields as any[];
//     for (const it of spillToAdditional) {
//       const idx = addList.findIndex(
//         (f: any) =>
//           f.sectionKey === sectionKey &&
//           (f.innerSectionKey || undefined) ===
//             (it.innerSectionKey || undefined) &&
//           f.fieldKey === it.fieldKey
//       );
//       if (idx >= 0) {
//         addList[idx].value = it.value;
//       } else {
//         addList.push({
//           ...it,
//           isShowInProfile: !!it.isShowInProfile,
//         });
//       }
//     }
//     employee.markModified("employeeFields.additionalFields");
//   }

//   const saved = await employee.save();

//   // Always return a plain JSON-friendly section
//   const outSection =
//     saved.employeeFields?.[sectionKey] &&
//     typeof (saved.employeeFields as any)[sectionKey].toObject === "function"
//       ? (saved.employeeFields as any)[sectionKey].toObject()
//       : toPlain((saved.employeeFields as any)[sectionKey]);

//   return {
//     section: sectionKey,
//     isAdditional: false,
//     employeeFields: { [sectionKey]: outSection },
//     employeerOnlyAdditionalFields: (saved.employeerOnlyAdditionalFields || [])
//       .filter((f: any) => f.sectionKey === sectionKey)
//       .map(toPlain),
//   };
// };

export const upsertEmployeeFields = async ({
  employeeId,
  tenantId,
  branchId,
  sectionKey,
  isAdditional,
  data,
  items,
  audit, // <-- NEW: audit context
}: {
  employeeId: Types.ObjectId;
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  sectionKey: string;
  isAdditional: boolean;
  data?: Record<string, any> | any[];
  items?: Array<{
    sectionKey: string;
    innerSectionKey?: string;
    fieldKey: string;
    value: any;
    isShowInProfile?: boolean;
  }>;
  audit?: {
    actorUserId?: string | Types.ObjectId;
    actorEmail?: string;
    actor_name?: string;
    route?: string;
    method?: string;
    ip?: string;
    ua?: string;
  };
}) => {
  // -----------------------------
  // Boilerplate validation (kept)
  // -----------------------------
  const employee = await EmployeeModel.findOne({
    _id: employeeId,
    isDeleted: false,
  });

  if (!employee) {
    const err: any = new Error("Employee not found");
    err.status = 404;
    throw err;
  }

  if (
    !employee.tenantId.equals(tenantId) ||
    !employee.branchId.equals(branchId)
  ) {
    const err: any = new Error("Forbidden");
    err.status = 403;
    throw err;
  }

  const config = await EmployeeFieldConfig.findOne({
    tenantId,
    branchId,
  }).lean();
  if (!config) {
    const err: any = new Error("Employee field config not found");
    err.status = 400;
    throw err;
  }

  const cfgSection = (config.sections || []).find(
    (s: any) => s.sectionKey === sectionKey
  );
  if (!cfgSection) {
    const err: any = new Error("Invalid sectionKey");
    err.status = 400;
    throw err;
  }

  employee.employeeFields = employee.employeeFields || {};
  employee.employeeFields.additionalFields =
    employee.employeeFields.additionalFields || [];
  employee.employeerOnlyAdditionalFields =
    employee.employeerOnlyAdditionalFields || [];

  // --------------------------------------------------
  // AUDIT helpers (same spirit as self-update version)
  // --------------------------------------------------
  type AuditChange = { path: string; old: any; new: any };
  const auditChanges: AuditChange[] = [];

  const recordChange = (
    meta: any,
    path: string,
    oldValRaw: any,
    newValRaw: any
  ) => {
    // meta carries type hints (date, number, etc.) for normalization
    if (!isEqualForAudit(meta, oldValRaw, newValRaw)) {
      auditChanges.push({
        path,
        old: normalizeForAuditValue(meta, oldValRaw),
        new: normalizeForAuditValue(meta, newValRaw),
      });
    }
  };

  /**
   * Group audit changes by type (document uploads vs other changes)
   */
  const groupChangesByType = (changes: AuditChange[]) => {
    const documentChanges: AuditChange[] = [];
    const otherChanges: AuditChange[] = [];
    const processedDocumentPaths = new Set<string>();

    for (const change of changes) {
      const isDocumentField = isDocumentFieldChange(change.path);

      if (isDocumentField) {
        // Extract the base document path (without fileId, key, etc.)
        const basePath = getDocumentBasePath(change.path);

        // Only process this document path once
        if (!processedDocumentPaths.has(basePath)) {
          processedDocumentPaths.add(basePath);
          documentChanges.push({
            path: basePath,
            old: change.old,
            new: change.new,
          });
        }
      } else {
        otherChanges.push(change);
      }
    }

    return { documentChanges, otherChanges };
  };

  /**
   * Check if a field change is related to document upload
   */
  const isDocumentFieldChange = (fieldPath: string): boolean => {
    const documentFields = ["fileId", "key", "expiryDate", "issuingDate"];
    const pathParts = fieldPath.split(".");

    return (
      pathParts.some((part) => documentFields.includes(part)) ||
      fieldPath.includes("documents.") ||
      (fieldPath.includes("additionalFields") &&
        pathParts.some((part) => documentFields.includes(part)))
    );
  };

  /**
   * Get the base document path without technical fields
   */
  const getDocumentBasePath = (fieldPath: string): string => {
    const pathParts = fieldPath.split(".");
    const documentFields = ["fileId", "key", "expiryDate", "issuingDate"];

    // Remove technical fields from the end
    while (
      pathParts.length > 0 &&
      documentFields.includes(pathParts[pathParts.length - 1])
    ) {
      pathParts.pop();
    }

    // Ensure we have at least the base path
    if (pathParts.length === 0) {
      return fieldPath; // fallback to original path
    }

    return pathParts.join(".");
  };

  // BEFORE snapshots
  const beforeSectionPlain = toPlain(
    (employee.employeeFields as any)[sectionKey]
  );
  const beforeAdditionalPlain = (toPlain(
    employee.employeeFields.additionalFields
  ) || []) as Array<{
    sectionKey: string;
    innerSectionKey?: string;
    fieldKey: string;
    value: any;
    isShowInProfile?: boolean;
  }>;
  const beforeEmployerOnlyPlain = (toPlain(
    employee.employeerOnlyAdditionalFields
  ) || []) as Array<{
    sectionKey: string;
    innerSectionKey?: string;
    fieldKey: string;
    value: any;
  }>;

  /* =======================
     CASE A: Additional (items[])
     ======================= */
  if (isAdditional) {
    const { top, inner } = buildAdditionalFieldMaps(cfgSection);
    const sectionEmployerOnly = !!cfgSection.employeerOnlyEditable;

    const efList = employee.employeeFields.additionalFields as any[];
    const eoList = employee.employeerOnlyAdditionalFields as any[];

    const metaOf = (it: { innerSectionKey?: string; fieldKey: string }) =>
      it.innerSectionKey
        ? inner[it.innerSectionKey!]?.[it.fieldKey]
        : top[it.fieldKey];

    const findIdx = (
      list: any[],
      it: { innerSectionKey?: string; fieldKey: string }
    ) =>
      list.findIndex(
        (f) =>
          f.sectionKey === sectionKey &&
          (f.innerSectionKey || undefined) ===
            (it.innerSectionKey || undefined) &&
          f.fieldKey === it.fieldKey
      );

    for (const it of items || []) {
      // Validate
      if (it.sectionKey !== sectionKey) {
        const err: any = new Error("All items must match the sectionKey");
        err.status = 400;
        throw err;
      }
      const meta = metaOf(it);
      if (!meta) {
        const err: any = new Error(
          `Invalid fieldKey "${it.fieldKey}" for section "${sectionKey}"` +
            (it.innerSectionKey ? ` innerSection "${it.innerSectionKey}"` : "")
        );
        err.status = 400;
        throw err;
      }
      if (!meta.isAdditional) {
        const err: any = new Error(
          `Field "${it.fieldKey}" is not additional in config`
        );
        err.status = 400;
        throw err;
      }

      const toEmployerOnly = sectionEmployerOnly || !!meta.employerOnly;
      const isDelete =
        it.value === null ||
        it.value === undefined ||
        (typeof it.value === "string" && it.value.trim() === "");

      // BEFORE value (from appropriate BEFORE snapshot)
      const beforeList = toEmployerOnly
        ? beforeEmployerOnlyPlain
        : beforeAdditionalPlain;
      const oldEntry =
        (beforeList || []).find(
          (f) =>
            f.sectionKey === sectionKey &&
            (f.innerSectionKey || undefined) ===
              (it.innerSectionKey || undefined) &&
            f.fieldKey === it.fieldKey
        ) || null;
      const oldValRaw = oldEntry ? oldEntry.value : undefined;

      // Apply mutation to the right destination
      const list = toEmployerOnly ? eoList : efList;
      const otherList = toEmployerOnly ? efList : eoList;
      const idx = findIdx(list, it);

      if (isDelete) {
        if (idx >= 0) list.splice(idx, 1);
      } else if (idx >= 0) {
        list[idx].value = it.value;
        if (!toEmployerOnly && typeof it.isShowInProfile === "boolean") {
          list[idx].isShowInProfile = it.isShowInProfile;
        }
      } else {
        list.push({
          sectionKey,
          innerSectionKey: it.innerSectionKey,
          fieldKey: it.fieldKey,
          value: it.value,
          ...(toEmployerOnly ? {} : { isShowInProfile: !!it.isShowInProfile }),
        });
      }

      // Ensure it doesn't linger in the opposite list
      const otherIdx = findIdx(otherList, it);
      if (otherIdx >= 0) otherList.splice(otherIdx, 1);

      // Audit diff
      const newValRaw = isDelete ? null : it.value;
      recordChange(
        meta,
        buildAdditionalPath(sectionKey, it.innerSectionKey, it.fieldKey),
        oldValRaw,
        newValRaw
      );
    }

    employee.markModified("employeeFields.additionalFields");
    employee.markModified("employeerOnlyAdditionalFields");

    const saved = await employee.save();

    // Get employee's actual user ID and name for audit logging
    const empProfile = await EmployeeProfile.findById(
      saved.employeeProfile
    ).select("userId");
    const employeeUserId = empProfile?.userId?.toString();
    const employeeName =
      String(
        (saved.employeeFields?.personaldetails?.firstname || "") +
          " " +
          (saved.employeeFields?.personaldetails?.lastname || "")
      ).trim() || "Unknown Employee";

    console.log(employeeName, "employeeName");
    console.log(employeeUserId, "employeeUserId");

    // 🔎 Audit log
    void logUpdate({
      tenantId,
      branchId,
      subjectUserId: employeeUserId, // Actual employee user ID
      subjectUserName: employeeName, // Employee's name from employee model

      aggregateType: "Employee",
      aggregateId: saved._id,
      sectionKey,
      isAdditional: true,
      changes: auditChanges,
      audit,
    });

    return {
      section: sectionKey,
      isAdditional: true,
      employeeFields: {
        additionalFields: (saved.employeeFields.additionalFields || [])
          .filter((f: any) => f.sectionKey === sectionKey)
          .map(toPlain),
      },
      employeerOnlyAdditionalFields: (saved.employeerOnlyAdditionalFields || [])
        .filter((f: any) => f.sectionKey === sectionKey)
        .map(toPlain),
    };
  }

  /* ==========================================
     CASE B: Structured sections (NOT additional)
     ========================================== */
  const { top, inner } = buildStructuredMaps(cfgSection);
  const sectionEmployerOnly = !!cfgSection.employeerOnlyEditable;

  // -------- Array-shaped (e.g., address[]) --------
  if (Array.isArray(data)) {
    // Safety check: ensure top is an object
    if (!top || typeof top !== "object") {
      const err: any = new Error(
        `Invalid configuration for section "${sectionKey}": fields not found`
      );
      err.status = 400;
      throw err;
    }
    const allowed = new Set<string>(Object.keys(top));
    const extra = EXTRA_WHITELIST_BY_SECTION[sectionKey] || new Set<string>();

    // Validate keys
    const submitted = new Set<string>();
    for (const row of data) {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        for (const k of Object.keys(row)) {
          if (k !== "_id" && k !== "id") submitted.add(k);
        }
      }
    }
    const invalid = [...submitted].filter(
      (k) => !allowed.has(k) && !extra.has(k)
    );
    if (invalid.length) {
      const err: any = new Error(
        `Invalid field(s) for section "${sectionKey}": ${invalid.join(", ")}`
      );
      err.status = 400;
      throw err;
    }

    // BEFORE comparable (date/number normalized)
    const beforeArray = Array.isArray(beforeSectionPlain)
      ? beforeSectionPlain
      : toPlain((employee.employeeFields as any)[sectionKey]) || [];
    // Ensure top is an object before passing to normalizeArrayOfObjectsForAudit
    const safeTop = top && typeof top === "object" ? top : {};
    const beforeComparable = normalizeArrayOfObjectsForAudit(
      beforeArray,
      safeTop
    );

    // Sanitize + normalize rows
    const sanitized = (data as any[])
      .map((row) => {
        const out: Record<string, any> = {};
        // More explicit null check (null has typeof "object" in JavaScript)
        if (
          row === null ||
          row === undefined ||
          typeof row !== "object" ||
          Array.isArray(row)
        ) {
          return out;
        }
        // Safety check: ensure row is a plain object before using Object.entries
        try {
          for (const [k, raw] of Object.entries(row)) {
            if (k === "_id" || k === "id") continue;
            if (!allowed.has(k) && !extra.has(k)) continue;
            // Use safeTop instead of top to ensure it's always an object
            const meta = safeTop[k];
            const v = normalizeForField(meta, raw);
            if (v !== undefined) out[k] = v;
          }
        } catch (error) {
          console.error(`Error processing row in ${sectionKey}:`, error, row);
          return out;
        }
        return out;
      })
      .filter((o) => Object.keys(o).length > 0);

    (employee.employeeFields as any)[sectionKey] = sanitized;
    employee.markModified(`employeeFields.${sectionKey}`);

    const saved = await employee.save();

    // AFTER comparable & record section-level change (single path)
    const newComparable = normalizeArrayOfObjectsForAudit(sanitized, safeTop);
    const sectionMeta = { type: "array", fields: top }; // lightweight meta container
    recordChange(sectionMeta, sectionKey, beforeComparable, newComparable);

    const employeeName =
      String(
        (saved.employeeFields?.personaldetails?.firstname || "") +
          " " +
          (saved.employeeFields?.personaldetails?.lastname || "")
      ).trim() || "Unknown Employee";

    console.log(employeeName, "employeeName");

    // 🔎 Audit log
    void logUpdate({
      tenantId,
      branchId,
      subjectUserId: String(saved.employeeProfile),
      subjectUserName: employeeName,
      // String(
      //   (saved.employeeFields?.personaldetails?.firstname || "") +
      //     " " +
      //     (saved.employeeFields?.personaldetails?.lastname || "")
      // ).trim(),
      aggregateType: "Employee",
      aggregateId: saved._id,
      sectionKey,
      isAdditional: false,
      changes: auditChanges,
      audit,
    });

    // 🔔 Create notification for employer about employee data change
    try {
      if (auditChanges.length > 0) {
        // Get employee's actual user ID for notification
        const empProfile = await EmployeeProfile.findById(
          saved.employeeProfile
        ).select("userId");
        const employeeUserId = empProfile?.userId?.toString();

        // Group changes by document uploads to avoid multiple notifications
        const { documentChanges, otherChanges } =
          groupChangesByType(auditChanges);

        // Create notifications for document uploads (one per document)
        for (const docChange of documentChanges) {
          await createEmployeeDataChangeNotification({
            tenantId,
            branchId,
            employeeId: saved._id,
            employeeName,
            fieldChanged: docChange.path,
            oldValue: docChange.old,
            newValue: docChange.new,
            actorUserId: audit?.actorUserId,
            actorName: audit?.actor_name,
          });
        }

        // Create notifications for other changes
        for (const change of otherChanges) {
          await createEmployeeDataChangeNotification({
            tenantId,
            branchId,
            employeeId: saved._id,
            employeeName,
            fieldChanged: change.path,
            oldValue: change.old,
            newValue: change.new,
            actorUserId: audit?.actorUserId,
            actorName: audit?.actor_name,
          });
        }
      }
    } catch (notificationError) {
      console.error("Failed to create notification:", notificationError);
      // Don't throw - notification failure shouldn't break the main operation
    }

    return {
      section: sectionKey,
      isAdditional: false,
      employeeFields: {
        [sectionKey]: toPlain((saved.employeeFields as any)[sectionKey]),
      },
      employeerOnlyAdditionalFields: (saved.employeerOnlyAdditionalFields || [])
        .filter((f: any) => f.sectionKey === sectionKey)
        .map(toPlain),
    };
  }

  // -------- Object-shaped (e.g., personaldetails, documents) --------
  const incoming = (data || {}) as Record<string, any>;
  const accepted: Record<string, any> = {};
  const spillToAdditional: any[] = [];
  const spillToEmployerOnly: any[] = [];
  const unknownKeys: string[] = [];

  for (const [k, raw] of Object.entries(incoming)) {
    if (top[k]) {
      const meta = top[k];
      const v = normalizeForField(meta, raw);
      if (v === undefined) continue;

      if (meta.isAdditional) {
        const toEO = sectionEmployerOnly || !!meta.employerOnly;
        (toEO ? spillToEmployerOnly : spillToAdditional).push({
          sectionKey,
          fieldKey: k,
          value: v,
        });
      } else if (meta.employerOnly) {
        spillToEmployerOnly.push({ sectionKey, fieldKey: k, value: v });
      } else {
        accepted[k] = v;
      }
      continue;
    }

    if (inner[k] && raw && typeof raw === "object" && !Array.isArray(raw)) {
      const acceptedInner: Record<string, any> = {};
      for (const [innerFieldKey, innerRaw] of Object.entries(raw)) {
        const meta = inner[k][innerFieldKey];
        if (!meta) {
          unknownKeys.push(`${k}.${innerFieldKey}`);
          continue;
        }
        const v = normalizeForField(meta, innerRaw);
        if (v === undefined) continue;

        if (meta.isAdditional) {
          const toEO = sectionEmployerOnly || !!meta.employerOnly;
          (toEO ? spillToEmployerOnly : spillToAdditional).push({
            sectionKey,
            innerSectionKey: k,
            fieldKey: innerFieldKey,
            value: v,
          });
        } else if (meta.employerOnly) {
          spillToEmployerOnly.push({
            sectionKey,
            innerSectionKey: k,
            fieldKey: innerFieldKey,
            value: v,
          });
        } else {
          acceptedInner[innerFieldKey] = v;
        }
      }
      if (Object.keys(acceptedInner).length > 0) {
        const prevGroup =
          toPlain(employee.employeeFields?.[sectionKey]?.[k]) || {};
        accepted[k] = { ...prevGroup, ...acceptedInner };
      }
      continue;
    }

    unknownKeys.push(k);
  }

  if (unknownKeys.length > 0) {
    const err: any = new Error(
      `Invalid field(s) for section "${sectionKey}": ${unknownKeys.join(", ")}`
    );
    err.status = 400;
    throw err;
  }

  // BEFORE object snapshot for per-field diffs
  const beforeObj = (beforeSectionPlain as any) || {};

  // Per-field diffs (top-level)
  for (const [k, v] of Object.entries(accepted)) {
    const meta = top[k];
    const oldVal = beforeObj ? beforeObj[k] : undefined;
    recordChange(meta, `${sectionKey}.${k}`, oldVal, v);
  }

  // Merge, save
  const currentValue = (employee.employeeFields as any)[sectionKey];
  const currentPlain = toPlain(currentValue) || {};
  const merged = { ...currentPlain, ...accepted };
  pruneUndefinedDeep(merged);

  (employee.employeeFields as any)[sectionKey] = merged;
  employee.markModified(`employeeFields.${sectionKey}`);

  // Spill → employer-only
  if (spillToEmployerOnly.length) {
    const eoList = employee.employeerOnlyAdditionalFields as any[];
    for (const it of spillToEmployerOnly) {
      const idx = eoList.findIndex(
        (f: any) =>
          f.sectionKey === sectionKey &&
          (f.innerSectionKey || undefined) ===
            (it.innerSectionKey || undefined) &&
          f.fieldKey === it.fieldKey
      );
      const meta = it.innerSectionKey?.length
        ? inner[it.innerSectionKey!]?.[it.fieldKey]
        : top[it.fieldKey];

      // BEFORE value (from BEFORE employer-only list)
      const oldEntry =
        (beforeEmployerOnlyPlain || []).find(
          (f) =>
            f.sectionKey === it.sectionKey &&
            (f.innerSectionKey || undefined) ===
              (it.innerSectionKey || undefined) &&
            f.fieldKey === it.fieldKey
        ) || null;
      const oldVal = oldEntry ? oldEntry.value : undefined;

      if (idx >= 0) eoList[idx].value = it.value;
      else eoList.push(it);

      recordChange(
        meta,
        buildAdditionalPath(sectionKey, it.innerSectionKey, it.fieldKey),
        oldVal,
        it.value
      );
    }
    employee.markModified("employeerOnlyAdditionalFields");
  }

  // Spill → additional
  if (spillToAdditional.length) {
    const addList = employee.employeeFields.additionalFields as any[];
    for (const it of spillToAdditional) {
      const idx = addList.findIndex(
        (f: any) =>
          f.sectionKey === sectionKey &&
          (f.innerSectionKey || undefined) ===
            (it.innerSectionKey || undefined) &&
          f.fieldKey === it.fieldKey
      );
      const meta = it.innerSectionKey?.length
        ? inner[it.innerSectionKey!]?.[it.fieldKey]
        : top[it.fieldKey];

      // BEFORE value (from BEFORE normal additional list)
      const oldEntry =
        (beforeAdditionalPlain || []).find(
          (f) =>
            f.sectionKey === it.sectionKey &&
            (f.innerSectionKey || undefined) ===
              (it.innerSectionKey || undefined) &&
            f.fieldKey === it.fieldKey
        ) || null;
      const oldVal = oldEntry ? oldEntry.value : undefined;

      if (idx >= 0) addList[idx].value = it.value;
      else
        addList.push({ ...it, isShowInProfile: !!(it as any).isShowInProfile });

      recordChange(
        meta,
        buildAdditionalPath(sectionKey, it.innerSectionKey, it.fieldKey),
        oldVal,
        it.value
      );
    }
    employee.markModified("employeeFields.additionalFields");
  }

  const saved = await employee.save();

  const employeeName =
    String(
      (saved.employeeFields?.personaldetails?.firstname || "") +
        " " +
        (saved.employeeFields?.personaldetails?.lastname || "")
    ).trim() || "Unknown Employee";

  console.log(employeeName, "employeeName");

  // 🔎 Final audit log
  void logUpdate({
    tenantId,
    branchId,
    subjectUserId: String(saved.employeeProfile),
    subjectUserName: employeeName,
    // String(
    //   (saved.employeeFields?.personaldetails?.firstname || "") +
    //     " " +
    //     (saved.employeeFields?.personaldetails?.lastname || "")
    // ).trim(),
    aggregateType: "Employee",
    aggregateId: saved._id,
    sectionKey,
    isAdditional: false,
    changes: auditChanges,
    audit,
  });

  // 🔔 Create notification for employer about employee data change
  try {
    if (auditChanges.length > 0) {
      // Get employee's actual user ID for notification
      const empProfile = await EmployeeProfile.findById(
        saved.employeeProfile
      ).select("userId");
      const employeeUserId = empProfile?.userId?.toString();

      // Helper functions for grouping changes
      const groupChangesByType = (changes: AuditChange[]) => {
        const documentChanges: AuditChange[] = [];
        const otherChanges: AuditChange[] = [];
        const processedDocumentPaths = new Set<string>();

        for (const change of changes) {
          const isDocumentField = isDocumentFieldChange(change.path);

          if (isDocumentField) {
            // Extract the base document path (without fileId, key, etc.)
            const basePath = getDocumentBasePath(change.path);

            // Only process this document path once
            if (!processedDocumentPaths.has(basePath)) {
              processedDocumentPaths.add(basePath);
              documentChanges.push({
                path: basePath,
                old: change.old,
                new: change.new,
              });
            }
          } else {
            otherChanges.push(change);
          }
        }

        return { documentChanges, otherChanges };
      };

      const isDocumentFieldChange = (fieldPath: string): boolean => {
        const documentFields = ["fileId", "key", "expiryDate", "issuingDate"];
        const pathParts = fieldPath.split(".");

        return (
          pathParts.some((part) => documentFields.includes(part)) ||
          fieldPath.includes("documents.") ||
          (fieldPath.includes("additionalFields") &&
            pathParts.some((part) => documentFields.includes(part)))
        );
      };

      const getDocumentBasePath = (fieldPath: string): string => {
        const pathParts = fieldPath.split(".");
        const documentFields = ["fileId", "key", "expiryDate", "issuingDate"];

        // Remove technical fields from the end
        while (
          pathParts.length > 0 &&
          documentFields.includes(pathParts[pathParts.length - 1])
        ) {
          pathParts.pop();
        }

        return pathParts.join(".");
      };

      // Group changes by document uploads to avoid multiple notifications
      const { documentChanges, otherChanges } =
        groupChangesByType(auditChanges);

      // Create notifications for document uploads (one per document)
      for (const docChange of documentChanges) {
        await createEmployeeDataChangeNotification({
          tenantId,
          branchId,
          employeeId: saved._id,
          employeeName,
          fieldChanged: docChange.path,
          oldValue: docChange.old,
          newValue: docChange.new,
          actorUserId: audit?.actorUserId,
          actorName: audit?.actor_name,
        });
      }

      // Create notifications for other changes
      for (const change of otherChanges) {
        await createEmployeeDataChangeNotification({
          tenantId,
          branchId,
          employeeId: saved._id,
          employeeName,
          fieldChanged: change.path,
          oldValue: change.old,
          newValue: change.new,
          actorUserId: audit?.actorUserId,
          actorName: audit?.actor_name,
        });
      }
    }
  } catch (notificationError) {
    console.error("Failed to create notification:", notificationError);
    // Don't throw - notification failure shouldn't break the main operation
  }

  const outSection =
    saved.employeeFields?.[sectionKey] &&
    typeof (saved.employeeFields as any)[sectionKey].toObject === "function"
      ? (saved.employeeFields as any)[sectionKey].toObject()
      : toPlain((saved.employeeFields as any)[sectionKey]);

  return {
    section: sectionKey,
    isAdditional: false,
    employeeFields: { [sectionKey]: outSection },
    employeerOnlyAdditionalFields: (saved.employeerOnlyAdditionalFields || [])
      .filter((f: any) => f.sectionKey === sectionKey)
      .map(toPlain),
  };
};

// ---------------------------------------------NEW HERE------------------------------------------------------
// -----------------------

/**
 * Small helpers to decide when a value is "meaningful" vs "empty"
 */

// function isMeaningfulPrimitive(v: any) {
//   if (v === null || v === undefined) return false;
//   if (typeof v === "string") return v.trim().length > 0;
//   if (typeof v === "number") return true; // allow 0
//   if (v instanceof Date) return !isNaN(v.getTime());
//   return true;
// }

// function isFileRefLike(obj: any) {
//   return (
//     obj &&
//     typeof obj === "object" &&
//     ("fileId" in obj ||
//       "key" in obj ||
//       "url" in obj ||
//       "expiryDate" in obj ||
//       "issuingDate" in obj)
//   );
// }

// function isMeaningfulFileRef(obj: any) {
//   return obj && typeof obj === "object" && (obj.fileId || obj.key || obj.url);
// }

// function isEmptyFileRef(obj: any) {
//   return !obj || !(obj.fileId || obj.key || obj.url);
// }

// function arrayHasMeaningful(arr: any[]) {
//   if (!Array.isArray(arr) || arr.length === 0) return false;
//   // consider meaningful if at least one item has at least one meaningful primitive or a non-empty fileRef
//   return arr.some((item) => {
//     if (!item || typeof item !== "object") return isMeaningfulPrimitive(item);
//     // object: check any prop
//     return Object.values(item).some((v) => {
//       if (isFileRefLike(v)) return isMeaningfulFileRef(v);
//       if (Array.isArray(v)) return arrayHasMeaningful(v);
//       if (v && typeof v === "object") {
//         return Object.values(v).some(isMeaningfulPrimitive);
//       }
//       return isMeaningfulPrimitive(v);
//     });
//   });
// }

/** ---------- helpers: "empty-like" detection ---------- **/
function isFileRefLike(obj: any) {
  return (
    obj &&
    typeof obj === "object" &&
    ("fileId" in obj ||
      "key" in obj ||
      "url" in obj ||
      "expiryDate" in obj ||
      "issuingDate" in obj)
  );
}
function isMeaningfulFileRef(obj: any) {
  return obj && typeof obj === "object" && (obj.fileId || obj.key || obj.url);
}
function isEmptyFileRef(obj: any) {
  return !obj || !(obj.fileId || obj.key || obj.url);
}

/** Treat {}, [], [ {} ], { a: "" } as empty-like */
function isEmptyLike(target: any, visited = new WeakSet()): boolean {
  if (target === null || target === undefined) return true;
  if (typeof target === "string") return target.trim().length === 0;
  if (isFileRefLike(target)) return isEmptyFileRef(target);
  if (target instanceof Date) return false;

  if (Array.isArray(target)) {
    if (target.length === 0) return true;
    // Check for circular reference
    if (visited.has(target)) return false;
    visited.add(target);
    // e.g., [ {} ] or [ { street: "" } ] -> empty-like
    const result = target.every((item) => isEmptyLike(item, visited));
    visited.delete(target);
    return result;
  }

  if (typeof target === "object") {
    const keys = Object.keys(target);
    if (keys.length === 0) return true;
    // Check for circular reference
    if (visited.has(target)) return false;
    visited.add(target);
    // every value empty-like -> object empty-like
    const result = keys.every((k) => isEmptyLike((target as any)[k], visited));
    visited.delete(target);
    return result;
  }

  // numbers/booleans treated as not empty
  return false;
}

function hasMeaningful(val: any): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "string") return val.trim().length > 0;
  if (typeof val === "number") return true;
  if (typeof val === "boolean") return true;
  if (val instanceof Date) return true;
  if (Array.isArray(val)) return val.some((v) => hasMeaningful(v));
  if (isFileRefLike(val)) return isMeaningfulFileRef(val);
  if (typeof val === "object") {
    const keys = Object.keys(val);
    if (keys.length === 0) return false;
    return keys.some((k) => hasMeaningful((val as any)[k]));
  }
  return true;
}

/** Fill dest[key] if it's empty-like and src[key] is meaningful */
function fillIfEmpty<T extends object>(
  destParent: any,
  key: keyof T,
  srcParent: any
): boolean {
  const srcVal = srcParent?.[key as string];
  if (!hasMeaningful(srcVal)) return false;
  const curVal = destParent?.[key as string];
  if (isEmptyLike(curVal)) {
    destParent[key as string] = srcVal;
    return true;
  }
  return false;
}

/**
 * Populate empty employeeFields from employeeProfile as default values
 * This is a scalable solution that fills missing fields without breaking existing data
 */
function populateEmployeeFieldsFromProfile(
  employeeFields: any,
  employeeProfile: any
): void {
  if (!employeeFields || !employeeProfile) return;

  // Deep clone helper to avoid mutating the original
  const deepClone = <T>(x: T): T => {
    if (x === null || x === undefined) return x;
    return JSON.parse(JSON.stringify(x));
  };

  // 1. Populate personaldetails section
  if (employeeProfile.personaldetails) {
    if (!employeeFields.personaldetails) {
      employeeFields.personaldetails = {};
    }
    const pdKeys = Object.keys(employeeProfile.personaldetails);
    for (const key of pdKeys) {
      const profileVal = employeeProfile.personaldetails[key];
      const currentVal = employeeFields.personaldetails[key];
      if (hasMeaningful(profileVal) && isEmptyLike(currentVal)) {
        // Deep clone to avoid reference issues
        employeeFields.personaldetails[key] = deepClone(profileVal);
      }
    }
  }

  // 2. Populate address array
  if (
    Array.isArray(employeeProfile.address) &&
    employeeProfile.address.length > 0 &&
    hasMeaningful(employeeProfile.address) &&
    isEmptyLike(employeeFields.address)
  ) {
    employeeFields.address = deepClone(employeeProfile.address);
  }

  // 3. Populate documents section (nested structure)
  if (
    employeeProfile.documents &&
    typeof employeeProfile.documents === "object"
  ) {
    if (!employeeFields.documents) {
      employeeFields.documents = {};
    }
    const docGroups = Object.keys(employeeProfile.documents);
    for (const groupKey of docGroups) {
      const profileGroup = employeeProfile.documents[groupKey];
      if (
        profileGroup &&
        typeof profileGroup === "object" &&
        !Array.isArray(profileGroup)
      ) {
        if (!employeeFields.documents[groupKey]) {
          employeeFields.documents[groupKey] = {};
        }
        const docKeys = Object.keys(profileGroup);
        for (const docKey of docKeys) {
          const profileDoc = profileGroup[docKey];
          const currentDoc = employeeFields.documents[groupKey][docKey];
          if (hasMeaningful(profileDoc) && isEmptyLike(currentDoc)) {
            employeeFields.documents[groupKey][docKey] = deepClone(profileDoc);
          }
        }
      }
    }
  }

  // 4. Populate main section (if exists in profile)
  if (employeeProfile.main) {
    if (!employeeFields.main) {
      employeeFields.main = {};
    }
    const mainKeys = Object.keys(employeeProfile.main);
    for (const key of mainKeys) {
      const profileVal = employeeProfile.main[key];
      const currentVal = employeeFields.main[key];
      if (hasMeaningful(profileVal) && isEmptyLike(currentVal)) {
        employeeFields.main[key] = deepClone(profileVal);
      }
    }
  }
}

/** Merge additionalFields from payload into profile (create or fill when empty) */
function mergeAdditionalFields(profile: any, payloadList: any[] = []): boolean {
  if (!Array.isArray(payloadList) || payloadList.length === 0) return false;
  if (!Array.isArray(profile.additionalFields)) profile.additionalFields = [];
  let changed = false;

  for (const item of payloadList) {
    if (!item || !item.fieldKey) continue;

    const keySig = (v: any) =>
      `${v.sectionKey || ""}||${v.innerSectionKey || ""}||${v.fieldKey}`;

    const idx = profile.additionalFields.findIndex(
      (f: any) => keySig(f) === keySig(item)
    );

    if (idx === -1) {
      // create only if value is meaningful
      if (hasMeaningful(item.value)) {
        profile.additionalFields.push({
          sectionKey: item.sectionKey || undefined,
          innerSectionKey: item.innerSectionKey || undefined,
          fieldKey: item.fieldKey,
          value: item.value,
          isShowInProfile: !!item.isShowInProfile, // default false if omitted
        });
        changed = true;
      }
    } else {
      // fill existing when empty
      const cur = profile.additionalFields[idx];
      if (isEmptyLike(cur?.value) && hasMeaningful(item.value)) {
        profile.additionalFields[idx].value = item.value;
        // keep existing isShowInProfile unless explicitly provided
        if (typeof item.isShowInProfile === "boolean") {
          profile.additionalFields[idx].isShowInProfile = item.isShowInProfile;
        }
        changed = true;
      }
    }
  }
  return changed;
}

/** ---------- MAIN: updateEmployeeFieldsByUserId with profile autofill ---------- **/
export const updateEmployeeFieldsByUserId = async ({
  userId,
  tenantId,
  branchId,
  employeeFields,
}: {
  userId: Types.ObjectId;
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  employeeFields: any;
}) => {
  // 1) Resolve EmployeeProfile
  const profile = await EmployeeProfile.findOne({ userId }).select({ _id: 1 });
  if (!profile) return null;

  // 2) Update the Employee mirror (unchanged)
  const updated = await EmployeeModel.findOneAndUpdate(
    { employeeProfile: profile._id, tenantId, branchId, isDeleted: false },
    { $set: { employeeFields } },
    { new: true, runValidators: true }
  )
    .populate("designation")
    .populate({ path: "employeeProfile", populate: { path: "userId" } });

  // 3) Auto-fill EmployeeProfile with payload where profile is empty
  try {
    const profDoc = await EmployeeProfile.findById(profile._id);
    if (profDoc) {
      let changed = false;

      // address: copy array (e.g., from [ {} ] -> real addresses)
      if (
        hasMeaningful(employeeFields?.address) &&
        isEmptyLike(profDoc.address)
      ) {
        profDoc.address = employeeFields.address;
        changed = true;
      }

      // main: field-by-field fill
      if (employeeFields?.main) {
        const keys = Object.keys(employeeFields.main);
        for (const k of keys) {
          // @ts-ignore
          changed =
            fillIfEmpty<typeof profDoc.main>(
              profDoc.main || (profDoc.main = {}),
              k,
              employeeFields.main
            ) || changed;
        }
      }

      // personaldetails: field-by-field fill (includes employeephoto as FileRef)
      if (employeeFields?.personaldetails) {
        const keys = Object.keys(employeeFields.personaldetails);
        for (const k of keys) {
          // @ts-ignore
          changed =
            fillIfEmpty<typeof profDoc.personaldetails>(
              profDoc.personaldetails || (profDoc.personaldetails = {}),
              k,
              employeeFields.personaldetails
            ) || changed;
        }
      }

      // documents.*.* (optional: only if you send them; we fill file refs)
      if (
        employeeFields?.documents &&
        typeof employeeFields.documents === "object"
      ) {
        const docGroups = Object.keys(employeeFields.documents); // identificationdocuments, certificates, checksandclearance
        for (const group of docGroups) {
          const payloadGroup = employeeFields.documents[group];
          if (!payloadGroup || typeof payloadGroup !== "object") continue;

          // ensure group object exists
          // @ts-ignore
          if (!profDoc.documents) profDoc.documents = {} as any;
          // @ts-ignore
          if (!profDoc.documents[group]) profDoc.documents[group] = {} as any;

          const fields = Object.keys(payloadGroup);
          for (const f of fields) {
            const src = payloadGroup[f];
            // @ts-ignore
            const cur = profDoc.documents[group][f];
            if (isEmptyLike(cur) && hasMeaningful(src)) {
              // @ts-ignore
              profDoc.documents[group][f] = src;
              changed = true;
            }
          }
        }
      }

      // additionalFields list from payload (create or fill when empty)
      if (Array.isArray(employeeFields?.additionalFields)) {
        changed =
          mergeAdditionalFields(profDoc, employeeFields.additionalFields) ||
          changed;
      }

      if (changed) {
        await profDoc.save();
      }
    }
  } catch (e) {
    // Don’t break the main update if autofill fails; log for diagnostics.
    console.error("Auto-fill EmployeeProfile failed:", e);
  }

  return updated;
};

// function isMeaningfulPrimitive(v: any) {
//   if (v === null || v === undefined) return false;
//   if (typeof v === "string") return v.trim().length > 0;
//   if (typeof v === "number") return true; // allow 0
//   if (v instanceof Date) return !isNaN(v.getTime());
//   return true; // booleans, objects handled elsewhere
// }

// function isFileRefLike(obj: any) {
//   return (
//     obj &&
//     typeof obj === "object" &&
//     ("fileId" in obj ||
//       "key" in obj ||
//       "url" in obj ||
//       "expiryDate" in obj ||
//       "issuingDate" in obj)
//   );
// }
// function isMeaningfulFileRef(obj: any) {
//   return obj && typeof obj === "object" && (obj.fileId || obj.key || obj.url);
// }
// function isEmptyFileRef(obj: any) {
//   return !obj || !(obj.fileId || obj.key || obj.url);
// }

// /** NEW: treat arrays like [ {} ] or [ { field: "" } ] as empty-like */
// function isEmptyLike(target: any): boolean {
//   if (target === null || target === undefined) return true;
//   if (typeof target === "string") return target.trim().length === 0;
//   if (isFileRefLike(target)) return isEmptyFileRef(target);
//   if (target instanceof Date) return false;

//   if (Array.isArray(target)) {
//     if (target.length === 0) return true;
//     // every item empty-like? treat whole array as empty
//     return target.every((item) => isEmptyLike(item));
//   }

//   if (typeof target === "object") {
//     const keys = Object.keys(target);
//     if (keys.length === 0) return true;
//     // all values empty-like? treat object as empty
//     return keys.every((k) => isEmptyLike((target as any)[k]));
//   }

//   // numbers/booleans considered not empty
//   return false;
// }

// /** unchanged but kept here for clarity */
// function arrayHasMeaningful(arr: any[]) {
//   if (!Array.isArray(arr) || arr.length === 0) return false;
//   return arr.some((item) => {
//     if (isFileRefLike(item)) return isMeaningfulFileRef(item);
//     if (Array.isArray(item)) return arrayHasMeaningful(item);
//     if (item && typeof item === "object") {
//       const vals = Object.values(item);
//       if (vals.length === 0) return false;
//       return vals.some((v) => {
//         if (isFileRefLike(v)) return isMeaningfulFileRef(v);
//         if (Array.isArray(v)) return arrayHasMeaningful(v);
//         if (v && typeof v === "object") {
//           const inner = Object.values(v);
//           return inner.some(isMeaningfulPrimitive);
//         }
//         return isMeaningfulPrimitive(v);
//       });
//     }
//     return isMeaningfulPrimitive(item);
//   });
// }

// function isEmptyLike(target: any) {
//   if (target === null || target === undefined) return true;
//   if (typeof target === "string") return target.trim().length === 0;
//   if (Array.isArray(target)) return target.length === 0;
//   if (isFileRefLike(target)) return isEmptyFileRef(target);
//   if (target instanceof Date) return false;
//   if (typeof target === "object") return Object.keys(target).length === 0;
//   return false;
// }

// /**
//  * Recursively builds a $set patch by looking at payload (employeeFields)
//  * and copying values into the profile only when the profile has "empty" values.
//  * Skips "additionalFields", handled separately below.
//  */
// function buildAutoFillSet(
//   payload: any,
//   currentProfileObj: any,
//   basePath = "",
//   out: Record<string, any> = {}
// ) {
//   if (!payload || typeof payload !== "object") return out;

//   for (const [k, v] of Object.entries(payload)) {
//     if (k === "additionalFields") continue; // handle later
//     const path = basePath ? `${basePath}.${k}` : k;
//     const currentVal = get(currentProfileObj, path);

//     if (Array.isArray(v)) {
//       if (isEmptyLike(currentVal) && arrayHasMeaningful(v)) {
//         out[path] = v;
//       }
//       continue;
//     }

//     if (isFileRefLike(v)) {
//       // Only set if profile's file is empty and payload has a proper fileId/key (prefer new schema)
//       const canFill = isEmptyFileRef(currentVal) && isMeaningfulFileRef(v);
//       if (canFill) {
//         // normalize to new schema ({fileId, key, ...})
//         const normalized: any = {};
//         if (v.fileId) normalized.fileId = v.fileId;
//         if (v.key) normalized.key = v.key;
//         if (v.expiryDate) normalized.expiryDate = v.expiryDate;
//         if (v.issuingDate) normalized.issuingDate = v.issuingDate;
//         // ignore legacy url if no fileId/key
//         if (Object.keys(normalized).length > 0) {
//           out[path] = normalized;
//         }
//       }
//       continue;
//     }

//     if (v && typeof v === "object") {
//       buildAutoFillSet(v, currentProfileObj, path, out);
//       continue;
//     }

//     // primitive
//     if (isEmptyLike(currentVal) && isMeaningfulPrimitive(v)) {
//       out[path] = v;
//     }
//   }

//   return out;
// }

// /**
//  * Merge additionalFields: only add/update when profile has no entry or empty value
//  */
// function mergeAdditionalFields(
//   incoming: any[] | undefined,
//   existing: any[] | undefined
// ) {
//   const existingArr = Array.isArray(existing) ? [...existing] : [];
//   const inArr = Array.isArray(incoming) ? incoming : [];

//   for (const inc of inArr) {
//     if (!inc || typeof inc !== "object") continue;
//     const { sectionKey, innerSectionKey, fieldKey, value, isShowInProfile } =
//       inc;
//     if (!fieldKey) continue;
//     const meaningful = isFileRefLike(value)
//       ? isMeaningfulFileRef(value)
//       : isMeaningfulPrimitive(value) || (value && typeof value === "object");

//     if (!meaningful) continue;

//     const idx = existingArr.findIndex(
//       (e) =>
//         e.fieldKey === fieldKey &&
//         (e.sectionKey || "") === (sectionKey || "") &&
//         (e.innerSectionKey || "") === (innerSectionKey || "")
//     );

//     if (idx === -1) {
//       existingArr.push({
//         sectionKey: sectionKey || undefined,
//         innerSectionKey: innerSectionKey || undefined,
//         fieldKey,
//         value,
//         isShowInProfile:
//           typeof isShowInProfile === "boolean" ? isShowInProfile : false,
//       });
//     } else {
//       const ex = existingArr[idx];
//       const exMeaningful = isFileRefLike(ex?.value)
//         ? isMeaningfulFileRef(ex.value)
//         : isMeaningfulPrimitive(ex?.value) ||
//           (ex?.value &&
//             typeof ex.value === "object" &&
//             Object.keys(ex.value).length > 0);

//       if (!exMeaningful) {
//         ex.value = value;
//       }
//       // don't force-change isShowInProfile unless client sent it explicitly
//       if (typeof isShowInProfile === "boolean") {
//         ex.isShowInProfile = isShowInProfile;
//       }
//     }
//   }

//   return existingArr;
// }

// /**
//  * Update employeeFields for employee by userId, tenantId, branchId
//  * + Auto-fill EmployeeProfile where empty using employeeFields values.
//  */
// export const updateEmployeeFieldsByUserId = async ({
//   userId,
//   tenantId,
//   branchId,
//   employeeFields,
// }: {
//   userId: Types.ObjectId;
//   tenantId: Types.ObjectId;
//   branchId: Types.ObjectId;
//   employeeFields: any;
// }) => {
//   // 1) Load the user's profile (full doc, we need existing values)
//   const profileDoc = await EmployeeProfile.findOne({
//     userId,
//   });

//   if (!profileDoc) {
//     return null; // controller will return 404
//   }

//   // 2) Update the Employee that references this profile (your existing logic)
//   const updatedEmployee = await EmployeeModel.findOneAndUpdate(
//     {
//       employeeProfile: profileDoc._id,
//       tenantId,
//       branchId,
//       isDeleted: false,
//     },
//     { $set: { employeeFields } },
//     {
//       new: true,
//       runValidators: true,
//     }
//   )
//     .populate("designation")
//     .populate({ path: "employeeProfile", populate: { path: "userId" } });

//   // 3) Build an auto-fill patch for the profile where values are empty
//   const profileObj = profileDoc.toObject();
//   const setPatch = buildAutoFillSet(employeeFields, profileObj);

//   // 4) Merge additionalFields similarly (only if empty/missing on profile)
//   if (employeeFields?.additionalFields) {
//     const merged = mergeAdditionalFields(
//       employeeFields.additionalFields,
//       profileDoc.additionalFields
//     );
//     // Only set if changed
//     if (
//       JSON.stringify(merged) !==
//       JSON.stringify(profileDoc.additionalFields || [])
//     ) {
//       profileDoc.additionalFields = merged as any;
//     }
//   }

//   // 5) Apply patch if any and save profile
//   if (Object.keys(setPatch).length > 0) {
//     Object.entries(setPatch).forEach(([path, val]) =>
//       set(profileDoc, path, val)
//     );
//   }

//   if (Object.keys(setPatch).length > 0 || employeeFields?.additionalFields) {
//     await profileDoc.save();
//   }

//   return updatedEmployee;
// };

// --------------------------------

// /**
//  * Update employeeFields for employee by userId, tenantId, branchId
//  */
// export const updateEmployeeFieldsByUserId = async ({
//   userId,
//   tenantId,
//   branchId,
//   employeeFields,
// }: {
//   userId: Types.ObjectId;
//   tenantId: Types.ObjectId;
//   branchId: Types.ObjectId;
//   employeeFields: any;
// }) => {
//   // 1) Resolve the employeeProfile for this user & scope
//   const profile = await EmployeeProfile.findOne({
//     userId,
//     // isDeleted: false,
//   }).select({ _id: 1 });

//   if (!profile) {
//     return null; // controller will return 404
//   }

//   console.log(profile._id, tenantId, branchId, "showww");

//   // 2) Update the Employee that references this profile
//   const updated = await EmployeeModel.findOneAndUpdate(
//     {
//       employeeProfile: profile._id,
//       tenantId,
//       branchId,
//       isDeleted: false,
//     },
//     { $set: { employeeFields } },
//     {
//       new: true,
//       runValidators: true,
//     }
//   )
//     .populate("designation")
//     .populate({ path: "employeeProfile", populate: { path: "userId" } });

//   console.log(updated, "heyy");

//   return updated;
// };

// ----------------------------------------

type GetMyOrgArgs = {
  tenantId: Types.ObjectId; // derived from the matching assignment
  branchId: Types.ObjectId; // the :id route param
  userId: Types.ObjectId;
  email: string;
};
/**
 * Branch-scoped "my organization" fetch for a logged-in employee.
 * - returns tenant, branch, config, and employee (for this user in that tenant/branch)
 * - strips:
 *    a) additionalFields whose config has employeerOnlyEditable === true
 *    b) ANY core employeeFields values (top-level or inner) whose config has employeerOnlyEditable === true
 *    c) entire sections if the SECTION has employeerOnlyEditable === true
 * - enriches reference-type additional fields with {_id, name}
 */
export const getMyOrganizationById = async ({
  tenantId,
  branchId,
  userId,
  email,
}: GetMyOrgArgs) => {
  // 1) config (branch-scoped)
  const config = await EmployeeFieldConfig.findOne({
    tenantId,
    branchId,
  }).lean();

  // 2) current employee in this tenant/branch
  // First, verify the user exists and get their profile
  const user = await User.findById(userId).select("_id email fullName").lean();
  if (!user) {
    throw new Error("User not found");
  }

  const employeeProfile = await EmployeeProfile.findOne({ userId }).lean();

  if (!employeeProfile) {
    // No employee profile found for this user - return empty
    return { config, employee: null };
  }

  // Security check: Verify the employee profile belongs to the requested userId
  if (String(employeeProfile.userId) !== String(userId)) {
    throw new Error("Employee profile userId mismatch - security violation");
  }

  // Ensure we're using the correct employee profile ID
  const employee = await EmployeeModel.findOne({
    employeeProfile: employeeProfile._id,
    tenantId,
    branchId,
    isDeleted: false,
  })
    .populate({ path: "designation", populate: { path: "departmentIds" } })
    .lean();

  if (!employee) return { config, employee: null };

  // Final security check: Verify the employee's profile matches the user's profile
  if (String(employee.employeeProfile) !== String(employeeProfile._id)) {
    throw new Error("Employee profile mismatch - security violation");
  }

  // Debug: Log the fetched employee data to check for new fields
  console.log("🔍 [DEBUG] Fetched employee from DB - personaldetails:", {
    countryofbirth: employee?.employeeFields?.personaldetails?.countryofbirth,
    countryofcitizenship:
      employee?.employeeFields?.personaldetails?.countryofcitizenship,
    languagesspeak: employee?.employeeFields?.personaldetails?.languagesspeak,
    allPersonaldetailsKeys: employee?.employeeFields?.personaldetails
      ? Object.keys(employee.employeeFields.personaldetails)
      : [],
  });

  // ---- Populate empty employeeFields from employeeProfile as default values
  if (employee.employeeFields && employeeProfile) {
    populateEmployeeFieldsFromProfile(employee.employeeFields, employeeProfile);
  }

  // ---- Build lookups from config
  type FieldPtr = {
    sectionKey: string;
    innerSectionKey?: string | null;
    fieldKey: string;
  };

  const employerOnlyFieldSet = new Set<string>(); // per-field
  const employerOnlySectionSet = new Set<string>(); // whole section
  const referenceMeta: Array<FieldPtr & { referenceModel: string }> = [];

  if (config?.sections?.length) {
    for (const section of config.sections) {
      if (section?.employeerOnlyEditable === true) {
        employerOnlySectionSet.add(section.sectionKey);
      }

      for (const f of section.fields || []) {
        const k = `${section.sectionKey}::${null}::${f.key}`;
        if (f?.employeerOnlyEditable === true) employerOnlyFieldSet.add(k);
        if (f?.type === "reference" && f?.referenceModel) {
          referenceMeta.push({
            sectionKey: section.sectionKey,
            innerSectionKey: null,
            fieldKey: f.key,
            referenceModel: f.referenceModel,
          });
        }
      }

      for (const inner of section.innerSections || []) {
        for (const f of inner.fields || []) {
          const k = `${section.sectionKey}::${inner.sectionKey}::${f.key}`;
          if (f?.employeerOnlyEditable === true) employerOnlyFieldSet.add(k);
          if (f?.type === "reference" && f?.referenceModel) {
            referenceMeta.push({
              sectionKey: section.sectionKey,
              innerSectionKey: inner.sectionKey,
              fieldKey: f.key,
              referenceModel: f.referenceModel,
            });
          }
        }
      }
    }
  }

  // ---- Helpers
  const deepClone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
  const isPlainObj = (v: any) =>
    v && typeof v === "object" && !Array.isArray(v);

  const pruneEmpty = (node: any): any => {
    if (Array.isArray(node)) {
      const arr = node.map(pruneEmpty).filter((x) => {
        if (x === null || x === undefined) return false;
        if (typeof x === "string") return x.trim() !== "";
        if (Array.isArray(x)) return x.length > 0;
        if (isPlainObj(x)) return Object.keys(x).length > 0;
        return true;
      });
      return arr;
    }
    if (isPlainObj(node)) {
      const out: any = {};
      for (const [k, v] of Object.entries(node)) {
        const pruned = pruneEmpty(v);
        const keep =
          pruned !== null &&
          pruned !== undefined &&
          !(typeof pruned === "string" && pruned.trim() === "") &&
          !(Array.isArray(pruned) && pruned.length === 0) &&
          !(isPlainObj(pruned) && Object.keys(pruned).length === 0);
        if (keep) out[k] = pruned;
      }
      return out;
    }
    return node;
  };

  // ---- Filter additionalFields (by field + by whole section)
  const rawAdditional: any[] = employee?.employeeFields?.additionalFields || [];
  const filteredAdditional = rawAdditional.filter((item) => {
    if (employerOnlySectionSet.has(item.sectionKey)) return false;
    const k = `${item.sectionKey}::${item.innerSectionKey ?? null}::${
      item.fieldKey
    }`;
    return !employerOnlyFieldSet.has(k);
  });

  // ---- Enrich reference additional fields and convert ObjectId fileId to string
  const enrichedAdditional = await Promise.all(
    filteredAdditional.map(async (field: any) => {
      // Convert ObjectId fileId to string and Date fields to ISO strings if they exist in the field value
      let processedField = { ...field };
      if (
        field.value &&
        typeof field.value === "object" &&
        (field.value.fileId ||
          field.value.issuingDate ||
          field.value.expiryDate)
      ) {
        processedField = {
          ...field,
          value: {
            ...field.value,
            // Convert ObjectId fileId to string
            ...(field.value.fileId && { fileId: String(field.value.fileId) }),
            // Convert Date fields to ISO strings
            ...(field.value.issuingDate && {
              issuingDate: field.value.issuingDate.toISOString(),
            }),
            ...(field.value.expiryDate && {
              expiryDate: field.value.expiryDate.toISOString(),
            }),
          },
        };
      }

      const refMeta = referenceMeta.find(
        (ref) =>
          ref.sectionKey === processedField.sectionKey &&
          (ref.innerSectionKey ?? null) ===
            (processedField.innerSectionKey ?? null) &&
          ref.fieldKey === processedField.fieldKey
      );

      if (!refMeta) return processedField;
      if (!Types.ObjectId.isValid(processedField.value)) return processedField;

      try {
        if (refMeta.referenceModel === "Employee") {
          const refEmp = await EmployeeModel.findById(processedField.value)
            .select(
              "_id employeeFields.personaldetails.firstname employeeFields.personaldetails.lastname"
            )
            .lean();
          const first =
            refEmp?.employeeFields?.personaldetails?.firstname ?? "";
          const last = refEmp?.employeeFields?.personaldetails?.lastname ?? "";
          const name = [first, last].filter(Boolean).join(" ").trim();
          return refEmp
            ? { ...processedField, value: { _id: String(refEmp._id), name } }
            : processedField;
        } else {
          const refModel = mongoose.model(refMeta.referenceModel);
          const refDoc = await refModel
            .findById(processedField.value)
            .select("_id title name")
            .lean();
          return refDoc
            ? {
                ...processedField,
                value: {
                  _id: String(refDoc._id),
                  title: refDoc.title || refDoc.name || "",
                  name: refDoc.name ?? "",
                },
              }
            : processedField;
        }
      } catch {
        return processedField;
      }
    })
  );

  // ---- SCRUB core employeeFields using config (field-level + whole section)
  const safeEmployee = deepClone(employee);
  const ef = deepClone(employee.employeeFields || {});

  console.log("🔍 [DEBUG] Before filtering - employeeFields:", {
    hasDocuments: !!(ef as any).documents,
    documentsKeys: (ef as any).documents
      ? Object.keys((ef as any).documents)
      : [],
    documentsValue: (ef as any).documents,
    personaldetails: (ef as any).personaldetails,
    countryofbirth: (ef as any).personaldetails?.countryofbirth,
    countryofcitizenship: (ef as any).personaldetails?.countryofcitizenship,
    languagesspeak: (ef as any).personaldetails?.languagesspeak,
  });

  // remove whole sections that are employer-only
  for (const secKey of employerOnlySectionSet) {
    if (ef.hasOwnProperty(secKey)) delete ef[secKey];
  }

  // remove employer-only individual fields (top-level + inner)
  for (const key of employerOnlyFieldSet) {
    const [sectionKey, innerKeyStr, fieldKey] = key.split("::");
    const innerKey = innerKeyStr === "null" ? null : innerKeyStr;

    if (!ef?.[sectionKey]) continue;

    if (innerKey === null) {
      if (ef[sectionKey]?.hasOwnProperty(fieldKey)) {
        delete ef[sectionKey][fieldKey];
      }
    } else {
      if (ef[sectionKey]?.[innerKey]?.hasOwnProperty(fieldKey)) {
        delete ef[sectionKey][innerKey][fieldKey];
        // clean empty inner group
        if (
          isPlainObj(ef[sectionKey][innerKey]) &&
          Object.keys(ef[sectionKey][innerKey]).length === 0
        ) {
          delete ef[sectionKey][innerKey];
        }
      }
    }

    // clean empty section
    if (
      isPlainObj(ef[sectionKey]) &&
      Object.keys(ef[sectionKey]).length === 0
    ) {
      delete ef[sectionKey];
    }
  }

  // overwrite additionalFields with enriched + already filtered ones
  ef.additionalFields = enrichedAdditional;

  // final prune of any empty objects/arrays
  safeEmployee.employeeFields = pruneEmpty(ef);

  console.log("🔍 [DEBUG] After pruning - employeeFields:", {
    hasDocuments: !!(safeEmployee.employeeFields as any).documents,
    documentsKeys: (safeEmployee.employeeFields as any).documents
      ? Object.keys((safeEmployee.employeeFields as any).documents)
      : [],
    documentsValue: (safeEmployee.employeeFields as any).documents,
    personaldetails: (safeEmployee.employeeFields as any).personaldetails,
    countryofbirth: (safeEmployee.employeeFields as any).personaldetails
      ?.countryofbirth,
    countryofcitizenship: (safeEmployee.employeeFields as any).personaldetails
      ?.countryofcitizenship,
    languagesspeak: (safeEmployee.employeeFields as any).personaldetails
      ?.languagesspeak,
  });

  return { employee: { ...safeEmployee, email } };
};

// -----------------------------------

/** ---------- helpers ---------- */

const buildAdditionalFieldMaps2 = (section: any) => {
  const top: Record<string, { employerOnly: boolean; isAdditional: boolean }> =
    {};
  const inner: Record<
    string,
    Record<string, { employerOnly: boolean; isAdditional: boolean }>
  > = {};

  for (const f of section.fields || []) {
    top[f.key] = {
      employerOnly: !!f.employeerOnlyEditable,
      isAdditional: !!f.isAdditional,
    };
  }
  for (const inn of section.innerSections || []) {
    inner[inn.sectionKey] = inner[inn.sectionKey] || {};
    for (const f of inn.fields || []) {
      inner[inn.sectionKey][f.key] = {
        employerOnly: !!f.employeerOnlyEditable,
        isAdditional: !!f.isAdditional,
      };
    }
  }
  return { top, inner };
};

// const normalizeForField = (meta: FieldMeta | undefined, raw: any) => {
//   if (meta?.type === "file") {
//     if (raw === null || raw === undefined) return undefined;

//     if (typeof raw === "string") {
//       const s = raw.trim();
//       return s ? { url: s } : {};
//     }

//     if (typeof raw === "object") {
//       const urlStr =
//         typeof (raw as any).url === "string" ? (raw as any).url.trim() : "";
//       if (!urlStr) return {};
//       const { issuingDate, expiryDate, referenceNumber, points } = raw as any;
//       return { url: urlStr, issuingDate, expiryDate, referenceNumber, points };
//     }

//     return {};
//   }

//   if (isTrulyEmpty(raw)) return undefined;
//   return raw;
// };

function normalizeForField(meta: any, raw: any) {
  // treat "delete" semantics consistently
  if (
    raw === null ||
    raw === undefined ||
    (typeof raw === "string" && raw.trim() === "")
  ) {
    return undefined;
  }

  const t = (meta?.type || "").toLowerCase();

  // ✅ NEW: unified file normalizer for { fileId, key, ... }
  if (t === "file") {
    if (typeof raw !== "object" || Array.isArray(raw)) return undefined;

    // Already in the new shape
    if (raw.fileId && raw.key) {
      return {
        fileId: raw.fileId, // keep as string; Mongoose will cast to ObjectId
        key: raw.key,
        expiryDate: raw.expiryDate,
        issuingDate: raw.issuingDate,
        referenceNumber:
          typeof raw.referenceNumber === "string"
            ? raw.referenceNumber
            : undefined,
        points:
          typeof raw.points === "number"
            ? raw.points
            : Number.isFinite(Number(raw.points))
              ? Number(raw.points)
              : undefined,
      };
    }

    // Legacy-only payload sent (no fileId/key, just url)
    // if (raw.url && (!raw.fileId || !raw.key)) {
    //   const err: any = new Error(
    //     `Field "${
    //       meta?.label || meta?.key || "file"
    //     }" now requires { fileId, key }. ` +
    //       `Legacy "url" is no longer accepted.`
    //   );
    //   err.status = 400;
    //   throw err;
    // }

    // Unknown / empty object: drop it
    return undefined;
  }

  // ------ other primitive types (keep your existing logic) ------
  if (t === "date") {
    return raw;
  }

  if (t === "number") {
    if (raw === "" || raw === null || raw === undefined) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }

  if (t === "checkbox" || t === "boolean") {
    if (raw === "" || raw === null || raw === undefined) return undefined;
    return Boolean(raw);
  }

  if (t === "select" || t === "text" || t === "string") {
    if (raw === "" || raw === null || raw === undefined) return undefined;
    return String(raw);
  }

  // default: passthrough (if you had previous behavior)
  return raw;
}

const toPlain2 = (v: any) => {
  if (!v) return v;
  if (typeof (v as any).toObject === "function") {
    return (v as any).toObject({ depopulate: true });
  }
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return v;
  }
};

// -------------------------------------------------
// HERE IT WILL START--------------------------------------------------
/* ------------------------------ Audit helpers ------------------------------ */

/* ==========================================================================
 *  MAIN SERVICE (me/org-fields/:branchId) => PUT  (with reusable audit logs)
 * ========================================================================== */

/** ======================================================
 *  MAIN SERVICE (me/org-fields/:branchId)
 *  ====================================================== */
// export const upsertMyOrgFieldsByBranchId = async ({
//   employeeId,
//   tenantId,
//   branchId,
//   sectionKey,
//   isAdditional,
//   data,
//   items,
// }: {
//   employeeId: Types.ObjectId;
//   tenantId: Types.ObjectId;
//   branchId: Types.ObjectId;
//   sectionKey: string;
//   isAdditional: boolean;
//   data?: Record<string, any> | any[];
//   items?: Array<{
//     sectionKey: string;
//     innerSectionKey?: string;
//     fieldKey: string;
//     value: any;
//     isShowInProfile?: boolean;
//   }>;
// }) => {
//   // Load employee and validate ownership
//   const employee = await EmployeeModel.findOne({
//     employeeProfile: employeeId,
//     tenantId,
//     branchId,
//   });

//   if (!employee) {
//     const err: any = new Error("Employee not found");
//     err.status = 404;
//     throw err;
//   }

//   // tenant + branch guard
//   if (!employee.tenantId.equals(tenantId)) {
//     const err: any = new Error("Forbidden (tenant mismatch)");
//     err.status = 403;
//     throw err;
//   }

//   if (!employee.branchId.equals(branchId)) {
//     const err: any = new Error("Forbidden (branch mismatch)");
//     err.status = 403;
//     throw err;
//   }

//   // Config for this tenant+branch
//   const config = await EmployeeFieldConfig.findOne({
//     tenantId,
//     branchId,
//   }).lean();

//   if (!config) {
//     const err: any = new Error("Employee field config not found");
//     err.status = 400;
//     throw err;
//   }

//   const cfgSection = (config.sections || []).find(
//     (s: any) => s.sectionKey === sectionKey
//   );
//   if (!cfgSection) {
//     const err: any = new Error("Invalid sectionKey");
//     err.status = 400;
//     throw err;
//   }

//   // If the entire section is employer-only, employees cannot touch it
//   if (cfgSection.employeerOnlyEditable === true) {
//     const err: any = new Error("This section is employer-only");
//     err.status = 403;
//     throw err;
//   }

//   // Ensure containers
//   employee.employeeFields = employee.employeeFields || {};
//   employee.employeeFields.additionalFields =
//     employee.employeeFields.additionalFields || [];

//   /* =======================
//      CASE A: Additional fields (items[])
//      ======================= */
//   if (isAdditional) {
//     const { top, inner } = buildAdditionalFieldMaps2(cfgSection);
//     const addList = employee.employeeFields.additionalFields as any[];

//     const metaOf = (it: { innerSectionKey?: string; fieldKey: string }) =>
//       it.innerSectionKey
//         ? inner[it.innerSectionKey!]?.[it.fieldKey]
//         : top[it.fieldKey];

//     const findIdx = (
//       list: any[],
//       it: { innerSectionKey?: string; fieldKey: string }
//     ) =>
//       list.findIndex(
//         (f) =>
//           f.sectionKey === sectionKey &&
//           (f.innerSectionKey || undefined) ===
//             (it.innerSectionKey || undefined) &&
//           f.fieldKey === it.fieldKey
//       );

//     for (const it of items || []) {
//       if (it.sectionKey !== sectionKey) {
//         const err: any = new Error("All items must match the sectionKey");
//         err.status = 400;
//         throw err;
//       }

//       const meta = metaOf(it);
//       if (!meta) {
//         const err: any = new Error(
//           `Invalid fieldKey "${it.fieldKey}" for section "${sectionKey}"` +
//             (it.innerSectionKey ? ` innerSection "${it.innerSectionKey}"` : "")
//         );
//         err.status = 400;
//         throw err;
//       }

//       // Must be additional in config
//       if (!meta.isAdditional) {
//         const err: any = new Error(
//           `Field "${it.fieldKey}" is not additional in config`
//         );
//         err.status = 400;
//         throw err;
//       }

//       // Employees CANNOT update employer-only additional fields
//       if (meta.employerOnly === true) {
//         const err: any = new Error(`Field "${it.fieldKey}" is employer-only`);
//         err.status = 403;
//         throw err;
//       }

//       // DELETE semantics: null/undefined/"" => remove from additional
//       const isDelete =
//         it.value === null ||
//         it.value === undefined ||
//         (typeof it.value === "string" && it.value.trim() === "");

//       const idx = findIdx(addList, it);
//       if (isDelete) {
//         if (idx >= 0) addList.splice(idx, 1);
//       } else if (idx >= 0) {
//         addList[idx].value = it.value;
//         if (typeof it.isShowInProfile === "boolean") {
//           addList[idx].isShowInProfile = it.isShowInProfile;
//         }
//       } else {
//         addList.push({
//           sectionKey,
//           innerSectionKey: it.innerSectionKey,
//           fieldKey: it.fieldKey,
//           value: it.value,
//           isShowInProfile: !!it.isShowInProfile,
//         });
//       }
//     }

//     employee.markModified("employeeFields.additionalFields");
//     const saved = await employee.save();

//     return {
//       section: sectionKey,
//       isAdditional: true,
//       employeeFields: {
//         additionalFields: (saved.employeeFields.additionalFields || [])
//           .filter((f: any) => f.sectionKey === sectionKey)
//           .map(toPlain2),
//       },
//     };
//   }

//   /* ==========================================
//      CASE B: Structured sections (NOT additional)
//      ========================================== */
//   const { top, inner } = buildStructuredMaps(cfgSection);

//   // Employees are forbidden to alter employer-only fields; we will 403 if any such keys are present.
//   const rejectForbidden = (keys: string[]) => {
//     const err: any = new Error(
//       `You are not allowed to modify employer-only fields: ${keys.join(", ")}`
//     );
//     err.status = 403;
//     throw err;
//   };

//   // -------- Array-shaped section (e.g., address[]) --------
//   if (Array.isArray(data)) {
//     const allowed = new Set<string>(Object.keys(top));
//     const extra = EXTRA_WHITELIST_BY_SECTION[sectionKey] || new Set<string>();
//     const forbiddenKeys: string[] = [];

//     // Validate keys across rows & detect employer-only fields
//     for (const row of data) {
//       if (row && typeof row === "object" && !Array.isArray(row)) {
//         for (const k of Object.keys(row)) {
//           if (k === "_id" || k === "id") continue;
//           if (!allowed.has(k) && !extra.has(k)) {
//             const err: any = new Error(
//               `Invalid field "${k}" for section "${sectionKey}"`
//             );
//             err.status = 400;
//             throw err;
//           }
//           const meta = top[k];
//           if (meta?.employerOnly) forbiddenKeys.push(k);
//         }
//       }
//     }

//     if (forbiddenKeys.length) rejectForbidden([...new Set(forbiddenKeys)]);

//     // Sanitize + normalize each row to POJO
//     const sanitized = (data as any[])
//       .map((row) => {
//         const out: Record<string, any> = {};
//         if (!row || typeof row !== "object" || Array.isArray(row)) return out;

//         for (const [k, raw] of Object.entries(row)) {
//           if (k === "_id" || k === "id") continue;
//           if (!allowed.has(k) && !extra.has(k)) continue;
//           const meta = top[k]; // undefined for extra keys (fine)
//           const v = normalizeForField(meta, raw);
//           if (v !== undefined) out[k] = v;
//         }
//         return out;
//       })
//       .filter((o) => Object.keys(o).length > 0);

//     (employee.employeeFields as any)[sectionKey] = sanitized;
//     employee.markModified(`employeeFields.${sectionKey}`);

//     const saved = await employee.save();

//     return {
//       section: sectionKey,
//       isAdditional: false,
//       employeeFields: {
//         [sectionKey]: toPlain2((saved.employeeFields as any)[sectionKey]),
//       },
//     };
//   }

//   // -------- Object-shaped section (e.g., personaldetails, documents) --------
//   const incoming = (data || {}) as Record<string, any>;
//   const accepted: Record<string, any> = {};
//   const spillToAdditional: any[] = []; // for misrouted additional (non employer-only)
//   const forbiddenTouched: string[] = [];
//   const unknownKeys: string[] = [];

//   for (const [k, raw] of Object.entries(incoming)) {
//     // Top-level field
//     if (top[k]) {
//       const meta = top[k];
//       const v = normalizeForField(meta, raw);
//       if (v === undefined) continue;

//       if (meta.isAdditional) {
//         // Additional field sent inside data
//         if (meta.employerOnly) {
//           forbiddenTouched.push(k);
//         } else {
//           spillToAdditional.push({ sectionKey, fieldKey: k, value: v });
//         }
//       } else if (meta.employerOnly) {
//         forbiddenTouched.push(k);
//       } else {
//         accepted[k] = v;
//       }
//       continue;
//     }

//     // Inner-section object
//     if (inner[k] && raw && typeof raw === "object" && !Array.isArray(raw)) {
//       const acceptedInner: Record<string, any> = {};
//       for (const [innerFieldKey, innerRaw] of Object.entries(raw)) {
//         const meta = inner[k][innerFieldKey];
//         if (!meta) {
//           unknownKeys.push(`${k}.${innerFieldKey}`);
//           continue;
//         }
//         const v = normalizeForField(meta, innerRaw);
//         if (v === undefined) continue;

//         if (meta.isAdditional) {
//           if (meta.employerOnly) {
//             forbiddenTouched.push(`${k}.${innerFieldKey}`);
//           } else {
//             spillToAdditional.push({
//               sectionKey,
//               innerSectionKey: k,
//               fieldKey: innerFieldKey,
//               value: v,
//             });
//           }
//         } else if (meta.employerOnly) {
//           forbiddenTouched.push(`${k}.${innerFieldKey}`);
//         } else {
//           acceptedInner[innerFieldKey] = v;
//         }
//       }
//       if (Object.keys(acceptedInner).length > 0) {
//         const prevGroup =
//           toPlain2(employee.employeeFields?.[sectionKey]?.[k]) || {};
//         accepted[k] = { ...prevGroup, ...acceptedInner };
//       }
//       continue;
//     }

//     // Unknown path
//     unknownKeys.push(k);
//   }

//   if (unknownKeys.length > 0) {
//     const err: any = new Error(
//       `Invalid field(s) for section "${sectionKey}": ${unknownKeys.join(", ")}`
//     );
//     err.status = 400;
//     throw err;
//   }

//   if (forbiddenTouched.length) {
//     // hard-stop: employees cannot update employer-only fields
//     const uniqueKeys = [...new Set(forbiddenTouched)];
//     const err: any = new Error(
//       `You are not allowed to modify employer-only fields: ${uniqueKeys.join(
//         ", "
//       )}`
//     );
//     err.status = 403;
//     throw err;
//   }

//   // Merge accepted with existing section (POJO)
//   const currentValue = (employee.employeeFields as any)[sectionKey];
//   const currentPlain = toPlain2(currentValue) || {};
//   const merged = { ...currentPlain, ...accepted };
//   pruneUndefinedDeep(merged);

//   (employee.employeeFields as any)[sectionKey] = merged;
//   employee.markModified(`employeeFields.${sectionKey}`);

//   // Upsert additional spillover (safe: none are employer-only)
//   if (spillToAdditional.length) {
//     const addList = employee.employeeFields.additionalFields as any[];
//     for (const it of spillToAdditional) {
//       const idx = addList.findIndex(
//         (f: any) =>
//           f.sectionKey === sectionKey &&
//           (f.innerSectionKey || undefined) ===
//             (it.innerSectionKey || undefined) &&
//           f.fieldKey === it.fieldKey
//       );
//       if (idx >= 0) {
//         addList[idx].value = it.value;
//       } else {
//         addList.push({
//           ...it,
//           isShowInProfile: !!(it as any).isShowInProfile,
//         });
//       }
//     }
//     employee.markModified("employeeFields.additionalFields");
//   }

//   const saved = await employee.save();

//   const outSection =
//     saved.employeeFields?.[sectionKey] &&
//     typeof (saved.employeeFields as any)[sectionKey].toObject === "function"
//       ? (saved.employeeFields as any)[sectionKey].toObject()
//       : toPlain2((saved.employeeFields as any)[sectionKey]);

//   return {
//     section: sectionKey,
//     isAdditional: false,
//     employeeFields: { [sectionKey]: outSection },
//   };
// };

/**
 * upsertMyOrgFieldsByBranchId: explained & optimized
 * ---------------------------------------------------
 * This refactor keeps behavior identical while improving readability,
 * structure, and defensive checks. It breaks the monolith into clear
 * steps with small, named helpers. Comments mark each step, and all
 * thrown errors retain status codes and messages used by callers.
 *
 * External dependencies (unchanged & assumed available in scope):
 *  - EmployeeModel (mongoose model)
 *  - EmployeeFieldConfig (mongoose model)
 *  - Types (mongoose)
 *  - lodash/get (imported as get)
 *  - toPlain2, buildAdditionalFieldMaps2, buildStructuredMaps,
 *    EXTRA_WHITELIST_BY_SECTION, isEqualForAudit, normalizeForAuditValue,
 *    normalizeForField, pruneUndefinedDeep, isEqual, buildAdditionalPath,
 *    logUpdate
 */

export const upsertMyOrgFieldsByBranchId = async ({
  employeeId,
  tenantId,
  branchId,
  sectionKey,
  isAdditional,
  data,
  items,
  updatedField, // Specific field that was updated for efficient change tracking
  audit, // optional audit ctx (actor + request meta)
}: {
  employeeId: Types.ObjectId;
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  sectionKey: string;
  isAdditional: boolean;
  data?: Record<string, any> | any[];
  items?: Array<{
    sectionKey: string;
    innerSectionKey?: string;
    fieldKey: string;
    value: any;
    isShowInProfile?: boolean;
  }>;
  updatedField?: {
    path: string;
    field: string;
    value: any;
    oldValue: any;
  };
  audit?: {
    actorUserId?: string | Types.ObjectId;
    actorEmail?: string;
    route?: string;
    method?: string;
    ip?: string;
    ua?: string;
  };
}) => {
  /* --------------------------------------------------
   * Helpers (local, pure where possible)
   * -------------------------------------------------- */
  const httpError = (message: string, status: number) => {
    const err: any = new Error(message);
    err.status = status;
    return err;
  };

  const assert = (cond: any, message: string, status = 400) => {
    if (!cond) throw httpError(message, status);
  };

  type AuditChange = { path: string; old: any; new: any };
  const auditChanges: AuditChange[] = [];
  const recordChange = (
    meta: any,
    path: string,
    oldValRaw: any,
    newValRaw: any
  ) => {
    if (!isEqualForAudit(meta, oldValRaw, newValRaw)) {
      auditChanges.push({
        path,
        old: normalizeForAuditValue(meta, oldValRaw),
        new: normalizeForAuditValue(meta, newValRaw),
      });
    }
  };

  /**
   * Group audit changes by type (document uploads vs other changes)
   */
  const groupChangesByType = (changes: AuditChange[]) => {
    const documentChanges: AuditChange[] = [];
    const otherChanges: AuditChange[] = [];
    const processedDocumentPaths = new Set<string>();

    for (const change of changes) {
      const isDocumentField = isDocumentFieldChange(change.path);

      if (isDocumentField) {
        // Extract the base document path (without fileId, key, etc.)
        const basePath = getDocumentBasePath(change.path);

        // Only process this document path once
        if (!processedDocumentPaths.has(basePath)) {
          processedDocumentPaths.add(basePath);
          documentChanges.push({
            path: basePath,
            old: change.old,
            new: change.new,
          });
        }
      } else {
        otherChanges.push(change);
      }
    }

    return { documentChanges, otherChanges };
  };

  /**
   * Check if a field change is related to document upload
   */
  const isDocumentFieldChange = (fieldPath: string): boolean => {
    const documentFields = ["fileId", "key", "expiryDate", "issuingDate"];
    const pathParts = fieldPath.split(".");

    return (
      pathParts.some((part) => documentFields.includes(part)) ||
      fieldPath.includes("documents.") ||
      (fieldPath.includes("additionalFields") &&
        pathParts.some((part) => documentFields.includes(part)))
    );
  };

  /**
   * Get the base document path without technical fields
   */
  const getDocumentBasePath = (fieldPath: string): string => {
    const pathParts = fieldPath.split(".");
    const documentFields = ["fileId", "key", "expiryDate", "issuingDate"];

    // Remove technical fields from the end
    while (
      pathParts.length > 0 &&
      documentFields.includes(pathParts[pathParts.length - 1])
    ) {
      pathParts.pop();
    }

    // Ensure we have at least the base path
    if (pathParts.length === 0) {
      return fieldPath; // fallback to original path
    }

    return pathParts.join(".");
  };

  /* --------------------------------------------------
   * Step 1: Load employee & validate scope
   * -------------------------------------------------- */
  const employee = await EmployeeModel.findOne({
    employeeProfile: employeeId,
    tenantId,
    branchId,
  });

  if (!employee) throw httpError("Employee not found", 404);
  if (!employee.tenantId.equals(tenantId))
    throw httpError("Forbidden (tenant mismatch)", 403);
  if (!employee.branchId.equals(branchId))
    throw httpError("Forbidden (branch mismatch)", 403);

  /* --------------------------------------------------
   * Step 2: Load config & section
   * -------------------------------------------------- */
  const config = await EmployeeFieldConfig.findOne({
    tenantId,
    branchId,
  }).lean();
  if (!config) throw httpError("Employee field config not found", 400);

  const cfgSection = (config.sections || []).find(
    (s: any) => s.sectionKey === sectionKey
  );
  if (!cfgSection) throw httpError("Invalid sectionKey", 400);
  if (cfgSection.employeerOnlyEditable === true)
    throw httpError("This section is employer-only", 403);

  /* --------------------------------------------------
   * Step 3: Ensure containers & take BEFORE snapshots
   * -------------------------------------------------- */
  employee.employeeFields = employee.employeeFields || ({} as any);
  employee.employeeFields.additionalFields =
    employee.employeeFields.additionalFields || [];

  const beforeSectionPlain = toPlain2(
    (employee.employeeFields as any)[sectionKey]
  );
  const beforeAdditionalPlain = toPlain2(
    employee.employeeFields.additionalFields
  ) as Array<{
    sectionKey: string;
    innerSectionKey?: string;
    fieldKey: string;
    value: any;
    isShowInProfile?: boolean;
  }>;

  /* --------------------------------------------------
   * Step 4: Branch A - Additional fields
   * -------------------------------------------------- */
  if (isAdditional) {
    const { top, inner } = buildAdditionalFieldMaps2(cfgSection);
    const addList = employee.employeeFields.additionalFields as any[];

    const metaOf = (it: { innerSectionKey?: string; fieldKey: string }) =>
      it.innerSectionKey
        ? inner[it.innerSectionKey!]?.[it.fieldKey]
        : top[it.fieldKey];

    const findIdx = (
      list: any[],
      it: { innerSectionKey?: string; fieldKey: string }
    ) =>
      list.findIndex(
        (f) =>
          f.sectionKey === sectionKey &&
          (f.innerSectionKey || undefined) ===
            (it.innerSectionKey || undefined) &&
          f.fieldKey === it.fieldKey
      );

    for (const it of items || []) {
      assert(
        it.sectionKey === sectionKey,
        "All items must match the sectionKey",
        400
      );

      const meta = metaOf(it);
      assert(
        !!meta,
        `Invalid fieldKey "${it.fieldKey}" for section "${sectionKey}"` +
          (it.innerSectionKey ? ` innerSection "${it.innerSectionKey}"` : ""),
        400
      );
      assert(
        meta.isAdditional,
        `Field "${it.fieldKey}" is not additional in config`,
        400
      );
      assert(
        !meta.employerOnly,
        `Field "${it.fieldKey}" is employer-only`,
        403
      );

      // BEFORE value
      const prevIdx = findIdx(beforeAdditionalPlain || [], it);
      const oldValRaw =
        prevIdx >= 0 ? beforeAdditionalPlain[prevIdx].value : undefined;

      // DELETE semantics
      const toDelete =
        it.value === null ||
        it.value === undefined ||
        (typeof it.value === "string" && it.value.trim() === "");

      // Apply mutation
      const curIdx = findIdx(addList, it);
      if (toDelete) {
        if (curIdx >= 0) addList.splice(curIdx, 1);
      } else if (curIdx >= 0) {
        addList[curIdx].value = it.value;
        if (typeof it.isShowInProfile === "boolean") {
          addList[curIdx].isShowInProfile = it.isShowInProfile;
        }
      } else {
        addList.push({
          sectionKey,
          innerSectionKey: it.innerSectionKey,
          fieldKey: it.fieldKey,
          value: it.value,
          isShowInProfile: !!it.isShowInProfile,
        });
      }

      // Diff record (date-aware)
      const newValRaw = toDelete ? null : it.value;
      recordChange(
        meta,
        buildAdditionalPath(sectionKey, it.innerSectionKey, it.fieldKey),
        oldValRaw,
        newValRaw
      );
    }

    employee.markModified("employeeFields.additionalFields");
    const saved = await employee.save();

    // Audit log
    void logUpdate({
      tenantId,
      branchId,
      subjectUserId: String(saved.employeeProfile),
      subjectUserName: String(
        saved.employeeFields.personaldetails.firstname +
          " " +
          saved.employeeFields.personaldetails.lastname
      ),
      aggregateType: "Employee",
      aggregateId: saved._id,
      sectionKey,
      isAdditional: true,
      changes: auditChanges,
      audit,
    });

    // 🔔 Create notification for employer about employee data change
    try {
      if (auditChanges.length > 0) {
        const employeeName = String(
          saved.employeeFields.personaldetails.firstname +
            " " +
            saved.employeeFields.personaldetails.lastname
        );

        // Helper functions for grouping changes
        const groupChangesByType = (changes: AuditChange[]) => {
          const documentChanges: AuditChange[] = [];
          const otherChanges: AuditChange[] = [];
          const processedDocumentPaths = new Set<string>();

          for (const change of changes) {
            const isDocumentField = isDocumentFieldChange(change.path);

            if (isDocumentField) {
              // Extract the base document path (without fileId, key, etc.)
              const basePath = getDocumentBasePath(change.path);

              // Only process this document path once
              if (!processedDocumentPaths.has(basePath)) {
                processedDocumentPaths.add(basePath);
                documentChanges.push({
                  path: basePath,
                  old: change.old,
                  new: change.new,
                });
              }
            } else {
              otherChanges.push(change);
            }
          }

          return { documentChanges, otherChanges };
        };

        const isDocumentFieldChange = (fieldPath: string): boolean => {
          const documentFields = ["fileId", "key", "expiryDate", "issuingDate"];
          const pathParts = fieldPath.split(".");

          return (
            pathParts.some((part) => documentFields.includes(part)) ||
            fieldPath.includes("documents.") ||
            (fieldPath.includes("additionalFields") &&
              pathParts.some((part) => documentFields.includes(part)))
          );
        };

        const getDocumentBasePath = (fieldPath: string): string => {
          const pathParts = fieldPath.split(".");
          const documentFields = ["fileId", "key", "expiryDate", "issuingDate"];

          // Remove technical fields from the end
          while (
            pathParts.length > 0 &&
            documentFields.includes(pathParts[pathParts.length - 1])
          ) {
            pathParts.pop();
          }

          return pathParts.join(".");
        };

        // Group changes by document uploads to avoid multiple notifications
        const { documentChanges, otherChanges } =
          groupChangesByType(auditChanges);

        // Create notifications for document uploads (one per document)
        for (const docChange of documentChanges) {
          await createEmployeeDataChangeNotification({
            tenantId,
            branchId,
            employeeId: saved._id,
            employeeName,
            fieldChanged: docChange.path,
            oldValue: docChange.old,
            newValue: docChange.new,
            actorUserId: audit?.actorUserId,
            actorName: audit?.actor_name,
          });
        }

        // Create notifications for other changes
        for (const change of otherChanges) {
          await createEmployeeDataChangeNotification({
            tenantId,
            branchId,
            employeeId: saved._id,
            employeeName,
            fieldChanged: change.path,
            oldValue: change.old,
            newValue: change.new,
            actorUserId: audit?.actorUserId,
            actorName: audit?.actor_name,
          });
        }
      }
    } catch (notificationError) {
      console.error("Failed to create notification:", notificationError);
      // Don't throw - notification failure shouldn't break the main operation
    }

    return {
      section: sectionKey,
      isAdditional: true,
      employeeFields: {
        additionalFields: (saved.employeeFields.additionalFields || [])
          .filter((f: any) => f.sectionKey === sectionKey)
          .map(toPlain2),
      },
    } as const;
  }

  /* --------------------------------------------------
   * Step 5: Branch B - Structured sections (NOT additional)
   * -------------------------------------------------- */
  const { top, inner } = buildStructuredMaps(cfgSection);

  const rejectForbidden = (keys: string[]) =>
    (() => {
      throw httpError(
        `You are not allowed to modify employer-only fields: ${keys.join(
          ", "
        )}`,
        403
      );
    })();

  // 5.1 Array-shaped section (e.g., address[])
  if (Array.isArray(data)) {
    const allowed = new Set<string>(Object.keys(top));
    const extra = EXTRA_WHITELIST_BY_SECTION[sectionKey] || new Set<string>();
    const forbiddenKeys: string[] = [];

    // Validate incoming keys & collect forbidden
    for (const row of data) {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        for (const k of Object.keys(row)) {
          if (k === "_id" || k === "id") continue;
          assert(
            allowed.has(k) || extra.has(k),
            `Invalid field "${k}" for section "${sectionKey}"`,
            400
          );
          const meta = top[k];
          if (meta?.employerOnly) forbiddenKeys.push(k);
        }
      }
    }
    if (forbiddenKeys.length) rejectForbidden([...new Set(forbiddenKeys)]);

    const sanitized = (data as any[])
      .map((row) => {
        const out: Record<string, any> = {};
        if (!row || typeof row !== "object" || Array.isArray(row)) return out;
        for (const [k, raw] of Object.entries(row)) {
          if (k === "_id" || k === "id") continue;
          if (!allowed.has(k) && !extra.has(k)) continue;
          const meta = top[k];
          const v = normalizeForField(meta, raw);
          if (v !== undefined) out[k] = v;
        }
        return out;
      })
      .filter((o) => Object.keys(o).length > 0);

    // Audit-friendly comparable forms
    const beforeArray = Array.isArray(beforeSectionPlain)
      ? beforeSectionPlain
      : toPlain2((employee.employeeFields as any)[sectionKey]) || [];

    // Ensure top is an object before passing to normalizeArrayOfObjectsForAudit
    const safeTopForAudit = top && typeof top === "object" ? top : {};
    const beforeComparable = normalizeArrayOfObjectsForAudit(
      beforeArray,
      safeTopForAudit
    );
    const newComparable = normalizeArrayOfObjectsForAudit(
      sanitized,
      safeTopForAudit
    );

    (employee.employeeFields as any)[sectionKey] = sanitized;
    employee.markModified(`employeeFields.${sectionKey}`);

    // Use updatedField for efficient change detection if available
    if (updatedField && sectionKey === "documents" && updatedField.path) {
      // Use the specific field information provided by frontend
      console.log(
        "🔍 DEBUG: Using updatedField for efficient change detection:",
        updatedField
      );
      auditChanges.push({
        path: updatedField.path,
        old: normalizeForAuditValue(null, updatedField.oldValue),
        new: normalizeForAuditValue(null, updatedField.value),
      });
    } else if (sectionKey === "documents") {
      // Fallback to field-by-field comparison if no updatedField provided
      for (const [docType, docFields] of Object.entries(newComparable)) {
        const oldDocFields = beforeComparable[docType] || {};

        for (const [fieldKey, fieldValue] of Object.entries(docFields)) {
          const oldFieldValue = oldDocFields[fieldKey];

          if (!isEqualForAudit(null, oldFieldValue, fieldValue)) {
            auditChanges.push({
              path: `${sectionKey}.${docType}.${fieldKey}`,
              old: normalizeForAuditValue(null, oldFieldValue),
              new: normalizeForAuditValue(null, fieldValue),
            });
          }
        }
      }
    } else {
      // For non-document sections, use the original logic
      if (!isEqual(beforeComparable, newComparable)) {
        auditChanges.push({
          path: sectionKey,
          old: beforeComparable,
          new: newComparable,
        });
      }
    }

    const saved = await employee.save();

    // Get employee's actual user ID and name for audit logging
    const empProfile = await EmployeeProfile.findById(
      saved.employeeProfile
    ).select("userId");
    const employeeUserId = empProfile?.userId?.toString();
    const employeeName =
      String(
        (saved.employeeFields?.personaldetails?.firstname || "") +
          " " +
          (saved.employeeFields?.personaldetails?.lastname || "")
      ).trim() || "Unknown Employee";

    console.log(employeeName, "employeeName");
    console.log(employeeUserId, "employeeUserId");

    // Audit log
    void logUpdate({
      tenantId,
      branchId,
      subjectUserId: employeeUserId, // Actual employee user ID
      subjectUserName: employeeName, // Employee's name from employee model
      aggregateType: "Employee",
      aggregateId: saved._id,
      sectionKey,
      isAdditional: false,
      changes: auditChanges,
      audit,
    });

    // 🔔 Create notification for employer about employee data change
    try {
      if (auditChanges.length > 0) {
        // Helper functions for grouping changes
        const groupChangesByType = (changes: AuditChange[]) => {
          const documentChanges: AuditChange[] = [];
          const otherChanges: AuditChange[] = [];
          const processedDocumentPaths = new Set<string>();

          for (const change of changes) {
            const isDocumentField = isDocumentFieldChange(change.path);

            if (isDocumentField) {
              // Extract the base document path (without fileId, key, etc.)
              const basePath = getDocumentBasePath(change.path);

              // Only process this document path once
              if (!processedDocumentPaths.has(basePath)) {
                processedDocumentPaths.add(basePath);
                documentChanges.push({
                  path: basePath,
                  old: change.old,
                  new: change.new,
                });
              }
            } else {
              otherChanges.push(change);
            }
          }

          return { documentChanges, otherChanges };
        };

        const isDocumentFieldChange = (fieldPath: string): boolean => {
          const documentFields = ["fileId", "key", "expiryDate", "issuingDate"];
          const pathParts = fieldPath.split(".");

          return (
            pathParts.some((part) => documentFields.includes(part)) ||
            fieldPath.includes("documents.") ||
            (fieldPath.includes("additionalFields") &&
              pathParts.some((part) => documentFields.includes(part)))
          );
        };

        const getDocumentBasePath = (fieldPath: string): string => {
          const pathParts = fieldPath.split(".");
          const documentFields = ["fileId", "key", "expiryDate", "issuingDate"];

          // Remove technical fields from the end
          while (
            pathParts.length > 0 &&
            documentFields.includes(pathParts[pathParts.length - 1])
          ) {
            pathParts.pop();
          }

          return pathParts.join(".");
        };

        // Group changes by document uploads to avoid multiple notifications
        const { documentChanges, otherChanges } =
          groupChangesByType(auditChanges);

        // Create notifications for document uploads (one per document)
        for (const docChange of documentChanges) {
          await createEmployeeDataChangeNotification({
            tenantId,
            branchId,
            employeeId: saved._id,
            employeeName,
            fieldChanged: docChange.path,
            oldValue: docChange.old,
            newValue: docChange.new,
            actorUserId: audit?.actorUserId,
            actorName: audit?.actor_name,
          });
        }

        // Create notifications for other changes
        for (const change of otherChanges) {
          await createEmployeeDataChangeNotification({
            tenantId,
            branchId,
            employeeId: saved._id,
            employeeName,
            fieldChanged: change.path,
            oldValue: change.old,
            newValue: change.new,
            actorUserId: audit?.actorUserId,
            actorName: audit?.actor_name,
          });
        }
      }
    } catch (notificationError) {
      console.error("Failed to create notification:", notificationError);
      // Don't throw - notification failure shouldn't break the main operation
    }

    return {
      section: sectionKey,
      isAdditional: false,
      employeeFields: {
        [sectionKey]: toPlain2((saved.employeeFields as any)[sectionKey]),
      },
    } as const;
  }

  // 5.2 Object-shaped section
  const incoming = (data || {}) as Record<string, any>;
  const acceptedObj: Record<string, any> = {};
  const spillToAdditional: any[] = [];
  const forbiddenTouched: string[] = [];
  const unknownKeys: string[] = [];

  for (const [k, raw] of Object.entries(incoming)) {
    if (top[k]) {
      const meta = top[k];
      const v = normalizeForField(meta, raw);
      if (v !== undefined) {
        if (meta.isAdditional) {
          if (meta.employerOnly) forbiddenTouched.push(k);
          else spillToAdditional.push({ sectionKey, fieldKey: k, value: v });
        } else if (meta.employerOnly) {
          forbiddenTouched.push(k);
        } else {
          acceptedObj[k] = v;
        }
      }
      continue;
    }

    if (inner[k] && raw && typeof raw === "object" && !Array.isArray(raw)) {
      const acceptedInner: Record<string, any> = {};
      for (const [innerFieldKey, innerRaw] of Object.entries(raw)) {
        const meta = inner[k][innerFieldKey];
        if (!meta) {
          unknownKeys.push(`${k}.${innerFieldKey}`);
          continue;
        }
        const v = normalizeForField(meta, innerRaw);
        if (v === undefined) continue;

        if (meta.isAdditional) {
          if (meta.employerOnly) {
            forbiddenTouched.push(`${k}.${innerFieldKey}`);
          } else {
            spillToAdditional.push({
              sectionKey,
              innerSectionKey: k,
              fieldKey: innerFieldKey,
              value: v,
            });
          }
        } else if (meta.employerOnly) {
          forbiddenTouched.push(`${k}.${innerFieldKey}`);
        } else {
          acceptedInner[innerFieldKey] = v;
        }
      }
      if (Object.keys(acceptedInner).length > 0) {
        const prevGroup =
          toPlain2(employee.employeeFields?.[sectionKey]?.[k]) || {};
        acceptedObj[k] = { ...prevGroup, ...acceptedInner };
      }
      continue;
    }

    unknownKeys.push(k);
  }

  if (unknownKeys.length > 0) {
    throw httpError(
      `Invalid field(s) for section "${sectionKey}": ${unknownKeys.join(", ")}`,
      400
    );
  }
  if (forbiddenTouched.length) {
    const uniqueKeys = [...new Set(forbiddenTouched)];
    rejectForbidden(uniqueKeys);
  }

  // Per-field diffs against BEFORE snapshot (date-aware)
  const beforeObj = (beforeSectionPlain as any) || {};
  for (const [k, v] of Object.entries(acceptedObj)) {
    const p = `${sectionKey}.${k}`;
    const meta = top[k];
    const oldVal = get({ [sectionKey]: beforeObj }, p);

    // Use updatedField for efficient change detection if available
    if (
      updatedField &&
      sectionKey === "documents" &&
      updatedField.field &&
      k === updatedField.field
    ) {
      // Use the specific field information provided by frontend
      console.log(
        "🔍 DEBUG: Using updatedField for object processing:",
        updatedField
      );
      auditChanges.push({
        path: updatedField.path,
        old: normalizeForAuditValue(meta, updatedField.oldValue),
        new: normalizeForAuditValue(meta, updatedField.value),
      });
    } else if (
      sectionKey === "documents" &&
      typeof v === "object" &&
      v !== null
    ) {
      // Fallback to field-by-field comparison if no updatedField provided
      for (const [docFieldKey, docFieldValue] of Object.entries(v)) {
        const docPath = `${sectionKey}.${k}.${docFieldKey}`;
        const oldDocFieldValue = get(
          { [sectionKey]: beforeObj },
          `${sectionKey}.${k}.${docFieldKey}`
        );

        if (!isEqualForAudit(meta, oldDocFieldValue, docFieldValue)) {
          auditChanges.push({
            path: docPath,
            old: normalizeForAuditValue(meta, oldDocFieldValue),
            new: normalizeForAuditValue(meta, docFieldValue),
          });
        }
      }
    } else {
      // For non-document sections, use the original logic
      recordChange(meta, p, oldVal, v);
    }
  }

  // Merge and save
  const currentValue = (employee.employeeFields as any)[sectionKey];
  const currentPlain = toPlain2(currentValue) || {};
  const merged = { ...currentPlain, ...acceptedObj };
  pruneUndefinedDeep(merged);

  (employee.employeeFields as any)[sectionKey] = merged;
  employee.markModified(`employeeFields.${sectionKey}`);

  // Handle spill -> additional (also diff vs BEFORE additional)
  if (spillToAdditional.length) {
    const addList = employee.employeeFields.additionalFields as any[];

    for (const it of spillToAdditional) {
      const meta = it.innerSectionKey?.length
        ? inner[it.innerSectionKey!]?.[it.fieldKey]
        : top[it.fieldKey];

      const oldEntry =
        (beforeAdditionalPlain || []).find(
          (f) =>
            f.sectionKey === it.sectionKey &&
            (f.innerSectionKey || undefined) ===
              (it.innerSectionKey || undefined) &&
            f.fieldKey === it.fieldKey
        ) || null;
      const oldVal = oldEntry ? oldEntry.value : undefined;

      const idx = addList.findIndex(
        (f: any) =>
          f.sectionKey === sectionKey &&
          (f.innerSectionKey || undefined) ===
            (it.innerSectionKey || undefined) &&
          f.fieldKey === it.fieldKey
      );
      if (idx >= 0) {
        addList[idx].value = it.value;
      } else {
        addList.push({ ...it, isShowInProfile: !!(it as any).isShowInProfile });
      }

      recordChange(
        meta,
        buildAdditionalPath(sectionKey, it.innerSectionKey, it.fieldKey),
        oldVal,
        it.value
      );
    }
    employee.markModified("employeeFields.additionalFields");
  }

  const saved = await employee.save();

  // Audit log
  void logUpdate({
    tenantId,
    branchId,
    subjectUserId: String(saved.employeeProfile),
    subjectUserName: String(
      saved.employeeFields.personaldetails.firstname +
        " " +
        saved.employeeFields.personaldetails.lastname
    ),
    aggregateType: "Employee",
    aggregateId: saved._id,
    sectionKey,
    isAdditional: false,
    changes: auditChanges,
    audit,
  });

  // 🔔 Create notification for employer about employee data change
  try {
    if (auditChanges.length > 0) {
      const employeeName = String(
        saved.employeeFields.personaldetails.firstname +
          " " +
          saved.employeeFields.personaldetails.lastname
      );

      // Helper functions for grouping changes
      const groupChangesByType = (changes: AuditChange[]) => {
        const documentChanges: AuditChange[] = [];
        const otherChanges: AuditChange[] = [];
        const processedDocumentPaths = new Set<string>();

        for (const change of changes) {
          const isDocumentField = isDocumentFieldChange(change.path);

          if (isDocumentField) {
            // Extract the base document path (without fileId, key, etc.)
            const basePath = getDocumentBasePath(change.path);

            // Only process this document path once
            if (!processedDocumentPaths.has(basePath)) {
              processedDocumentPaths.add(basePath);
              documentChanges.push({
                path: basePath,
                old: change.old,
                new: change.new,
              });
            }
          } else {
            otherChanges.push(change);
          }
        }

        return { documentChanges, otherChanges };
      };

      const isDocumentFieldChange = (fieldPath: string): boolean => {
        const documentFields = ["fileId", "key", "expiryDate", "issuingDate"];
        const pathParts = fieldPath.split(".");

        return (
          pathParts.some((part) => documentFields.includes(part)) ||
          fieldPath.includes("documents.") ||
          (fieldPath.includes("additionalFields") &&
            pathParts.some((part) => documentFields.includes(part)))
        );
      };

      const getDocumentBasePath = (fieldPath: string): string => {
        const pathParts = fieldPath.split(".");
        const documentFields = ["fileId", "key", "expiryDate", "issuingDate"];

        // Remove technical fields from the end
        while (
          pathParts.length > 0 &&
          documentFields.includes(pathParts[pathParts.length - 1])
        ) {
          pathParts.pop();
        }

        return pathParts.join(".");
      };

      // Group changes by document uploads to avoid multiple notifications
      const { documentChanges, otherChanges } =
        groupChangesByType(auditChanges);

      // Create notifications for document uploads (one per document)
      for (const docChange of documentChanges) {
        await createEmployeeDataChangeNotification({
          tenantId,
          branchId,
          employeeId: saved._id,
          employeeName,
          fieldChanged: docChange.path,
          oldValue: docChange.old,
          newValue: docChange.new,
          actorUserId: audit?.actorUserId,
          actorName: audit?.actor_name,
        });
      }

      // Create notifications for other changes
      for (const change of otherChanges) {
        await createEmployeeDataChangeNotification({
          tenantId,
          branchId,
          employeeId: saved._id,
          employeeName,
          fieldChanged: change.path,
          oldValue: change.old,
          newValue: change.new,
          actorUserId: audit?.actorUserId,
          actorName: audit?.actor_name,
        });
      }
    }
  } catch (notificationError) {
    console.error("Failed to create notification:", notificationError);
    // Don't throw - notification failure shouldn't break the main operation
  }

  const outSection =
    saved.employeeFields?.[sectionKey] &&
    typeof (saved.employeeFields as any)[sectionKey].toObject === "function"
      ? (saved.employeeFields as any)[sectionKey].toObject()
      : toPlain2((saved.employeeFields as any)[sectionKey]);

  return {
    section: sectionKey,
    isAdditional: false,
    employeeFields: { [sectionKey]: outSection },
  } as const;
};

/* --------------------------------------------------
 * Utility used by array-section audit in Step 5.1
 * Provided here for clarity; assumed to be already available in your codebase.
 * Keep this declaration if you don't already have it in scope.
 * -------------------------------------------------- */
function normalizeArrayOfObjectsForAudit(
  arr: Array<Record<string, any>>,
  top: Record<string, any>
) {
  // Safety check: ensure top is an object
  const safeTop = top && typeof top === "object" ? top : {};
  // Stable stringify by sorting keys & normalizing dates via top meta
  return (arr || [])
    .map((row) => {
      // Safety check: ensure row is an object before calling Object.keys
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        return {};
      }
      const out: Record<string, any> = {};
      Object.keys(row)
        .sort()
        .forEach((k) => {
          const meta = safeTop[k];
          out[k] = normalizeForAuditValue(meta, row[k]);
        });
      return out;
    })
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

// old------------------------------------

// export const upsertMyOrgFieldsByBranchId = async ({
//   employeeId,
//   tenantId,
//   branchId,
//   sectionKey,
//   isAdditional,
//   data,
//   items,
//   audit, // optional audit ctx (actor + request meta)
// }: {
//   employeeId: Types.ObjectId;
//   tenantId: Types.ObjectId;
//   branchId: Types.ObjectId;
//   sectionKey: string;
//   isAdditional: boolean;
//   data?: Record<string, any> | any[];
//   items?: Array<{
//     sectionKey: string;
//     innerSectionKey?: string;
//     fieldKey: string;
//     value: any;
//     isShowInProfile?: boolean;
//   }>;
//   audit?: {
//     actorUserId?: string | Types.ObjectId;
//     actorEmail?: string;
//     route?: string;
//     method?: string;
//     ip?: string;
//     ua?: string;
//   };
// }) => {
//   // 1) Load employee and validate scope
//   const employee = await EmployeeModel.findOne({
//     employeeProfile: employeeId,
//     tenantId,
//     branchId,
//   });

//   if (!employee) {
//     const err: any = new Error("Employee not found");
//     err.status = 404;
//     throw err;
//   }
//   if (!employee.tenantId.equals(tenantId)) {
//     const err: any = new Error("Forbidden (tenant mismatch)");
//     err.status = 403;
//     throw err;
//   }
//   if (!employee.branchId.equals(branchId)) {
//     const err: any = new Error("Forbidden (branch mismatch)");
//     err.status = 403;
//     throw err;
//   }

//   // 2) Load config
//   const config = await EmployeeFieldConfig.findOne({
//     tenantId,
//     branchId,
//   }).lean();

//   if (!config) {
//     const err: any = new Error("Employee field config not found");
//     err.status = 400;
//     throw err;
//   }

//   const cfgSection = (config.sections || []).find(
//     (s: any) => s.sectionKey === sectionKey
//   );
//   if (!cfgSection) {
//     const err: any = new Error("Invalid sectionKey");
//     err.status = 400;
//     throw err;
//   }

//   if (cfgSection.employeerOnlyEditable === true) {
//     const err: any = new Error("This section is employer-only");
//     err.status = 403;
//     throw err;
//   }

//   // Ensure containers
//   employee.employeeFields = employee.employeeFields || {};
//   employee.employeeFields.additionalFields =
//     employee.employeeFields.additionalFields || [];

//   // Snapshot BEFORE state for diffs
//   const beforeSectionPlain = toPlain2(
//     (employee.employeeFields as any)[sectionKey]
//   );
//   const beforeAdditionalPlain = toPlain2(
//     employee.employeeFields.additionalFields
//   ) as Array<{
//     sectionKey: string;
//     innerSectionKey?: string;
//     fieldKey: string;
//     value: any;
//     isShowInProfile?: boolean;
//   }>;

//   // Accumulate diffs
//   type AuditChange = { path: string; old: any; new: any };
//   const auditChanges: AuditChange[] = [];

//   /* =======================
//      CASE A: Additional fields
//      ======================= */
//   if (isAdditional) {
//     const { top, inner } = buildAdditionalFieldMaps2(cfgSection);
//     const addList = employee.employeeFields.additionalFields as any[];

//     const metaOf = (it: { innerSectionKey?: string; fieldKey: string }) =>
//       it.innerSectionKey
//         ? inner[it.innerSectionKey!]?.[it.fieldKey]
//         : top[it.fieldKey];

//     const findIdx = (
//       list: any[],
//       it: { innerSectionKey?: string; fieldKey: string }
//     ) =>
//       list.findIndex(
//         (f) =>
//           f.sectionKey === sectionKey &&
//           (f.innerSectionKey || undefined) ===
//             (it.innerSectionKey || undefined) &&
//           f.fieldKey === it.fieldKey
//       );

//     for (const it of items || []) {
//       if (it.sectionKey !== sectionKey) {
//         const err: any = new Error("All items must match the sectionKey");
//         err.status = 400;
//         throw err;
//       }

//       const meta = metaOf(it);
//       if (!meta) {
//         const err: any = new Error(
//           `Invalid fieldKey "${it.fieldKey}" for section "${sectionKey}"` +
//             (it.innerSectionKey ? ` innerSection "${it.innerSectionKey}"` : "")
//         );
//         err.status = 400;
//         throw err;
//       }

//       if (!meta.isAdditional) {
//         const err: any = new Error(
//           `Field "${it.fieldKey}" is not additional in config`
//         );
//         err.status = 400;
//         throw err;
//       }
//       if (meta.employerOnly === true) {
//         const err: any = new Error(`Field "${it.fieldKey}" is employer-only`);
//         err.status = 403;
//         throw err;
//       }

//       // BEFORE value
//       const prevIdx = findIdx(beforeAdditionalPlain || [], it);
//       const oldValRaw =
//         prevIdx >= 0 ? beforeAdditionalPlain[prevIdx].value : undefined;

//       // DELETE semantics
//       const toDelete =
//         it.value === null ||
//         it.value === undefined ||
//         (typeof it.value === "string" && it.value.trim() === "");

//       // Apply mutation
//       const curIdx = findIdx(addList, it);
//       if (toDelete) {
//         if (curIdx >= 0) addList.splice(curIdx, 1);
//       } else if (curIdx >= 0) {
//         addList[curIdx].value = it.value;
//         if (typeof it.isShowInProfile === "boolean") {
//           addList[curIdx].isShowInProfile = it.isShowInProfile;
//         }
//       } else {
//         addList.push({
//           sectionKey,
//           innerSectionKey: it.innerSectionKey,
//           fieldKey: it.fieldKey,
//           value: it.value,
//           isShowInProfile: !!it.isShowInProfile,
//         });
//       }

//       // Diff record (date-aware)
//       const newValRaw = toDelete ? null : it.value;
//       if (!isEqualForAudit(meta, oldValRaw, newValRaw)) {
//         auditChanges.push({
//           path: buildAdditionalPath(
//             sectionKey,
//             it.innerSectionKey,
//             it.fieldKey
//           ),
//           old: normalizeForAuditValue(meta, oldValRaw),
//           new: normalizeForAuditValue(meta, newValRaw),
//         });
//       }
//     }

//     employee.markModified("employeeFields.additionalFields");
//     const saved = await employee.save();

//     // Reusable audit logger
//     void logUpdate({
//       tenantId,
//       branchId,
//       subjectUserId: String(saved.employeeProfile),
//       subjectUserName: String(
//         saved.employeeFields.personaldetails.firstname +
//           " " +
//           saved.employeeFields.personaldetails.lastname
//       ),
//       aggregateType: "Employee",
//       aggregateId: saved._id,
//       sectionKey,
//       isAdditional: true,
//       changes: auditChanges,
//       audit,
//     });

//     return {
//       section: sectionKey,
//       isAdditional: true,
//       employeeFields: {
//         additionalFields: (saved.employeeFields.additionalFields || [])
//           .filter((f: any) => f.sectionKey === sectionKey)
//           .map(toPlain2),
//       },
//     };
//   }

//   /* ==========================================
//      CASE B: Structured sections (NOT additional)
//      ========================================== */
//   const { top, inner } = buildStructuredMaps(cfgSection);

//   const rejectForbidden = (keys: string[]) => {
//     const err: any = new Error(
//       `You are not allowed to modify employer-only fields: ${keys.join(", ")}`
//     );
//     err.status = 403;
//     throw err;
//   };

//   // -------- Array-shaped section (e.g., address[]) --------
//   if (Array.isArray(data)) {
//     const allowed = new Set<string>(Object.keys(top));
//     const extra = EXTRA_WHITELIST_BY_SECTION[sectionKey] || new Set<string>();
//     const forbiddenKeys: string[] = [];

//     for (const row of data) {
//       if (row && typeof row === "object" && !Array.isArray(row)) {
//         for (const k of Object.keys(row)) {
//           if (k === "_id" || k === "id") continue;
//           if (!allowed.has(k) && !extra.has(k)) {
//             const err: any = new Error(
//               `Invalid field "${k}" for section "${sectionKey}"`
//             );
//             err.status = 400;
//             throw err;
//           }
//           const meta = top[k];
//           if (meta?.employerOnly) forbiddenKeys.push(k);
//         }
//       }
//     }
//     if (forbiddenKeys.length) rejectForbidden([...new Set(forbiddenKeys)]);

//     const sanitized = (data as any[])
//       .map((row) => {
//         const out: Record<string, any> = {};
//         if (!row || typeof row !== "object" || Array.isArray(row)) return out;
//         for (const [k, raw] of Object.entries(row)) {
//           if (k === "_id" || k === "id") continue;
//           if (!allowed.has(k) && !extra.has(k)) continue;
//           const meta = top[k];
//           const v = normalizeForField(meta, raw);
//           if (v !== undefined) out[k] = v;
//         }
//         return out;
//       })
//       .filter((o) => Object.keys(o).length > 0);

//     // For array sections, compute audit-friendly comparable forms (date fields normalized if any)
//     const beforeArray = Array.isArray(beforeSectionPlain)
//       ? beforeSectionPlain
//       : toPlain2((employee.employeeFields as any)[sectionKey]) || [];

//     const beforeComparable = normalizeArrayOfObjectsForAudit(beforeArray, top);
//     const newComparable = normalizeArrayOfObjectsForAudit(sanitized, top);

//     (employee.employeeFields as any)[sectionKey] = sanitized;
//     employee.markModified(`employeeFields.${sectionKey}`);

//     if (!isEqual(beforeComparable, newComparable)) {
//       auditChanges.push({
//         path: sectionKey, // e.g., "address"
//         old: beforeComparable,
//         new: newComparable,
//       });
//     }

//     const saved = await employee.save();

//     // Reusable audit logger
//     void logUpdate({
//       tenantId,
//       branchId,
//       subjectUserId: String(saved.employeeProfile),
//       subjectUserName: String(
//         saved.employeeFields.personaldetails.firstname +
//           " " +
//           saved.employeeFields.personaldetails.lastname
//       ),
//       aggregateType: "Employee",
//       aggregateId: saved._id,
//       sectionKey,
//       isAdditional: false,
//       changes: auditChanges,
//       audit,
//     });

//     return {
//       section: sectionKey,
//       isAdditional: false,
//       employeeFields: {
//         [sectionKey]: toPlain2((saved.employeeFields as any)[sectionKey]),
//       },
//     };
//   }

//   // -------- Object-shaped section --------
//   const incoming = (data || {}) as Record<string, any>;
//   const acceptedObj: Record<string, any> = {};
//   const spillToAdditional: any[] = [];
//   const forbiddenTouched: string[] = [];
//   const unknownKeys: string[] = [];

//   for (const [k, raw] of Object.entries(incoming)) {
//     if (top[k]) {
//       const meta = top[k];
//       const v = normalizeForField(meta, raw);
//       if (v === undefined) continue;

//       if (meta.isAdditional) {
//         if (meta.employerOnly) {
//           forbiddenTouched.push(k);
//         } else {
//           spillToAdditional.push({ sectionKey, fieldKey: k, value: v });
//         }
//       } else if (meta.employerOnly) {
//         forbiddenTouched.push(k);
//       } else {
//         acceptedObj[k] = v;
//       }
//       continue;
//     }

//     if (inner[k] && raw && typeof raw === "object" && !Array.isArray(raw)) {
//       const acceptedInner: Record<string, any> = {};
//       for (const [innerFieldKey, innerRaw] of Object.entries(raw)) {
//         const meta = inner[k][innerFieldKey];
//         if (!meta) {
//           unknownKeys.push(`${k}.${innerFieldKey}`);
//           continue;
//         }
//         const v = normalizeForField(meta, innerRaw);
//         if (v === undefined) continue;

//         if (meta.isAdditional) {
//           if (meta.employerOnly) {
//             forbiddenTouched.push(`${k}.${innerFieldKey}`);
//           } else {
//             spillToAdditional.push({
//               sectionKey,
//               innerSectionKey: k,
//               fieldKey: innerFieldKey,
//               value: v,
//             });
//           }
//         } else if (meta.employerOnly) {
//           forbiddenTouched.push(`${k}.${innerFieldKey}`);
//         } else {
//           acceptedInner[innerFieldKey] = v;
//         }
//       }
//       if (Object.keys(acceptedInner).length > 0) {
//         const prevGroup =
//           toPlain2(employee.employeeFields?.[sectionKey]?.[k]) || {};
//         acceptedObj[k] = { ...prevGroup, ...acceptedInner };
//       }
//       continue;
//     }

//     unknownKeys.push(k);
//   }

//   if (unknownKeys.length > 0) {
//     const err: any = new Error(
//       `Invalid field(s) for section "${sectionKey}": ${unknownKeys.join(", ")}`
//     );
//     err.status = 400;
//     throw err;
//   }
//   if (forbiddenTouched.length) {
//     const uniqueKeys = [...new Set(forbiddenTouched)];
//     const err: any = new Error(
//       `You are not allowed to modify employer-only fields: ${uniqueKeys.join(
//         ", "
//       )}`
//     );
//     err.status = 403;
//     throw err;
//   }

//   // Per-field diffs against BEFORE snapshot (date-aware)
//   const beforeObj = (beforeSectionPlain as any) || {};
//   for (const [k, v] of Object.entries(acceptedObj)) {
//     const p = `${sectionKey}.${k}`;
//     const meta = top[k]; // meta for this top-level field if present
//     const oldVal = get({ [sectionKey]: beforeObj }, p);

//     if (!isEqualForAudit(meta, oldVal, v)) {
//       auditChanges.push({
//         path: p,
//         old: normalizeForAuditValue(meta, oldVal),
//         new: normalizeForAuditValue(meta, v),
//       });
//     }
//   }

//   // Merge and save
//   const currentValue = (employee.employeeFields as any)[sectionKey];
//   const currentPlain = toPlain2(currentValue) || {};
//   const merged = { ...currentPlain, ...acceptedObj };
//   pruneUndefinedDeep(merged);

//   (employee.employeeFields as any)[sectionKey] = merged;
//   employee.markModified(`employeeFields.${sectionKey}`);

//   // Handle spill -> additional (also diff vs BEFORE additional)
//   if (spillToAdditional.length) {
//     const addList = employee.employeeFields.additionalFields as any[];

//     for (const it of spillToAdditional) {
//       const meta = it.innerSectionKey?.length
//         ? inner[it.innerSectionKey!]?.[it.fieldKey]
//         : top[it.fieldKey];

//       const oldEntry =
//         (beforeAdditionalPlain || []).find(
//           (f) =>
//             f.sectionKey === it.sectionKey &&
//             (f.innerSectionKey || undefined) ===
//               (it.innerSectionKey || undefined) &&
//             f.fieldKey === it.fieldKey
//         ) || null;
//       const oldVal = oldEntry ? oldEntry.value : undefined;

//       const idx = addList.findIndex(
//         (f: any) =>
//           f.sectionKey === sectionKey &&
//           (f.innerSectionKey || undefined) ===
//             (it.innerSectionKey || undefined) &&
//           f.fieldKey === it.fieldKey
//       );
//       if (idx >= 0) {
//         addList[idx].value = it.value;
//       } else {
//         addList.push({
//           ...it,
//           isShowInProfile: !!(it as any).isShowInProfile,
//         });
//       }

//       if (!isEqualForAudit(meta, oldVal, it.value)) {
//         auditChanges.push({
//           path: buildAdditionalPath(
//             sectionKey,
//             it.innerSectionKey,
//             it.fieldKey
//           ),
//           old: normalizeForAuditValue(meta, oldVal),
//           new: normalizeForAuditValue(meta, it.value),
//         });
//       }
//     }
//     employee.markModified("employeeFields.additionalFields");
//   }

//   const saved = await employee.save();

//   // Reusable audit logger
//   void logUpdate({
//     tenantId,
//     branchId,
//     subjectUserId: String(saved.employeeProfile),
//     subjectUserName: String(
//       saved.employeeFields.personaldetails.firstname +
//         " " +
//         saved.employeeFields.personaldetails.lastname
//     ),
//     aggregateType: "Employee",
//     aggregateId: saved._id,
//     sectionKey,
//     isAdditional: false,
//     changes: auditChanges,
//     audit,
//   });

//   const outSection =
//     saved.employeeFields?.[sectionKey] &&
//     typeof (saved.employeeFields as any)[sectionKey].toObject === "function"
//       ? (saved.employeeFields as any)[sectionKey].toObject()
//       : toPlain2((saved.employeeFields as any)[sectionKey]);

//   return {
//     section: sectionKey,
//     isAdditional: false,
//     employeeFields: { [sectionKey]: outSection },
//   };
// };
