import crypto from "crypto";
import { Types } from "mongoose";
import EmployeeInvitationModel from "./employeeInvitation.model";
import { sendInviteEmail } from "@/common/utils/mailer";
import EmployeeModel from "@/database/models/employee.model";
import { EmployeeProfile } from "@/database/models/employeeProfile.model";
import { User } from "@/database/models/user.model";
import EmployeeFieldConfig from "@/database/models/EmployeeFieldConfig";
import { Designation } from "@/database/models/designation.model";
import { AppError } from "@/common/utils/app-error";
import {
  logInvitationAccepted,
  logInvitationSent,
} from "@/audit/invitation-audit";
import { logAudit } from "@/audit/auth-audit";
import * as employeeFieldConfigService from "@/app/employeeFieldConfig/employeeFieldConfig.service";

type ProfileLike = Record<string, any>;

const isNonEmpty = (v: any) => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
};

const coerceBoolean = (v: any) => v === true;

// 👇 helper: treat any of these flags as “employer-only: hide/skip from employee flow”
const isEmployerOnlySection = (section: any) =>
  !!section?.employeerOnlyEditable;

/** Evaluate showIf rule against the profile/additionalFields */
function showIfPasses(
  profile: ProfileLike,
  additionalFields:
    | Array<{
        sectionKey?: string;
        innerSectionKey?: string;
        fieldKey: string;
        value: any;
      }>
    | undefined,
  sectionKey: string,
  innerSectionKey: string | undefined,
  rule?: { fieldKey: string; operator: "equals" | "notEquals"; value: any }
): boolean {
  if (!rule) return true; // no condition -> validate
  // 1) Try in the same section/innerSection path first
  const direct = getValueFromProfile(
    profile,
    sectionKey,
    innerSectionKey,
    rule.fieldKey
  );
  const directExists = direct !== undefined;
  let compareValue = directExists ? direct : undefined;

  // 2) Fall back to additionalFields if not found
  if (!directExists && additionalFields?.length) {
    const af = additionalFields.find(
      (a) =>
        a.sectionKey === sectionKey &&
        (a.innerSectionKey || undefined) === (innerSectionKey || undefined) &&
        a.fieldKey === rule.fieldKey
    );
    compareValue = af?.value;
  }

  if (rule.operator === "equals") {
    return compareValue === rule.value;
  } else {
    return compareValue !== rule.value;
  }
}

/** Get value for non-additional field from profile by (sectionKey, innerSectionKey, fieldKey) */
function getValueFromProfile(
  profile: ProfileLike,
  sectionKey: string,
  innerSectionKey: string | undefined,
  fieldKey: string
): any {
  if (sectionKey === "documents") {
    // documents are nested: documents[innerSectionKey][fieldKey]
    if (!innerSectionKey) return undefined;
    return profile?.documents?.[innerSectionKey]?.[fieldKey];
  }
  // typical path: profile[sectionKey][fieldKey]
  return profile?.[sectionKey]?.[fieldKey];
}

/** Validate a single file value object against fileMeta */
function validateFileValue(
  fileValue: any,
  fileMeta:
    | {
        expiryDate?: boolean;
        referenceNumber?: boolean;
        issuingDate?: boolean;
      }
    | undefined
): string[] {
  const errs: string[] = [];
  // Always good to have a URL for a file field
  if (!fileValue || !isNonEmpty(fileValue.url)) {
    errs.push("file not uploaded");
    return errs;
  }
  if (fileMeta?.referenceNumber && !isNonEmpty(fileValue.referenceNumber)) {
    errs.push("referenceNumber missing");
  }
  if (fileMeta?.issuingDate && !fileValue.issuingDate) {
    errs.push("issuingDate missing");
  }
  if (fileMeta?.expiryDate && !fileValue.expiryDate) {
    errs.push("expiryDate missing");
  }
  return errs;
}

