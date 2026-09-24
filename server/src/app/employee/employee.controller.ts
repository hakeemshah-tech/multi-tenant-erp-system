import { Request, Response } from "express";
import { isValidObjectId, Types } from "mongoose";
import { WithUser } from "@/common/middlewares/authMiddleware";
import * as employeeService from "./employee.service";
import { CreateEmployeeInput } from "./employee.types";
import EmployeeModel from "@/database/models/employee.model";
import { EmployeeProfile } from "@/database/models/employeeProfile.model";

/**
 * @desc Create new employee
 * @route POST /employees
 */
export const createEmployee = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);

  console.log(tenantId, branchId, "please");

  const data: CreateEmployeeInput = req.body;
  const employee = await employeeService.createEmployee({
    tenantId,
    branchId,
    data,
  });

  return res.status(201).json({
    message: "Employee created successfully",
    data: employee,
  });
};

/**
 * @desc Get all employees for a branch (excluding soft-deleted)
 * @route GET /employees
 */
export const getEmployees = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);

  // Get pagination params
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = (req.query.search as string) || "";
  const employmentStatus = (req.query.employmentStatus as string) || "";

  const currentUserId = new Types.ObjectId(req.user.userId);

  // Skip permission checks for tenant-owner, admin, and platform admin
  const userRole = req.user.activeAssignment?.role || req.user.role;
  const skipPermissionCheck =
    userRole === "tenant-owner" ||
    userRole === "admin" ||
    req.user.isPlatformAdmin === true;

  const result = await employeeService.getEmployeesWithPagination({
    tenantId,
    branchId,
    page,
    limit,
    search,
    employmentStatus,
    currentUserId,
    skipPermissionCheck,
  });

  return res.status(200).json({
    message: "Employees fetched successfully",
    data: result.data,
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
};

/**
 * @desc Get section-level permissions for viewing an employee's details
 * @route GET /employees/:id/section-permissions
 */
export const getEmployeeSectionPermissions = async (
  req: WithUser,
  res: Response
) => {
  const employeeId = new Types.ObjectId(req.params.id);
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const currentUserId = new Types.ObjectId(req.user.userId);

  // Check if user is tenant-owner, admin, platform admin, or system admin - if so, grant full access
  const userRole = req.user.activeAssignment?.role || req.user.role;
  const isTenantOwnerOrAdmin =
    userRole === "tenant-owner" ||
    userRole === "admin" ||
    req.user.isPlatformAdmin === true;

  let isSystemAdmin = false;
  if (!isTenantOwnerOrAdmin) {
    try {
      const { getAggregatedRoles } =
        await import("./employeePermission.service");
      const aggregatedRoles = await getAggregatedRoles(
        currentUserId,
        tenantId,
        branchId
      );
      isSystemAdmin = aggregatedRoles.isSystemAdmin;
    } catch (error) {
      console.warn("Could not get aggregated roles for user:", error);
    }
  }

  // If tenant-owner/admin/platform-admin/system-admin, return full access for all sections
  if (isTenantOwnerOrAdmin || isSystemAdmin) {
    // Get employee to get their designation
    const employee = await employeeService.getEmployeeById(employeeId);
    if (!employee) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    // Get employee's designation ID (same as frontend does)
    const designationId =
      employee.designation?._id || employee.designation || null;
    const designationIdStr = designationId ? designationId.toString() : null;

    // Get config using the same service method as frontend (handles designation filtering)
    const { getConfigForEmployee } =
      await import("@/app/employeeFieldConfig/employeeFieldConfig.service");
    const config = await getConfigForEmployee(
      tenantId,
      branchId,
      designationIdStr
    );

    const sectionPermissions: {
      [sectionKey: string]: { read: boolean; write: boolean };
    } = {};

    // Handle both array and object config formats
    const sections = Array.isArray(config)
      ? config
      : config && (config as any).sections
        ? (config as any).sections
        : [];

    if (sections && sections.length > 0) {
      sections.forEach((section: any) => {
        sectionPermissions[section.sectionKey] = {
          read: true,
          write: true,
        };
      });
    }

    return res.status(200).json({
      message: "Section permissions fetched successfully",
      data: {
        sectionPermissions,
      },
    });
  }

  // For regular employees, check permissions and data access levels
  try {
    // Get employee to check their level
    const employee = await employeeService.getEmployeeById(employeeId);
    if (!employee) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    // Check if employee belongs to the same tenant/branch
    if (
      employee.tenantId.toString() !== tenantId.toString() ||
      employee.branchId.toString() !== branchId.toString()
    ) {
      return res.status(403).json({
        message: "Access denied: Employee does not belong to your organization",
      });
    }

    // Get employee's designation ID (same as frontend does)
    const designationId =
      employee.designation?._id || employee.designation || null;
    const designationIdStr = designationId ? designationId.toString() : null;

    // Get user's permissions (ignore data access levels for now)
    const { getEmployeePermissions } =
      await import("./employeePermission.service");
    const { permissions: userPermissions } = await getEmployeePermissions(
      currentUserId,
      tenantId,
      branchId
    );

    // Get config using the same service method as frontend (handles designation filtering)
    const { getConfigForEmployee } =
      await import("@/app/employeeFieldConfig/employeeFieldConfig.service");
    const config = await getConfigForEmployee(
      tenantId,
      branchId,
      designationIdStr
    );

    const sectionPermissions: {
      [sectionKey: string]: { read: boolean; write: boolean };
    } = {};

    // Handle both array and object config formats
    const sections = Array.isArray(config)
      ? config
      : config && (config as any).sections
        ? (config as any).sections
        : [];

    if (sections && sections.length > 0) {
      sections.forEach((section: any) => {
        const sectionKey = section.sectionKey;
        const sectionPerm = userPermissions.permissions[sectionKey];

        // Check read permission (ignore data access level for now)
        const canRead = sectionPerm?.read === true;

        // Check write permission (ignore data access level for now)
        const canWrite = sectionPerm?.write === true;

        sectionPermissions[sectionKey] = {
          read: canRead,
          write: canWrite,
        };
      });
    }

    console.log("🔍 Backend - Final section permissions:", sectionPermissions);

    return res.status(200).json({
      message: "Section permissions fetched successfully",
      data: {
        sectionPermissions,
      },
    });
  } catch (error: any) {
    console.error("Error getting section permissions:", error);
    return res.status(500).json({
      message: error.message || "Failed to get section permissions",
    });
  }
};

/**
 * @desc Get single employee by ID (only if not soft-deleted)
 * @route GET /employees/:id
 */
export const getEmployeeById = async (req: WithUser, res: Response) => {
  const id = new Types.ObjectId(req.params.id);
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const currentUserId = new Types.ObjectId(req.user.userId);

  const employee = await employeeService.getEmployeeById(id);

  if (!employee) {
    return res.status(404).json({
      message: "Employee not found",
    });
  }

  // Check if employee belongs to the same tenant/branch
  if (
    employee.tenantId.toString() !== tenantId.toString() ||
    employee.branchId.toString() !== branchId.toString()
  ) {
    return res.status(403).json({
      message: "Access denied: Employee does not belong to your organization",
    });
  }

  // Check if user is tenant-owner, admin, platform admin, or system admin - if so, grant full access
  const userRole = req.user.activeAssignment?.role || req.user.role;
  const isTenantOwnerOrAdmin =
    userRole === "tenant-owner" ||
    userRole === "admin" ||
    req.user.isPlatformAdmin === true;

  let isSystemAdmin = false;
  if (!isTenantOwnerOrAdmin) {
    // Only check for system admin if not already tenant-owner/admin
    try {
      const { getAggregatedRoles } =
        await import("./employeePermission.service");
      const aggregatedRoles = await getAggregatedRoles(
        currentUserId,
        tenantId,
        branchId
      );
      isSystemAdmin = aggregatedRoles.isSystemAdmin;
    } catch (error) {
      // If getAggregatedRoles fails, user might not have employee record
      // Continue with permission checks - not system admin
      console.warn("Could not get aggregated roles for user:", error);
    }
  }

  // Tenant-owner, admin, platform admin, and system admin have full access - skip all permission checks
  if (isTenantOwnerOrAdmin || isSystemAdmin) {
    return res.status(200).json({
      message: "Employee fetched successfully",
      data: employee,
    });
  }

  // For non-system-admin users, filter employeeFields based on section-level read permissions
  // Get user's permissions
  const { getEmployeePermissions } =
    await import("./employeePermission.service");
  const { permissions: userPermissions } = await getEmployeePermissions(
    currentUserId,
    tenantId,
    branchId
  );

  // Filter employeeFields based on read permissions
  let filteredEmployee = employee;
  if (employee.employeeFields) {
    const filteredEmployeeFields: any = {};

    // Filter main sections (personaldetails, address, employeedetails, etc.)
    Object.keys(employee.employeeFields).forEach((sectionKey) => {
      // Skip additionalFields - we'll handle it separately
      if (sectionKey === "additionalFields") {
        return;
      }

      // Check if user has read permission for this section
      const sectionPerm = userPermissions.permissions[sectionKey];
      const canRead = sectionPerm?.read === true;

      if (canRead) {
        filteredEmployeeFields[sectionKey] =
          employee.employeeFields[sectionKey];
      }
    });

    // Filter additionalFields array - only include items for sections user has read access to
    if (Array.isArray(employee.employeeFields.additionalFields)) {
      filteredEmployeeFields.additionalFields =
        employee.employeeFields.additionalFields.filter((field: any) => {
          const sectionKey = field.sectionKey;
          const sectionPerm = userPermissions.permissions[sectionKey];
          return sectionPerm?.read === true;
        });
    }

    // Create new employee object with filtered employeeFields
    filteredEmployee = {
      ...employee,
      employeeFields: filteredEmployeeFields,
    };
  }

  return res.status(200).json({
    message: "Employee fetched successfully",
    data: filteredEmployee,
  });
};

/**
 * @desc Update an employee
 * @route PUT /employees/:id
 */
export const updateEmployee = async (req: WithUser, res: Response) => {
  const id = new Types.ObjectId(req.params.id);
  const data = req.body;

  // Convert additionalDesignationIds from strings to ObjectIds if provided
  if (
    data.additionalDesignationIds &&
    Array.isArray(data.additionalDesignationIds)
  ) {
    data.additionalDesignationIds = data.additionalDesignationIds.map(
      (designationId: string) => new Types.ObjectId(designationId)
    );
  }

  const updated = await employeeService.updateEmployee(id, data);

  return res.status(200).json({
    message: "Employee updated successfully",
    data: updated,
  });
};

/**
 * @desc Soft delete an employee
 * @route DELETE /employees/:id
 */
export const deleteEmployee = async (req: WithUser, res: Response) => {
  const id = new Types.ObjectId(req.params.id);
  await employeeService.deleteEmployee(id);

  return res.status(200).json({
    message: "Employee soft deleted successfully",
  });
};

/**
 * @desc Upsert employer-only additional fields for a section
 * @route PUT /employees/:id/employeer-only-fields
 */
export const upsertEmployeerOnlyFields = async (
  req: WithUser,
  res: Response
) => {
  const employeeId = new Types.ObjectId(req.params.id);
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);

  const { sectionKey, items } = req.body as {
    sectionKey: string;
    items: Array<{
      sectionKey: string;
      innerSectionKey?: string;
      fieldKey: string;
      value: any;
    }>;
  };

  if (!sectionKey || !Array.isArray(items)) {
    return res.status(400).json({
      message:
        "Invalid payload. Expected { sectionKey: string, items: Array<{ sectionKey, innerSectionKey?, fieldKey, value }> }",
    });
  }

  const result = await employeeService.upsertEmployeerOnlyFields({
    employeeId,
    tenantId,
    branchId,
    sectionKey,
    items,
  });

  return res.status(200).json({
    message: "Employer-only fields saved",
    data: result, // will include updated employeerOnlyAdditionalFields
  });
};

