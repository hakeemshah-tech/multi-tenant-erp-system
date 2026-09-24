import { Designation } from "@/database/models/designation.model";
import { AppError } from "@/common/utils/app-error";
import {
  CreateDesignationInput,
  UpdateDesignationInput,
} from "./designation.types";
import mongoose, { Types } from "mongoose";
import { WithPagination } from "@/common/middlewares/paginationMiddleware";
import { PaginationParams } from "@/types/custom";
import {
  logDesignationCreate,
  logDesignationUpdate,
} from "@/audit/designation-audit";
import EmployeeFieldConfigModel from "@/database/models/EmployeeFieldConfig";

// Helper function to recursively update all document fields with new jobRole
// Only updates the "documents" section, leaves other sections unchanged
async function updateAllDocumentFieldsWithNewJobRole(
  sections: any[],
  newDesignationId: string
): Promise<any[]> {
  if (!Array.isArray(sections)) return sections;

  return sections.map((section) => {
    const updatedSection = { ...section };

    // Only update if this is the "documents" section
    const isDocumentsSection =
      section.sectionKey?.toLowerCase() === "documents";

    if (isDocumentsSection) {
      // Update fields in the current section
      if (Array.isArray(updatedSection.fields)) {
        updatedSection.fields = updatedSection.fields.map((field: any) => {
          const updatedField = { ...field };
          if (!updatedField.jobRole) {
            updatedField.jobRole = [];
          }
          if (!updatedField.jobRole.includes(newDesignationId)) {
            updatedField.jobRole = [...updatedField.jobRole, newDesignationId];
          }
          return updatedField;
        });
      }

      // Recursively update inner sections (only for documents section)
      if (Array.isArray(updatedSection.innerSections)) {
        updatedSection.innerSections = updateSectionFieldsWithJobRole(
          updatedSection.innerSections,
          newDesignationId
        );
      }
    }

    return updatedSection;
  });
}

// Helper function for inner sections
function updateSectionFieldsWithJobRole(
  innerSections: any[],
  newDesignationId: string
): any[] {
  if (!Array.isArray(innerSections)) return innerSections;

  return innerSections.map((section) => {
    const updatedSection = { ...section };

    // Update fields in the current inner section
    if (Array.isArray(updatedSection.fields)) {
      updatedSection.fields = updatedSection.fields.map((field: any) => {
        const updatedField = { ...field };
        if (!updatedField.jobRole) {
          updatedField.jobRole = [];
        }
        if (!updatedField.jobRole.includes(newDesignationId)) {
          updatedField.jobRole = [...updatedField.jobRole, newDesignationId];
        }
        return updatedField;
      });
    }

    // Recursively handle nested inner sections
    if (Array.isArray(updatedSection.innerSections)) {
      updatedSection.innerSections = updateSectionFieldsWithJobRole(
        updatedSection.innerSections,
        newDesignationId
      );
    }

    return updatedSection;
  });
}

interface GetDesignationsOptions {
  populate?: boolean;
  skip?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  status?: "active" | "inactive" | "all";
}

/**
 * Create a new designation
 */
type AuditOpts = {
  req?: Request | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
};