/** Validate profile against config; return a list of human-readable problems */
async function validateEmployeeProfileCompleteness(opts: {
  config: any;
  profile: any;
}): Promise<string[]> {
  const { config, profile } = opts;
  const problems: string[] = [];

  const additionalFields: Array<{
    sectionKey?: string;
    innerSectionKey?: string;
    fieldKey: string;
    value: any;
  }> = profile.additionalFields || [];

  // ⛳️ only validate sections that are NOT employer-only
  const sectionsToValidate = (config.sections || []).filter(
    (section: any) => !isEmployerOnlySection(section)
  );

  for (const section of sectionsToValidate) {
    const sectionKey: string = section.sectionKey;

    // 1) Validate top-level fields in this section
    if (Array.isArray(section.fields) && section.fields.length) {
      const allAreFiles = section.fields.every((f: any) => f.type === "file");
      const mode: "AND" | "OR" = (section.requirementMode || "AND") as any;

      if (allAreFiles && mode === "OR") {
        const requiredFiles = section.fields.filter((f: any) =>
          coerceBoolean(f.required)
        );
        if (requiredFiles.length) {
          const anySatisfied = requiredFiles.some((field: any) => {
            const shouldValidate = showIfPasses(
              profile,
              additionalFields,
              sectionKey,
              undefined,
              field.showIf
            );
            if (!shouldValidate) return true; // condition off => not required effectively

            if (field.isAdditional) {
              const af = additionalFields.find(
                (a) =>
                  a.sectionKey === sectionKey &&
                  (a.innerSectionKey || undefined) === undefined &&
                  a.fieldKey === field.key
              );
              if (!af || !isNonEmpty(af.value)) return false;
              if (field.type === "file") {
                const errs = validateFileValue(af.value, field.fileMeta);
                return errs.length === 0;
              }
              return true;
            } else {
              const val = getValueFromProfile(
                profile,
                sectionKey,
                undefined,
                field.key
              );
              if (!isNonEmpty(val)) return false;
              if (field.type === "file") {
                const errs = validateFileValue(val, field.fileMeta);
                return errs.length === 0;
              }
              return true;
            }
          });
          if (!anySatisfied) {
            problems.push(
              `At least one document is required in section "${section.sectionLabel}".`
            );
          }
        }
      } else {
        // default/AND: each required field must be present
        for (const field of section.fields) {
          if (!coerceBoolean(field.required)) continue;
          const condOk = showIfPasses(
            profile,
            additionalFields,
            sectionKey,
            undefined,
            field.showIf
          );
          if (!condOk) continue;

          if (field.isAdditional) {
            const af = additionalFields.find(
              (a) =>
                a.sectionKey === sectionKey &&
                (a.innerSectionKey || undefined) === undefined &&
                a.fieldKey === field.key
            );
            if (!af || !isNonEmpty(af.value)) {
              problems.push(
                `Missing required field: ${section.sectionLabel} → ${field.label}`
              );
            } else if (field.type === "file") {
              const errs = validateFileValue(af.value, field.fileMeta);
              if (errs.length) {
                problems.push(
                  `Invalid file meta for ${section.sectionLabel} → ${
                    field.label
                  }: ${errs.join(", ")}`
                );
              }
            }
          } else {
            const value = getValueFromProfile(
              profile,
              sectionKey,
              undefined,
              field.key
            );
            if (!isNonEmpty(value)) {
              problems.push(
                `Missing required field: ${section.sectionLabel} → ${field.label}`
              );
            } else if (field.type === "file") {
              const errs = validateFileValue(value, field.fileMeta);
              if (errs.length) {
                problems.push(
                  `Invalid file meta for ${section.sectionLabel} → ${
                    field.label
                  }: ${errs.join(", ")}`
                );
              }
            }
          }
        }
      }
    }

    // 2) Validate inner sections
    for (const inner of section.innerSections || []) {
      const innerKey: string = inner.sectionKey;
      const fields = inner.fields || [];
      const allAreFiles =
        fields.length > 0 && fields.every((f: any) => f.type === "file");
      const mode: "AND" | "OR" = (inner.requirementMode || "AND") as any;

      if (allAreFiles && mode === "OR") {
        const requiredFiles = fields.filter((f: any) =>
          coerceBoolean(f.required)
        );
        if (requiredFiles.length) {
          const anySatisfied = requiredFiles.some((field: any) => {
            const shouldValidate = showIfPasses(
              profile,
              additionalFields,
              sectionKey,
              innerKey,
              field.showIf
            );
            if (!shouldValidate) return true;

            if (field.isAdditional) {
              const af = additionalFields.find(
                (a) =>
                  a.sectionKey === sectionKey &&
                  (a.innerSectionKey || undefined) === innerKey &&
                  a.fieldKey === field.key
              );
              if (!af || !isNonEmpty(af.value)) return false;
              const errs = validateFileValue(af.value, field.fileMeta);
              return errs.length === 0;
            } else {
              const val = getValueFromProfile(
                profile,
                sectionKey,
                innerKey,
                field.key
              );
              if (!isNonEmpty(val)) return false;
              const errs = validateFileValue(val, field.fileMeta);
              return errs.length === 0;
            }
          });

          if (!anySatisfied) {
            problems.push(
              `At least one document is required in "${section.sectionLabel} → ${inner.sectionLabel}".`
            );
          }
        }
      } else {
        for (const field of fields) {
          if (!coerceBoolean(field.required)) continue;
          const condOk = showIfPasses(
            profile,
            additionalFields,
            sectionKey,
            innerKey,
            field.showIf
          );
          if (!condOk) continue;

          if (field.isAdditional) {
            const af = additionalFields.find(
              (a) =>
                a.sectionKey === sectionKey &&
                (a.innerSectionKey || undefined) === innerKey &&
                a.fieldKey === field.key
            );
            if (!af || !isNonEmpty(af.value)) {
              problems.push(
                `Missing required field: ${section.sectionLabel} → ${inner.sectionLabel} → ${field.label}`
              );
            } else if (field.type === "file") {
              const errs = validateFileValue(af.value, field.fileMeta);
              if (errs.length) {
                problems.push(
                  `Invalid file meta for ${section.sectionLabel} → ${
                    inner.sectionLabel
                  } → ${field.label}: ${errs.join(", ")}`
                );
              }
            }
          } else {
            const value = getValueFromProfile(
              profile,
              sectionKey,
              innerKey,
              field.key
            );
            if (!isNonEmpty(value)) {
              problems.push(
                `Missing required field: ${section.sectionLabel} → ${inner.sectionLabel} → ${field.label}`
              );
            } else if (field.type === "file") {
              const errs = validateFileValue(value, field.fileMeta);
              if (errs.length) {
                problems.push(
                  `Invalid file meta for ${section.sectionLabel} → ${
                    inner.sectionLabel
                  } → ${field.label}: ${errs.join(", ")}`
                );
              }
            }
          }
        }
      }
    }
  }

  return problems;
}