/**
 * @desc Update only employeeFields for the logged-in user
 * @route PUT /employees/me/employee-fields
 */
export const updateMyEmployeeFields = async (req: WithUser, res: Response) => {
  // console.log(req.user?.userId, req.user.activeAssignment.tenantId);
  const userId = req.user?.userId;

  // const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  // const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
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

  const { employeeFields } = req.body || {};

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: userId missing" });
  }
  if (!employeeFields || typeof employeeFields !== "object") {
    return res.status(400).json({ message: "employeeFields payload required" });
  }

  const updated = await employeeService.updateEmployeeFieldsByUserId({
    userId: new Types.ObjectId(userId),
    tenantId,
    branchId,
    employeeFields,
  });

  if (!updated) {
    return res
      .status(404)
      .json({ message: "Employee not found for this user/tenant/branch" });
  }

  return res.status(200).json({
    message: "Employee fields updated successfully",
    data: updated,
  });
};

// employee.controller.ts

// employee.controller.ts

/**
 * @desc Upsert employeeFields (includes additionalFields) but diverts employer-only fields
 * @route PUT /employees/:id/employee-fields
 */
export const upsertEmployeeFields = async (req: WithUser, res: Response) => {
  const employeeId = new Types.ObjectId(req.params.id);
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const currentUserId = new Types.ObjectId(req.user.userId);

  let { sectionKey, data, items, isAdditional, updatedField } = req.body as {
    sectionKey: string;
    isAdditional?: boolean;
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
  };

  if (!sectionKey) {
    return res.status(400).json({ message: "sectionKey is required" });
  }

  // Check if user is tenant-owner, admin, platform admin, or system admin - if so, grant full access
  const userRole = req.user.activeAssignment?.role || req.user.role;
  const isTenantOwnerOrAdmin =
    userRole === "tenant-owner" ||
    userRole === "admin" ||
    req.user.isPlatformAdmin === true;

  let isSystemAdmin = false;
  if (!isTenantOwnerOrAdmin) {
    try {
      const { getAggregatedRoles } =
        await import("./employeePermission.service");
      const aggregatedRoles = await getAggregatedRoles(
        currentUserId,
        tenantId,
        branchId
      );
      isSystemAdmin = aggregatedRoles.isSystemAdmin;
    } catch (error) {
      console.warn("Could not get aggregated roles for user:", error);
    }
  }

  // For non-full-access users, check write permission for the section being updated
  if (!isTenantOwnerOrAdmin && !isSystemAdmin) {
    const { getEmployeePermissions } =
      await import("./employeePermission.service");
    const { permissions: userPermissions } = await getEmployeePermissions(
      currentUserId,
      tenantId,
      branchId
    );

    const sectionPerm = userPermissions.permissions[sectionKey];
    const canWrite = sectionPerm?.write === true;

    if (!canWrite) {
      return res.status(403).json({
        message: `Access denied: You don't have write permission for ${sectionKey} section`,
      });
    }
  }

  if (isAdditional) {
    if (!Array.isArray(items)) {
      return res.status(400).json({
        message:
          "Invalid payload. Expected { sectionKey, isAdditional: true, items: Array<{ sectionKey, innerSectionKey?, fieldKey, value, isShowInProfile? }> }",
      });
    }
  } else {
    // ✅ allow arrays specifically for 'address'
    if (sectionKey === "address") {
      if (!Array.isArray(data)) {
        return res.status(400).json({
          message:
            "Invalid payload. Expected { sectionKey: 'address', data: Address[] }",
        });
      }
      // optional: sanitize to avoid persisting ids
      data = (data as any[]).map((a) => {
        if (!a || typeof a !== "object") return {};
        const { _id, id, ...rest } = a;
        return rest;
      });
    } else {
      if (typeof data !== "object" || data == null || Array.isArray(data)) {
        return res.status(400).json({
          message:
            "Invalid payload. Expected { sectionKey, data: object } for non-additional sections",
        });
      }
    }
  }

  const result = await employeeService.upsertEmployeeFields({
    employeeId,
    tenantId,
    branchId,
    sectionKey,
    isAdditional: !!isAdditional,
    data,
    items,
    audit: {
      actorUserId: req.user?.userId,
      actorEmail: req.user?.email,
      route: req.originalUrl,
      method: req.method,
      ip: req.ip,
      ua: req.headers["user-agent"] as string | undefined,
    },
  });

  return res.status(200).json({
    message: "Employee fields saved",
    data: result,
  });
};