export const createDesignation = async (
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  data: CreateDesignationInput & { selectedDocumentFields?: string[] },
  audit?: AuditOpts
) => {
  const { selectedDocumentFields, ...designationData } = data;

  // Check for duplicate job title name (case-insensitive) within the same tenant and branch
  const existingDesignation = await Designation.findOne({
    tenantId,
    branchId,
    name: { $regex: new RegExp(`^${designationData.name.trim()}$`, "i") },
    isDeleted: false,
  });

  if (existingDesignation) {
    throw new AppError(
      `Job Title with name "${designationData.name}" already exists in this organisation`,
      409
    );
  }

  const designation = await Designation.create({
    tenantId,
    branchId,
    ...designationData,
  });

  // 🎯 Add new designation to selected document fields only
  try {
    const newDesignationId = String(designation._id);

    // Find the field config for this tenant and branch
    const config = await EmployeeFieldConfigModel.findOne({
      tenantId,
      branchId,
    });

    if (!config) {
      console.log("⚠️ [DESIGNATION] No field config found to update");
      return designation;
    }

    // If no documents selected, don't update anything
    if (!selectedDocumentFields || selectedDocumentFields.length === 0) {
      console.log("ℹ️ [DESIGNATION] No documents selected for this Job Title");
      return designation;
    }

    console.log("🔍 [DEBUG] Selected document fields:", selectedDocumentFields);
    console.log("🔍 [DEBUG] New designation ID:", newDesignationId);

    // Update only the selected document fields
    let updatedCount = 0;
    const sections = config.sections || [];

    for (const section of sections) {
      const isDocumentsSection =
        section.sectionKey?.toLowerCase() === "documents";

      if (isDocumentsSection && section.innerSections) {
        for (const innerSection of section.innerSections) {
          if (innerSection.fields) {
            for (const field of innerSection.fields) {
              const fieldId = `documents.${innerSection.sectionKey || ""}.${
                field.key
              }`;

              console.log(`🔍 [DEBUG] Checking field: ${fieldId}`);

              if (selectedDocumentFields.includes(fieldId)) {
                console.log(
                  `✅ [DEBUG] Match found! Updating field: ${fieldId}`
                );
                if (!field.jobRole) {
                  field.jobRole = [];
                }
                if (!field.jobRole.includes(newDesignationId)) {
                  field.jobRole.push(newDesignationId);
                  updatedCount++;
                  console.log(
                    `✅ [DEBUG] Updated jobRole for ${fieldId}:`,
                    field.jobRole
                  );
                } else {
                  console.log(
                    `ℹ️ [DEBUG] JobRole already includes this designation`
                  );
                }
              }
            }
          }
        }
      }
    }

    // Save the updated config
    config.sections = sections;
    await config.save();

    console.log(
      `✅ [DESIGNATION] Added new designation "${designation.name}" to ${updatedCount} document field(s)`
    );
  } catch (error) {
    console.error(
      "[ERROR] Failed to update field configs with new designation:",
      error
    );
    // Don't throw - we still want to return the created designation
  }

  // 🔐 AUDIT (best-effort)
  try {
    await logDesignationCreate({
      ctx: {
        req: audit?.req ?? null,
        tenantId: String(tenantId),
        branchId: String(branchId),
        actorUserId: audit?.actorUserId ?? null,
        actorEmail: audit?.actorEmail ?? null,
        actorName: audit?.actorName ?? null,
      },
      designation: {
        _id: String(designation._id),
        name: designation.name,
        description: (designation as any).description,
      },
      payload: data as Record<string, any>,
    });
  } catch (e) {
    console.error("[audit] designation.create failed:", e);
  }

  return designation;
};

/**
 * Get all designations for a tenant and branch
 */

export const getDesignations = async (
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId,
  options: GetDesignationsOptions = {}
) => {
  const { skip, limit, search, departmentId, status = "active" } = options;

  // Base query
  const filter: any = {
    tenantId,
    branchId,
  };

  // Status filter
  if (status === "active") {
    filter.isDeleted = false;
  } else if (status === "inactive") {
    filter.isDeleted = true;
  }
  // If status is "all", don't filter by isDeleted

  // Optional text search on name
  if (search) {
    filter.name = { $regex: search, $options: "i" };
  }

  // Optional department filter
  if (departmentId && Types.ObjectId.isValid(departmentId)) {
    filter.departmentIds = new Types.ObjectId(departmentId);
  }

  let query = Designation.find(filter);

  query = query.populate("departmentIds", "name description");

  if (typeof skip === "number" && typeof limit === "number") {
    query = query.skip(skip).limit(limit);
  }

  return query.lean();
};

export const getDesignationCount = async (
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId,
  status: "active" | "inactive" | "all" = "active"
) => {
  const filter: any = {
    tenantId,
    branchId,
  };

  if (status === "active") {
    filter.isDeleted = false;
  } else if (status === "inactive") {
    filter.isDeleted = true;
  }
  // If status is "all", don't filter by isDeleted

  return Designation.countDocuments(filter);
};

/**
 * Get single designation by ID for a specific tenant and branch
 */
export const getDesignationById = async (
  id: string,
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId
) => {
  const query = Designation.findOne({
    _id: id,
    tenantId,
    branchId,
    isDeleted: false,
  });

  query.populate("departmentIds", "name description");

  const result = await query.lean();

  if (!result) throw new AppError("Designation not found", 404);
  return result;
};

/**
 * Update designation details
 */