export const getInvitationsByEmail = async (email: string) => {
  return await EmployeeInvitationModel.find({
    email: email.toLowerCase(),
  })
    .populate("branchId", "_id name location") // Adjust fields as needed
    .populate("designationId", "name")
    .sort({ createdAt: -1 })
    .lean();
};

/**
 * Get invitation preview by token (public, no auth required)
 * Used when user clicks invitation link before logging in
 */
export const getInvitationPreviewByToken = async (token: string) => {
  const invitation = await EmployeeInvitationModel.findOne({ token })
    .populate("tenantId", "_id name")
    .populate("branchId", "_id name")
    .populate("designationId", "name")
    .lean();

  if (!invitation) {
    throw new Error("Invitation not found");
  }

  if (invitation.status === "accepted") {
    throw new Error("This invitation has already been accepted");
  }

  if (invitation.status === "expired") {
    throw new Error("This invitation has expired");
  }

  const tenant = invitation.tenantId as any;
  const branch = invitation.branchId as any;
  const designation = invitation.designationId as any;

  return {
    tenantId: tenant?._id ? String(tenant._id) : String(invitation.tenantId),
    branchId: branch?._id ? String(branch._id) : String(invitation.branchId),
    tenantName: tenant?.name,
    branchName: branch?.name,
    designationName: designation?.name,
    email: invitation.email,
  };
};