/**
 * @desc Get my organization (branch) by id, validating membership via req.user.assignments
 * @route GET /organizations/:id/my
 * @note :id is the BRANCH ID
 */
export const getMyOrganizationById = async (req: WithUser, res: Response) => {
  const branchIdParam = new Types.ObjectId(req.params.id);

  // user + assignments (array)
  // Ensure userId is valid and from the authenticated user
  if (!req.user?.userId) {
    return res.status(401).json({
      message: "Unauthorized: User ID not found in token",
    });
  }

  const userId = new Types.ObjectId(req.user.userId);
  const email = req.user.email;
  const assignments = (req.user.assignments || []) as Array<{
    tenantId: string | Types.ObjectId;
    branchId: string | Types.ObjectId;
    role?: string;
  }>;

  // Normalize branchIdParam to string for comparison
  const branchIdParamStr = String(branchIdParam);

  // validate membership: branch must exist in assignments
  // Convert all branchIds to strings for reliable comparison
  const matched = assignments.find((a) => {
    // Handle both ObjectId instances and strings
    let assignmentBranchId: string;
    if (a.branchId instanceof Types.ObjectId) {
      assignmentBranchId = a.branchId.toString();
    } else if (a.branchId?.toString) {
      assignmentBranchId = a.branchId.toString();
    } else {
      assignmentBranchId = String(a.branchId);
    }
    return assignmentBranchId === branchIdParamStr;
  });

  if (!matched) {
    // Log for debugging
    console.error("Assignment check failed:", {
      userId: req.user.userId,
      email: req.user.email,
      branchIdParam: branchIdParamStr,
      branchIdParamType: typeof branchIdParam,
      assignmentsCount: assignments.length,
      assignments: assignments.map((a) => ({
        tenantId:
          a.tenantId instanceof Types.ObjectId
            ? a.tenantId.toString()
            : a.tenantId?.toString
              ? a.tenantId.toString()
              : String(a.tenantId),
        branchId:
          a.branchId instanceof Types.ObjectId
            ? a.branchId.toString()
            : a.branchId?.toString
              ? a.branchId.toString()
              : String(a.branchId),
        branchIdType:
          a.branchId instanceof Types.ObjectId ? "ObjectId" : typeof a.branchId,
        role: a.role,
      })),
    });

    return res.status(403).json({
      message: "Forbidden: you are not assigned to this organization (branch).",
    });
  }

  const tenantId = new Types.ObjectId(matched.tenantId);
  const branchId = branchIdParam;

  const data = await employeeService.getMyOrganizationById({
    tenantId,
    branchId,
    userId,
    email,
  });

  return res.status(200).json({
    message: "Organization fetched successfully",
    data,
  });
};

