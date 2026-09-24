import { Types } from "mongoose";
import EmployeeFieldConfigModel from "@/database/models/EmployeeFieldConfig";
import {
  EmployeeConfig,
  CreateOrUpdateEmployeeFieldConfigInput,
} from "./employeeFieldConfig.types";
import { defaultConfigData } from "@/database/defaults/defaultConfigData";
import EmployeeModel from "@/database/models/employee.model";
import { logAudit } from "@/audit/auth-audit";

/**
 * Get config for a specific tenant, branch, and (optional) designation
 */
export const getConfig = async (
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId,
  designationId?: Types.ObjectId
) => {
  const query: any = { tenantId, branchId };
  console.log(tenantId, branchId, "here you go");
  if (designationId) query.designationId = designationId;

  return await EmployeeFieldConfigModel.findOne(query).lean();
};

// ---- Types passed from controller ----
type DiffChange = { path: string; old: any; new: any };

export type SaveConfigOpts = {
  req?: Request | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
  /** Forwarded from the frontend payload (array of {path, old, new}) */
  diff?: DiffChange[] | null;
};

// ---- keep audit rows readable (optional) ----
function clampValue(v: any) {
  if (v == null) return v;
  if (typeof v === "string") {
    return v.length > 1000 ? v.slice(0, 1000) + "…(truncated)" : v;
  }
  return v;
}
function sanitizeClientDiff(
  diff?: DiffChange[] | null,
  max = 500
): DiffChange[] {
  if (!Array.isArray(diff) || diff.length === 0) return [];
  return diff.slice(0, max).map((d) => ({
    path: String(d?.path ?? ""),
    old: clampValue(d?.old),
    new: clampValue(d?.new),
  }));
}

export const createOrUpdateConfig = async (
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId,
  designationId: Types.ObjectId | null,
  sections: EmployeeConfig["sections"],
  opts?: SaveConfigOpts
) => {
  console.log("Hitting here!!!!!!!!!!");
  const query: Record<string, any> = { tenantId, branchId };
  if (designationId) query.designationId = designationId;

  const config = await EmployeeFieldConfigModel.findOneAndUpdate(
    query,
    { sections },
    { new: true, upsert: true }
  );

  // ---- AUDIT (best-effort; never block the save) ----
  try {
    const aggregateId = `${String(tenantId)}:${String(branchId)}:${
      designationId ? String(designationId) : "all"
    }`;

    console.log(opts.diff, "plesss");

    // ONLY the updated fields coming from UI
    const clientDiff = sanitizeClientDiff(opts?.diff);

    console.log(clientDiff, "showw");

    await logAudit({
      req: opts?.req ?? null,
      op: "update",
      path: "employee-field-config.save",
      aggregateType: "EmployeeFieldConfig",
      aggregateId,
      tenantId: String(tenantId),
      branchId: String(branchId),
      userId: opts?.actorUserId ?? null,
      actor: opts?.actorEmail ?? null,
      actorName: opts?.actorName ?? null,
      diff: clientDiff, // <- no server-side extras
      meta: {
        designationId: designationId ? String(designationId) : null,
        summary:
          clientDiff.length > 0
            ? `Updated employee field config (${clientDiff.length} change${
                clientDiff.length === 1 ? "" : "s"
              }).`
            : "Updated employee field config.",
      },
    });
  } catch (err) {
    console.error("[audit] employee-field-config.save log failed:", err);
  }
  // ---- /AUDIT ----

  return config;
};

/**
 * Reset config to default
 */
export const resetToDefault = async (
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId,
  designationId: Types.ObjectId | null
) => {
  const query: any = { tenantId, branchId };
  if (designationId) query.designationId = designationId;

  return await EmployeeFieldConfigModel.findOneAndUpdate(
    query,
    { sections: defaultConfigData },
    { new: true, upsert: true }
  );
};

/**
 * Add a new section to the config
 */
export const addSection = async (
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId,
  section: EmployeeConfig["sections"][number],
  designationId?: Types.ObjectId
) => {
  const query: any = { tenantId, branchId };
  if (designationId) query.designationId = designationId;

  return await EmployeeFieldConfigModel.findOneAndUpdate(
    query,
    { $push: { sections: section } },
    { new: true }
  );
};

/**
 * Add a new field to a specific section
 */
export const addFieldToSection = async (
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId,
  sectionKey: string,
  field: EmployeeConfig["sections"][number]["fields"][number],
  designationId?: Types.ObjectId
) => {
  const query: any = {
    tenantId,
    branchId,
    ...(designationId && { designationId }),
    "sections.sectionKey": sectionKey,
  };

  return await EmployeeFieldConfigModel.findOneAndUpdate(
    query,
    { $push: { "sections.$.fields": field } },
    { new: true }
  );
};

export const createDefaultEmployeeFieldConfig = async (
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId,
  sections: EmployeeConfig["sections"]
) => {
  return await EmployeeFieldConfigModel.create({
    tenantId,
    branchId,
    sections,
  });
};

// ----------------------------------
type ObjectId = Types.ObjectId;

interface SectionConfig {
  sectionKey: string;
  sectionLabel: string;
  fields: any[];
  innerSections?: any[];
  isAdditional?: boolean;
  employeerOnlyEditable?: boolean; // NOTE: keep user's misspelling as-is
}