// export const sendInvitation = async (
//   tenantId: Types.ObjectId,
//   branchId: Types.ObjectId,
//   { email, designationId }: { email: string; designationId: string }
// ) => {
//   const token = crypto.randomUUID();

//   const invite = await EmployeeInvitationModel.create({
//     email,
//     tenantId,
//     branchId,
//     designationId,
//     token,
//   });

//   // TODO: Trigger email
//   await sendInviteEmail(
//     email,
//     `${process.env.APP_URL}/accept-invite?token=${token}`
//   );

//   return invite;
// };

type SendInvitationOpts = {
  req?: Request | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
};

export const sendInvitation = async (
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId,
  { email, designationId }: { email: string; designationId: string },
  opts: SendInvitationOpts = {}
) => {
  const normalizedEmail = email.toLowerCase();

  // Check if designation has at least one document configured
  const hasDocuments =
    await employeeFieldConfigService.checkDesignationHasDocuments(
      tenantId,
      branchId,
      designationId
    );

  if (!hasDocuments) {
    // Get designation name for better error message
    const designation = await Designation.findOne({
      _id: designationId,
      tenantId,
      branchId,
      isDeleted: false,
    }).lean();

    const designationName = designation?.name || "selected job title";
    throw new AppError(
      `Cannot send invitation: The job title "${designationName}" does not have any documents configured. Please configure at least one document for this job title before sending the invitation.`,
      400
    );
  }

  // delete existing pending invites for same email + designation (not accepted)
  await EmployeeInvitationModel.deleteMany({
    email: normalizedEmail,
    designationId,
    tenantId,
    branchId,
    status: { $ne: "accepted" },
  });

  const token = crypto.randomUUID();

  const invite = await EmployeeInvitationModel.create({
    email: normalizedEmail,
    tenantId,
    branchId,
    designationId,
    token,
    status: "pending",
  });

  await sendInviteEmail(
    normalizedEmail,
    `${process.env.APP_URL}/accept-invite?token=${token}`
  );

  // 🔐 AUDIT: invitation-sent (best-effort)
  try {
    await logInvitationSent({
      req: opts.req ?? null,
      tenantId: String(tenantId),
      branchId: String(branchId),
      designationId: String(designationId),
      invitationId: String(invite._id),
      invitedEmail: normalizedEmail,
      actorUserId: opts.actorUserId ?? null,
      actorEmail: opts.actorEmail ?? null,
      actorName: opts.actorName ?? null,
    });
  } catch (err) {
    console.error("[audit] logInvitationSent failed:", err);
  }

  return invite;
};

// export const sendInvitation = async (
//   tenantId: Types.ObjectId,
//   branchId: Types.ObjectId,
//   { email, designationId }: { email: string; designationId: string }
// ) => {
//   const normalizedEmail = email.toLowerCase();

//   // ⚡️ Efficient cleanup: delete existing pending invites for same email + designation
//   await EmployeeInvitationModel.deleteMany({
//     email: normalizedEmail,
//     designationId,
//     tenantId,
//     branchId,
//     status: { $ne: "accepted" },
//   });

//   const token = crypto.randomUUID();

//   const invite = await EmployeeInvitationModel.create({
//     email: normalizedEmail,
//     tenantId,
//     branchId,
//     designationId,
//     token,
//   });

//   await sendInviteEmail(
//     normalizedEmail,
//     `${process.env.APP_URL}/accept-invite?token=${token}`
//   );

//   return invite;
// };

type AcceptInviteAuditOpts = {
  req?: Request | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
};