/**
 * @desc Employees update their own organization (branch) fields by branchId.
 *       - branchId comes from route param :id
 *       - employeeId comes from req.user
 *       - NEVER updates employer-only fields (403 if attempted)
 * @route PUT /me/org-fields/:id/
 */
export const updateFieldsMyOrganizationById = async (
  req: WithUser,
  res: Response
) => {
  // --- branch param validation
  const branchParam = String(req.params.id || "").trim();
  if (!Types.ObjectId.isValid(branchParam)) {
    return res.status(400).json({ message: "Invalid branch id" });
  }
  const branchIdParam = new Types.ObjectId(branchParam);

  // --- membership validation from assignments (like getMyOrganizationById)
  const userId = new Types.ObjectId(String(req.user.userId));
  const assignments = (req.user.assignments || []) as Array<{
    tenantId: string | Types.ObjectId;
    branchId: string | Types.ObjectId;
    role?: string;
  }>;

  const matched = assignments.find(
    (a) => String(a.branchId) === String(branchIdParam)
  );

  if (!matched) {
    return res.status(403).json({
      message: "Forbidden: you are not assigned to this organization (branch).",
    });
  }

  const tenantId = new Types.ObjectId(String(matched.tenantId));
  const branchId = branchIdParam;

  // --- resolve employeeId for this user+tenant+branch
  // prefer a verified employee id if present on req.user, else look up by userId/tenantId/branchId
  let employeeId: Types.ObjectId | null = null;

  if (userId) {
    const found = await EmployeeProfile.findOne({
      userId,
    })
      .select("_id")
      .lean();

    if (!found?._id) {
      return res.status(404).json({
        message: "Employee record not found for this branch.",
      });
    }
    employeeId = found._id as Types.ObjectId;
  }

  // --- payload validation (unchanged semantics)
  const { sectionKey, data, items, isAdditional, updatedField } = req.body as {
    sectionKey: string;
    isAdditional?: boolean;
    data?: Record<string, any> | any[]; // allow array for address
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
  };

  if (!sectionKey) {
    return res.status(400).json({ message: "sectionKey is required" });
  }

  if (isAdditional) {
    if (!Array.isArray(items)) {
      return res.status(400).json({
        message:
          "Invalid payload. Expected { sectionKey, isAdditional: true, items: Array<{ sectionKey, innerSectionKey?, fieldKey, value, isShowInProfile? }> }",
      });
    }
  } else {
    // ✅ allow arrays specifically for 'address'
    if (sectionKey === "address") {
      if (!Array.isArray(data)) {
        return res.status(400).json({
          message:
            "Invalid payload. Expected { sectionKey: 'address', data: Address[] }",
        });
      }
      // sanitize to avoid persisting ids
      req.body.data = (data as any[]).map((a) => {
        if (!a || typeof a !== "object") return {};
        const { _id, id, ...rest } = a;
        return rest;
      });
    } else {
      if (typeof data !== "object" || data == null || Array.isArray(data)) {
        return res.status(400).json({
          message:
            "Invalid payload. Expected { sectionKey, data: object } for non-additional sections",
        });
      }
    }
  }

  // --- delegate to service (this service already forbids employer-only writes)
  const result = await employeeService.upsertMyOrgFieldsByBranchId({
    employeeId,
    tenantId,
    branchId,
    sectionKey,
    isAdditional: !!isAdditional,
    data,
    items,
    updatedField: updatedField || undefined, // Ensure it's defined or undefined
    audit: {
      actorUserId: req.user?.userId,
      actorEmail: req.user?.email,
      route: req.originalUrl,
      method: req.method,
      ip: req.ip,
      ua: req.headers["user-agent"],
    },
  });

  return res.status(200).json({
    message: "Organization fields saved",
    data: result,
  });
};

/**
 * @desc Restore a soft-deleted employee
 * @route POST /employees/:id/restore
 */
// export const restoreEmployee = async (req: WithUser, res: Response) => {
//   const id = new Types.ObjectId(req.params.id);
//   const restored = await employeeService.restoreEmployee(id);

//   return res.status(200).json({
//     message: "Employee restored successfully",
//     data: restored,
//   });
// };