type EmployeeFieldConfig =
  | { sections: SectionConfig[]; [k: string]: any } // common shape
  | SectionConfig[]; // sometimes just an array

function stripEmployerOnlySections(
  sections: SectionConfig[] | undefined | null
): SectionConfig[] {
  if (!Array.isArray(sections)) return [];
  return sections.filter((s) => !Boolean(s?.employeerOnlyEditable));
}

/**
 * Returns config tailored for the logged-in employee:
 * - loads the underlying config (tenant+branch)
 * - removes any root section where employeerOnlyEditable === true
 * - preserves original shape (object with `sections` or plain array)
 */
export async function getConfigForEmployee(
  tenantId: ObjectId,
  branchId: ObjectId,
  designationId?: string | null
): Promise<EmployeeFieldConfig | null> {
  const cfg: any = await getConfig(tenantId, branchId);
  if (!cfg) return null;

  // deep clone to avoid mutating a mongoose doc
  const clone = JSON.parse(JSON.stringify(cfg));

  let sections = clone;

  if (Array.isArray(clone)) {
    // shape: SectionConfig[]
    sections = stripEmployerOnlySections(clone);
  } else if (clone.sections) {
    // shape: { sections: SectionConfig[], ... }
    sections = clone.sections;
    clone.sections = stripEmployerOnlySections(clone.sections);
  } else {
    clone.sections = [];
    sections = [];
  }

  // Filter documents by designation if provided
  if (designationId && sections) {
    console.log(
      "🔍 [DEBUG] Filtering documents by designation:",
      designationId
    );
    clone.sections = filterDocumentsByDesignation(sections, designationId);
    console.log(
      "🔍 [DEBUG] Filtered sections count:",
      clone.sections.filter(
        (s: any) => s.sectionKey?.toLowerCase() === "documents"
      ).length
    );
  } else {
    console.log("🔍 [DEBUG] No designation provided or no sections");
  }

  return clone;
}

/**
 * Check if a designation has at least one document configured
 */
export async function checkDesignationHasDocuments(
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId,
  designationId: string
): Promise<boolean> {
  const config = await getConfig(tenantId, branchId);

  if (!config || !config.sections) {
    return false;
  }

  // Find the documents section
  const documentsSection = config.sections.find(
    (section: any) => section.sectionKey?.toLowerCase() === "documents"
  );

  if (!documentsSection) {
    return false;
  }

  // Check if there are any inner sections with fields that have this designation in jobRole
  if (
    documentsSection.innerSections &&
    documentsSection.innerSections.length > 0
  ) {
    for (const innerSection of documentsSection.innerSections) {
      if (innerSection.fields && innerSection.fields.length > 0) {
        // Check if any field has this designation in jobRole
        const hasMatchingField = innerSection.fields.some((field: any) => {
          const jobRoles = field.jobRole || [];
          return jobRoles.includes(designationId);
        });
        if (hasMatchingField) {
          return true;
        }
      }
    }
  }

  // Also check if documents section has direct fields
  if (documentsSection.fields && documentsSection.fields.length > 0) {
    const hasMatchingField = documentsSection.fields.some((field: any) => {
      const jobRoles = field.jobRole || [];
      return jobRoles.includes(designationId);
    });
    if (hasMatchingField) {
      return true;
    }
  }

  return false;
}

/**
 * Filter document sections based on designation (job role)
 */
function filterDocumentsByDesignation(
  sections: any[],
  designationId: string
): any[] {
  return sections.map((section: any) => {
    // Only filter the "documents" section
    if (section.sectionKey?.toLowerCase() !== "documents") {
      return section;
    }

    const filterSection = (s: any): any | null => {
      // Filter fields based on jobRole
      const filteredFields = (s.fields || []).filter((field: any) => {
        const jobRoles = field.jobRole || [];
        console.log(
          "🔍 [DEBUG] Field:",
          field.key,
          "jobRoles:",
          JSON.stringify(jobRoles),
          "designationId:",
          designationId,
          "includes?",
          jobRoles.includes(designationId)
        );
        return jobRoles.includes(designationId);
      });

      // Filter inner sections
      const filteredInnerSections = (s.innerSections || [])
        .map(filterSection)
        .filter((s: any) => s !== null);

      const hasMatchingFields = filteredFields.length > 0;
      const hasMatchingInnerSections = filteredInnerSections.length > 0;

      console.log(
        "🔍 [DEBUG] Section:",
        s.sectionKey,
        "hasMatchingFields:",
        hasMatchingFields,
        "hasMatchingInnerSections:",
        hasMatchingInnerSections
      );

      // If no matching fields or inner sections, exclude this section
      if (!hasMatchingFields && !hasMatchingInnerSections) {
        return null;
      }

      return {
        ...s,
        fields: filteredFields,
        innerSections: filteredInnerSections,
      };
    };

    const filtered = filterSection(section);

    // If documents section is empty after filtering, return it with empty innerSections
    if (!filtered || (filtered.innerSections || []).length === 0) {
      return {
        ...section,
        innerSections: [],
      };
    }

    return filtered;
  });
}