export const acceptInvitation = async (
  userId: Types.ObjectId,
  token: string,
  opts?: AcceptInviteAuditOpts
) => {
  // 0) Load invitation first (do not mark accepted yet)
  const invitation = await EmployeeInvitationModel.findOne({ token });
  if (!invitation || invitation.status === "accepted") {
    throw new Error("Invalid or expired invitation");
  }

  // 1) Find user
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  // 2) Find or create employee profile
  let employeeProfile = await EmployeeProfile.findOne({ userId });
  if (!employeeProfile) {
    // Create a new employee profile for the user
    // Initialize with basic user information
    const nameParts = (user.fullName || "").trim().split(" ");
    const firstname = nameParts[0] || "";
    const lastname = nameParts.slice(1).join(" ") || "";

    employeeProfile = await EmployeeProfile.create({
      userId: user._id,
      personaldetails: {
        firstname: firstname,
        lastname: lastname,
        mobile: user.phone || "",
      },
      additionalFields: [],
      documents: {
        identificationdocuments: {},
        certificates: {},
        checksandclearance: {},
      },
    });
  }

  // 3) Capture old values for audit
  const oldStatus = invitation.status;
  const invitedEmail = invitation.email?.toLowerCase?.() ?? "";

  // 4) Mark invitation as accepted
  invitation.status = "accepted";
  invitation.acceptedAt = new Date();
  await invitation.save();

  // 5) Create employee record if not present
  let employee = await EmployeeModel.findOne({
    employeeProfile: employeeProfile._id,
    tenantId: invitation.tenantId,
    branchId: invitation.branchId,
    isDeleted: false,
  });

  if (!employee) {
    employee = await EmployeeModel.create({
      tenantId: invitation.tenantId,
      branchId: invitation.branchId,
      designation: invitation.designationId,
      employeeProfile: employeeProfile._id,
      employeeFields: {
        additionalFields: [],
      },
      employeerOnlyAdditionalFields: [],
    });
  }

  // 5.1) Set employment status to "Reference Check Started" according to config
  // Fetch the field config to determine where to store this field
  const config = await EmployeeFieldConfig.findOne({
    tenantId: invitation.tenantId,
    branchId: invitation.branchId,
  }).lean();

  if (config) {
    const employeedetailsSection = (config.sections || []).find(
      (s: any) => s.sectionKey === "employeedetails"
    );

    if (employeedetailsSection) {
      const employmentStatusField = (employeedetailsSection.fields || []).find(
        (f: any) => f.key === "employmentstatus"
      );

      if (employmentStatusField) {
        // Determine if this should go to employer-only fields
        const sectionEmployerOnly =
          !!employeedetailsSection.employeerOnlyEditable;
        const fieldEmployerOnly = !!employmentStatusField.employeerOnlyEditable;
        const shouldGoToEmployerOnly = sectionEmployerOnly || fieldEmployerOnly;

        // Initialize employeeFields if needed
        if (!employee.employeeFields) {
          employee.employeeFields = {
            additionalFields: [],
          };
        }
        if (!employee.employeeFields.additionalFields) {
          employee.employeeFields.additionalFields = [];
        }
        if (!employee.employeerOnlyAdditionalFields) {
          employee.employeerOnlyAdditionalFields = [];
        }

        // Find existing field in the appropriate array
        const targetArray = shouldGoToEmployerOnly
          ? employee.employeerOnlyAdditionalFields
          : employee.employeeFields.additionalFields;

        const existingIndex = targetArray.findIndex(
          (field: any) =>
            field.sectionKey === "employeedetails" &&
            field.fieldKey === "employmentstatus"
        );

        const employmentStatusValue = {
          sectionKey: "employeedetails",
          fieldKey: "employmentstatus",
          value: "Reference Check Started",
        };

        if (existingIndex === -1) {
          // Add if it doesn't exist
          targetArray.push(employmentStatusValue);
        } else {
          // Update if it exists but is empty/null
          const existingField = targetArray[existingIndex];
          if (!existingField.value || existingField.value === "") {
            existingField.value = "Reference Check Started";
          }
        }

        await employee.save();
      }
    }
  } else {
    // Fallback: if config not found, use default location (additionalFields)
    if (!employee.employeeFields) {
      employee.employeeFields = {
        additionalFields: [],
      };
    }
    if (!employee.employeeFields.additionalFields) {
      employee.employeeFields.additionalFields = [];
    }

    const existingIndex = employee.employeeFields.additionalFields.findIndex(
      (field: any) =>
        field.sectionKey === "employeedetails" &&
        field.fieldKey === "employmentstatus"
    );

    if (existingIndex === -1) {
      employee.employeeFields.additionalFields.push({
        sectionKey: "employeedetails",
        fieldKey: "employmentstatus",
        value: "Reference Check Started",
      });
    } else {
      const existingField =
        employee.employeeFields.additionalFields[existingIndex];
      if (!existingField.value || existingField.value === "") {
        existingField.value = "Reference Check Started";
      }
    }

    await employee.save();
  }

  // 6) Update user assignments and currentMode if needed
  // Initialize assignments array if it doesn't exist
  if (!user.assignments) {
    user.assignments = [];
  }

  // Convert invitation IDs to ObjectIds for comparison
  const invitationTenantId = new Types.ObjectId(invitation.tenantId);
  const invitationBranchId = new Types.ObjectId(invitation.branchId);

  const alreadyAssigned = user.assignments.some((a: any) => {
    const aTenantId =
      a.tenantId instanceof Types.ObjectId
        ? a.tenantId
        : new Types.ObjectId(a.tenantId);
    const aBranchId =
      a.branchId instanceof Types.ObjectId
        ? a.branchId
        : new Types.ObjectId(a.branchId);
    return (
      aTenantId.equals(invitationTenantId) &&
      aBranchId.equals(invitationBranchId) &&
      a.role === "employee"
    );
  });

  if (!alreadyAssigned) {
    user.assignments.push({
      tenantId: invitationTenantId,
      branchId: invitationBranchId,
      role: "employee",
    });
  }

  // Set active assignment
  user.activeAssignment = {
    tenantId: invitationTenantId,
    branchId: invitationBranchId,
    role: "employee",
  };

  // Update currentMode if user is a newbie
  if (!user.currentMode || user.currentMode === "newbie") {
    user.currentMode = "nexus-profile";
  }

  // Save and ensure the document is properly persisted
  await user.save();

  // Mark the document as modified to ensure Mongoose saves all changes
  user.markModified("assignments");
  user.markModified("activeAssignment");
  await user.save();

  // 7) 🔐 AUDIT: invitation accepted (single, clear change set)
  try {
    await logInvitationAccepted({
      req: opts?.req ?? null,
      tenantId: String(invitation.tenantId),
      branchId: String(invitation.branchId),
      userId: String(user._id), // subject user
      actorEmail: opts?.actorEmail ?? null,
      actorName: opts?.actorName ?? null,
      diff: [
        // { path: "status", old: oldStatus, new: "accepted" },
        // {
        //   path: "acceptedAt",
        //   old: null,
        //   new: invitation.acceptedAt?.toISOString?.() ?? null,
        // },
      ],
      meta: {
        // 👇 matches your requested phrasing style
        summary: `${invitedEmail} has accepted invitation`,
        invitedEmail,
        designationId: String(invitation.designationId),
      },
    });
  } catch (err) {
    console.error("[audit] invitation-accepted log failed:", err);
  }

  // Reload user to get the latest assignments after save
  const updatedUser = await User.findById(userId).lean();
  if (!updatedUser) {
    throw new Error("User not found after update");
  }

  return {
    success: true,
    user: updatedUser,
  };
};