export const updateDesignation = async (
  id: string,
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  data: UpdateDesignationInput & { selectedDocumentFields?: string[] },
  audit?: AuditOpts
) => {
  // fetch current for accurate diffs
  const before = await Designation.findOne({
    _id: id,
    tenantId,
    branchId,
    isDeleted: false,
  }).lean();

  if (!before)
    throw new AppError("Designation not found or already deleted", 404);

  // Check for duplicate job title name if name is being updated
  if (
    data.name &&
    data.name.trim().toLowerCase() !==
      (before.name as string).trim().toLowerCase()
  ) {
    const existingDesignation = await Designation.findOne({
      tenantId,
      branchId,
      name: { $regex: new RegExp(`^${data.name.trim()}$`, "i") },
      isDeleted: false,
      _id: { $ne: id }, // Exclude the current designation
    });

    if (existingDesignation) {
      throw new AppError(
        `Job Title with name "${data.name}" already exists in this organisation`,
        409
      );
    }
  }

  const { selectedDocumentFields, ...designationData } = data;

  const designation = await Designation.findOneAndUpdate(
    { _id: id, tenantId, branchId, isDeleted: false },
    designationData,
    { new: true }
  );

  if (!designation)
    throw new AppError("Designation not found or already deleted", 404);

  // 🎯 Update document field configurations if selectedDocumentFields provided
  if (selectedDocumentFields !== undefined) {
    try {
      const designationId = String(designation._id);
      const config = await EmployeeFieldConfigModel.findOne({
        tenantId,
        branchId,
      });

      if (config) {
        console.log("🔍 [DEBUG] Updating document fields for designation edit");
        console.log("🔍 [DEBUG] Selected documents:", selectedDocumentFields);

        const sections = config.sections || [];
        const selectedFields = selectedDocumentFields || [];

        // Remove this designation from all document fields first
        for (const section of sections) {
          const isDocumentsSection =
            section.sectionKey?.toLowerCase() === "documents";

          if (isDocumentsSection && section.innerSections) {
            for (const innerSection of section.innerSections) {
              if (innerSection.fields) {
                for (const field of innerSection.fields) {
                  if (field.jobRole && field.jobRole.includes(designationId)) {
                    field.jobRole = field.jobRole.filter(
                      (id: string) => id !== designationId
                    );
                  }
                }
              }
            }
          }
        }

        // Now add to newly selected fields
        let addedCount = 0;
        for (const section of sections) {
          const isDocumentsSection =
            section.sectionKey?.toLowerCase() === "documents";

          if (isDocumentsSection && section.innerSections) {
            for (const innerSection of section.innerSections) {
              if (innerSection.fields) {
                for (const field of innerSection.fields) {
                  const fieldId = `documents.${innerSection.sectionKey || ""}.${
                    field.key
                  }`;

                  if (selectedFields.includes(fieldId)) {
                    if (!field.jobRole) {
                      field.jobRole = [];
                    }
                    if (!field.jobRole.includes(designationId)) {
                      field.jobRole.push(designationId);
                      addedCount++;
                    }
                  }
                }
              }
            }
          }
        }

        config.sections = sections;
        await config.save();

        console.log(
          `✅ [DESIGNATION] Updated designation "${designation.name}" - added to ${addedCount} document field(s)`
        );
      }
    } catch (error) {
      console.error(
        "[ERROR] Failed to update field configs for designation update:",
        error
      );
    }
  }

  // 🔐 AUDIT (best-effort)
  try {
    await logDesignationUpdate({
      ctx: {
        req: audit?.req ?? null,
        tenantId: String(tenantId),
        branchId: String(branchId),
        actorUserId: audit?.actorUserId ?? null,
        actorEmail: audit?.actorEmail ?? null,
        actorName: audit?.actorName ?? null,
      },
      designationId: String(designation._id),
      before,
      after: designation.toObject(),
      updatePayload: data as Record<string, any>,
    });
  } catch (e) {
    console.error("[audit] designation.update failed:", e);
  }

  return designation;
};

/**
 * Soft delete designation
 */
export const deleteDesignation = async (
  id: string,
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId
) => {
  const result = await Designation.findOneAndUpdate(
    { _id: id, tenantId, branchId, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
    { new: true }
  );

  if (!result)
    throw new AppError("Job Title not found or already deleted", 404);

  return { message: "Job Title deleted successfully" };
};

/**
 * Toggle designation active/inactive status
 */
export const toggleDesignationStatus = async (
  id: string,
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  audit?: {
    req?: any;
    actorUserId?: string | null;
    actorEmail?: string | null;
    actorName?: string | null;
  }
) => {
  // Fetch current designation
  const before = await Designation.findOne({
    _id: id,
    tenantId,
    branchId,
  }).lean();

  if (!before) throw new AppError("Job Title not found", 404);

  const newStatus = !before.isDeleted; // Toggle status
  const result = await Designation.findOneAndUpdate(
    { _id: id, tenantId, branchId },
    {
      isDeleted: newStatus,
      deletedAt: newStatus ? new Date() : null,
    },
    { new: true }
  );

  if (!result) throw new AppError("Job Title not found", 404);

  // 🔐 AUDIT
  try {
    await logDesignationUpdate({
      ctx: {
        req: audit?.req ?? null,
        tenantId: String(tenantId),
        branchId: String(branchId),
        actorUserId: audit?.actorUserId ?? null,
        actorEmail: audit?.actorEmail ?? null,
        actorName: audit?.actorName ?? null,
      },
      designationId: String(result._id),
      before,
      after: result.toObject(),
      updatePayload: { isDeleted: newStatus } as Record<string, any>,
    });
  } catch (e) {
    console.error("[audit] designation.status-toggle failed:", e);
  }

  return {
    message: newStatus
      ? "Job Title marked as inactive successfully"
      : "Job Title marked as active successfully",
    data: result,
  };
};
