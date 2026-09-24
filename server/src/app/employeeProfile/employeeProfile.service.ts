import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "@/database/models/user.model";
import { EmployeeProfile } from "@/database/models/employeeProfile.model";
import EmployeeModel from "@/database/models/employee.model";
import {
  CreateEmployeeInput,
  EmployeeProfileInput,
} from "./employeeProfile.types";
import { findUserByEmail } from "@/database/repositories/user.repository";
import { WithUser } from "@/common/middlewares/authMiddleware";
import { logRegisterEmployee } from "@/audit/auth-audit";

interface CreateEmployeeProfileServiceInput {
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  data: CreateEmployeeInput; // includes email, password, fullName, profile, additionalFields
}

/**
 * Create a new employee user + profile + branch assignment
 */
export const createEmployeeProfile = async ({
  tenantId,
  branchId,
  data,
}: CreateEmployeeProfileServiceInput) => {
  const existingUser = await findUserByEmail(data.email);
  let user;

  const fullName = `${data.firstname} ${data.lastname}`;

  if (existingUser) {
    const alreadyAssigned = existingUser.assignments.some(
      (a) =>
        a.tenantId.toString() === tenantId.toString() &&
        a.branchId.toString() === branchId.toString()
    );

    if (!alreadyAssigned) {
      existingUser.assignments.push({
        tenantId,
        branchId,
        role: "employee",
      });
      await existingUser.save();
    }

    user = existingUser;
  } else {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    user = await User.create({
      fullName,
      email: data.email,
      passwordHash: hashedPassword,
      assignments: [
        {
          tenantId,
          branchId,
          role: "employee",
        },
      ],
      activeAssignment: {
        tenantId,
        branchId,
        role: "employee",
      },
    });
  }

  // Inject firstname and lastname into EmployeeProfile
  const profile: EmployeeProfileInput = {
    ...data.profile,
    personaldetails: {
      ...data.profile?.personaldetails,
      firstname: data.firstname,
      lastname: data.lastname,
    },
  };

  const employeeProfile = await EmployeeProfile.create({
    userId: user._id,
    ...profile,
  });

  // Build employeeFields to mirror EmployeeProfile data
  // Merge location and state from main into personaldetails if they exist
  const personaldetails = {
    ...(profile.personaldetails || {}),
    ...(profile.main?.location && { location: profile.main.location }),
    ...(profile.main?.state && { state: profile.main.state }),
  };

  const employeeFields: any = {
    personaldetails,
    address: profile.address || [],
    documents: profile.documents || {
      identificationdocuments: {},
      certificates: {},
      checksandclearance: {},
    },
    additionalFields: profile.additionalFields || [],
  };

  const employee = await EmployeeModel.create({
    tenantId,
    branchId,
    designation: data.designationId,
    employeeProfile: employeeProfile._id,
    employeeFields,
    additionalFields: data.additionalFields || {},
  });

  return { user, employee, employeeProfile };
};

/**
 * Get employee profile by user ID
 */
export const getEmployeeProfileByUser = async (userId: Types.ObjectId) => {
  console.log(userId, "userId");
  return await EmployeeProfile.findOne({ userId }).lean();
};

/**
 * Get employee profile by profile ID
 */
export const getEmployeeProfileById = async (id: Types.ObjectId) => {
  return await EmployeeProfile.findById(id).lean();
};

/**
 * Update employee profile
 */
export const updateEmployeeProfile = async (
  id: Types.ObjectId,
  updates: Partial<EmployeeProfileInput>
) => {
  return await EmployeeProfile.findByIdAndUpdate(id, updates, { new: true });
};

/**
 * Delete employee profile
 */
export const deleteEmployeeProfile = async (id: Types.ObjectId) => {
  return await EmployeeProfile.findByIdAndDelete(id);
};

/**
 * Register an employee profile for a newbie user
 */
export const registerSelfProfile = async (
  userId: string,
  data: EmployeeProfileInput
) => {
  const user = await User.findById(userId);
  if (!user || user.isDeleted) throw new Error("User not found");

  const alreadyHasProfile = await EmployeeProfile.findOne({ userId });
  if (alreadyHasProfile) throw new Error("Profile already exists");

  // Create employee profile
  const profile = await EmployeeProfile.create({
    userId: user._id,
    ...data,
  });

  // Set the user mode (your current behavior)
  user.currentMode = "nexus-profile";
  await user.save();

  // 🔐 AUDIT: Register employee; op will be "register-employee" if mode is "employee",
  // otherwise "register". We're passing the mode you actually set ("nexus-profile")
  // so the logger picks the correct op label.
  try {
    const tenantId =
      (user.activeAssignment as any)?.tenantId?.toString?.() ?? null;
    const branchId =
      (user.activeAssignment as any)?.branchId?.toString?.() ?? null;

    await logRegisterEmployee({
      // no req here in this service signature; omit safely
      req: null,
      userId: user._id.toString(),
      email: user.email,
      fullName: user.fullName ?? null,
      tenantId,
      branchId,
      mode: user.currentMode || "nexus-profile",
      profilePreview: {
        firstname: data?.personaldetails?.firstname ?? null,
        lastname: data?.personaldetails?.lastname ?? null,
        mobile: data?.personaldetails?.mobile ?? null,
      },
    });
  } catch (e) {
    // Never block the core flow on audit logging
    console.error("[audit] logRegisterEmployee failed:", e);
  }

  return profile;
};