// export const acceptInvitation = async (
//   userId: Types.ObjectId,
//   token: string
// ) => {
//   // 0) Load invitation first (do not mark accepted yet)
//   const invitation = await EmployeeInvitationModel.findOne({ token });
//   if (!invitation || invitation.status === "accepted") {
//     throw new Error("Invalid or expired invitation");
//   }

//   // 1) Find user + profile
//   const user = await User.findById(userId);
//   if (!user) throw new Error("User not found");

//   const employeeProfile = await EmployeeProfile.findOne({ userId });
//   if (!employeeProfile) {
//     throw new Error("Employee profile not found for this user");
//   }

//   // 3) Mark invitation as accepted
//   invitation.status = "accepted";
//   invitation.acceptedAt = new Date();
//   await invitation.save();

//   // 4) Create employee record if not present
//   const existingEmployee = await EmployeeModel.findOne({
//     employeeProfile: employeeProfile._id,
//     tenantId: invitation.tenantId,
//     branchId: invitation.branchId,
//     isDeleted: false,
//   });

//   if (!existingEmployee) {
//     await EmployeeModel.create({
//       tenantId: invitation.tenantId,
//       branchId: invitation.branchId,
//       designation: invitation.designationId,
//       employeeProfile: employeeProfile._id,
//     });
//   }

//   // 5) Update user.assignment(s)
//   const alreadyAssigned = user.assignments.some(
//     (a: any) =>
//       a.tenantId.equals(invitation.tenantId) &&
//       a.branchId.equals(invitation.branchId) &&
//       a.role === "employee"
//   );

//   if (!alreadyAssigned) {
//     user.assignments.push({
//       tenantId: invitation.tenantId,
//       branchId: invitation.branchId,
//       role: "employee",
//     });
//   }

//   // if (!user.activeAssignment) {
//   user.activeAssignment = {
//     tenantId: invitation.tenantId,
//     branchId: invitation.branchId,
//     role: "employee",
//   };
//   // }

//   if (user.currentMode === "newbie") {
//     user.currentMode = "nexus-profile";
//   }

//   await user.save();
//   return { success: true };
// };

// // 2) Load the config for this tenant/branch/designation to validate completeness
// const config = await EmployeeFieldConfig.findOne({
//   tenantId: invitation.tenantId,
//   branchId: invitation.branchId,
//   // If you scope by designation, uncomment the next line:
//   // designationId: invitation.designationId ?? null,
// });

// if (config) {
//   const problems = await validateEmployeeProfileCompleteness({
//     config,
//     profile: employeeProfile.toObject(),
//   });

//   if (problems.length) {
//     // Block acceptance until profile is complete
//     const error = new Error(
//       "Your profile is incomplete. Please update these before accepting:\n- " +
//         problems.join("\n- ")
//     );
//     (error as any).code = "PROFILE_INCOMPLETE";
//     (error as any).details = problems;
//     throw error;
//   }
// }
// If there is no config, we proceed (no validation rules to enforce)
// export const acceptInvitation = async (
//   userId: Types.ObjectId,
//   token: string
// ) => {
//   const invitation = await EmployeeInvitationModel.findOne({ token });

//   if (!invitation || invitation.status === "accepted") {
//     throw new Error("Invalid or expired invitation");
//   }

//   // Step 1: Mark invitation as accepted
//   invitation.status = "accepted";
//   invitation.acceptedAt = new Date();
//   await invitation.save();

//   // Step 2: Find user and ensure they exist
//   const user = await User.findById(userId);
//   if (!user) {
//     throw new Error("User not found");
//   }

//   // Step 3: Find or ensure employee profile
//   const employeeProfile = await EmployeeProfile.findOne({ userId });
//   if (!employeeProfile) {
//     throw new Error("Employee profile not found for this user");
//   }

//   // Step 4: Check if already an employee
//   const existingEmployee = await EmployeeModel.findOne({
//     employeeProfile: employeeProfile._id,
//     tenantId: invitation.tenantId,
//     branchId: invitation.branchId,
//     isDeleted: false,
//   });

//   if (!existingEmployee) {
//     // Create new employee record
//     await EmployeeModel.create({
//       tenantId: invitation.tenantId,
//       branchId: invitation.branchId,
//       designation: invitation.designationId,
//       employeeProfile: employeeProfile._id,
//     });
//   }

//   // Step 5: Update user assignments
//   const alreadyAssigned = user.assignments.some(
//     (a) =>
//       a.tenantId.equals(invitation.tenantId) &&
//       a.branchId.equals(invitation.branchId) &&
//       a.role.equals("employee")
//   );

//   if (!alreadyAssigned) {
//     user.assignments.push({
//       tenantId: invitation.tenantId,
//       branchId: invitation.branchId,
//       role: "employee",
//     });
//   }

//   // Step 6: Set activeAssignment if not already set
//   if (!user.activeAssignment) {
//     user.activeAssignment = {
//       tenantId: invitation.tenantId,
//       branchId: invitation.branchId,
//       role: "employee",
//     };
//   }

//   // Step 7: Update currentMode if needed
//   if (user.currentMode === "newbie") {
//     user.currentMode = "nexus-profile";
//   }

//   await user.save();

//   return { success: true };
// };