/**
 * Get all organization attached to this employee prfofile
 */
export const getOrganizationsByProfile = async (
  employeeProfileId: Types.ObjectId
) => {
  const employees = await EmployeeModel.find({
    employeeProfile: employeeProfileId,
    isDeleted: false,
  })
    .populate("tenantId")
    .populate("branchId")
    .populate("designation")
    .populate({
      path: "additionalDesignationIds",
      select: "name _id",
    })
    .lean();

  // Populate additionalRoleIds with role objects
  // Group employees by tenant/branch to fetch roles efficiently
  const tenantBranchMap = new Map<
    string,
    { tenantId: Types.ObjectId; branchId: Types.ObjectId; roleIds: Set<string> }
  >();

  // Collect all unique roleIds per tenant/branch
  employees.forEach((emp: any) => {
    if (!emp.tenantId || !emp.branchId || !emp.additionalRoleIds?.length)
      return;

    const key = `${emp.tenantId._id || emp.tenantId}-${emp.branchId._id || emp.branchId}`;
    if (!tenantBranchMap.has(key)) {
      tenantBranchMap.set(key, {
        tenantId: new Types.ObjectId(emp.tenantId._id || emp.tenantId),
        branchId: new Types.ObjectId(emp.branchId._id || emp.branchId),
        roleIds: new Set<string>(),
      });
    }
    emp.additionalRoleIds?.forEach((roleId: string) => {
      tenantBranchMap.get(key)!.roleIds.add(roleId.toLowerCase().trim());
    });
  });

  // Fetch all roles for each tenant/branch combination
  const { Role } = await import("@/database/models/role.model");
  const rolesMap = new Map<string, Map<string, any>>(); // tenantBranchKey -> roleId -> role

  for (const [
    key,
    { tenantId, branchId, roleIds },
  ] of tenantBranchMap.entries()) {
    if (roleIds.size === 0) continue;

    const roles = await Role.find({
      tenantId,
      branchId,
      roleId: { $in: Array.from(roleIds) },
      isDeleted: false,
    })
      .select("roleId name color level")
      .lean();

    const roleMap = new Map<string, any>();
    roles.forEach((role: any) => {
      roleMap.set(role.roleId.toLowerCase().trim(), {
        roleId: role.roleId,
        name: role.name,
        color: role.color,
        level: role.level,
      });
    });
    rolesMap.set(key, roleMap);
  }

  // Attach populated roles to each employee
  const employeesWithPopulatedRoles = employees.map((emp: any) => {
    if (!emp.additionalRoleIds?.length || !emp.tenantId || !emp.branchId) {
      return emp;
    }

    const key = `${emp.tenantId._id || emp.tenantId}-${emp.branchId._id || emp.branchId}`;
    const roleMap = rolesMap.get(key);

    if (!roleMap) {
      return emp;
    }

    const populatedRoles = emp.additionalRoleIds
      .map((roleId: string) => {
        const normalizedRoleId = roleId.toLowerCase().trim();
        return roleMap.get(normalizedRoleId) || null;
      })
      .filter((r: any) => r !== null);

    return {
      ...emp,
      additionalRoleIds:
        populatedRoles.length > 0 ? populatedRoles : emp.additionalRoleIds, // Keep original if no matches found
    };
  });

  return employeesWithPopulatedRoles;
};

/**
 * Update employee profile auto save by logged-in user
 */
export const updateSelfProfileAutoSave = async (
  userId: string,
  updates: Partial<EmployeeProfileInput>
) => {
  console.log(updates, "getting...", userId);
  const profile = await EmployeeProfile.findOneAndUpdate({ userId }, updates, {
    new: true,
  });

  if (!profile) throw new Error("Profile not found");

  return profile;
};

/**
 * Update employee profile by logged-in user
 */
export const updateSelfProfile = async (
  userId: string,
  updates: Partial<EmployeeProfileInput>
) => {
  console.log(updates, "getting...", userId);
  const profile = await EmployeeProfile.findOneAndUpdate({ userId }, updates, {
    new: true,
  });

  if (!profile) throw new Error("Profile not found");

  return profile;
};
