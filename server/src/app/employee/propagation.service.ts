import { ClientSession, Types } from "mongoose";
import EmployeeModel from "@/database/models/employee.model";
import { EmployeeProfile } from "@/database/models/employeeProfile.model";

/** ---------- Utils ---------- */

type Plain = Record<string, any>;

const isPlainObject = (v: any) =>
  v && typeof v === "object" && !Array.isArray(v);

const deepEqual = (a: any, b: any) => {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
};

/**
 * Find all occurrences of `fieldKey` inside a POJO, returning dot-paths and current values.
 * - Traverses nested objects
 * - Traverses arrays with [idx]
 * - Special handling for `additionalFields` & `employeerOnlyAdditionalFields` arrays
 */
function findOccurrencesInEmployeePOJO(
  root: Plain,
  fieldKey: string,
  basePath = "employeeFields"
) {
  const results: Array<{ path: string; currentValue: any }> = [];

  const walk = (node: any, path: string) => {
    if (!node) return;

    // Special arrays: additionalFields & employeerOnlyAdditionalFields
    if (
      Array.isArray(node) &&
      (path.endsWith(".additionalFields") ||
        path.endsWith(".employeerOnlyAdditionalFields"))
    ) {
      node.forEach((item, i) => {
        if (item && item.fieldKey === fieldKey) {
          results.push({
            path: `${path}[${i}].value`,
            currentValue: item.value,
          });
        }
      });
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, `${path}[${i}]`));
      return;
    }

    if (isPlainObject(node)) {
      for (const k of Object.keys(node)) {
        const child = node[k];

        // direct match on property name
        if (k === fieldKey) {
          results.push({
            path: `${path}.${k}`,
            currentValue: child,
          });
        }

        walk(child, `${path}.${k}`);
      }
    }
  };

  walk(root?.employeeFields ?? {}, basePath);
  return results;
}

/** Sets deep value by dot/bracket path (supports [idx]) */
function setByPath(obj: any, path: string, value: any) {
  const tokens = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
  let cur = obj;
  for (let i = 0; i < tokens.length - 1; i++) {
    const t = tokens[i]!;
    if (!(t in cur) || typeof cur[t] !== "object" || cur[t] === null) {
      // Decide if next token is index → create array; else object
      const next = tokens[i + 1]!;
      const isIndex = /^\d+$/.test(next);
      cur[t] = isIndex ? [] : {};
    }
    cur = cur[t];
  }
  cur[tokens[tokens.length - 1]!] = value;
}

/** Get all branch Employees for a given EmployeeProfile */
async function getEmployeesByProfileId(profileId: Types.ObjectId) {
  return EmployeeModel.find({
    employeeProfile: profileId,
  })
    .populate("branchId", "name")
    .lean();
}

/** Get EmployeeProfile (main profile) */
async function getMainProfile(profileId: Types.ObjectId) {
  return EmployeeProfile.findById(profileId).lean();
}

/**
 * Find occurrences of `fieldKey` in main profile (core + additionalFields)
 * Return dot paths under the profile document.
 */
function findOccurrencesInMainProfile(
  profileDoc: any,
  fieldKey: string,
  basePath = ""
) {
  const results: Array<{ path: string; currentValue: any }> = [];

  // additionalFields (profile)
  const addPath = "additionalFields";
  const adds = profileDoc?.additionalFields || [];
  if (Array.isArray(adds)) {
    adds.forEach((item: any, i: number) => {
      if (item?.fieldKey === fieldKey) {
        results.push({
          path: `${addPath}.${i}.value`,
          currentValue: item.value,
        });
      }
    });
  }

  // core scan: walk everything except additionalFields array to catch direct matches
  const walkCore = (node: any, path: string) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach((child, i) => walkCore(child, `${path}[${i}]`));
      return;
    }
    if (isPlainObject(node)) {
      for (const k of Object.keys(node)) {
        if (k === "additionalFields") continue; // handled
        const child = node[k];
        if (k === fieldKey) {
          results.push({
            path: path ? `${path}.${k}` : k,
            currentValue: child,
          });
        }
        walkCore(child, path ? `${path}.${k}` : k);
      }
    }
  };

  walkCore(profileDoc || {}, basePath);
  return results;
}

/** ---------- Public service API ---------- */

export type PreviewInput = {
  profileId: Types.ObjectId; // employeeProfile._id for the person
  fieldKey: string;
  newValue: any; // what the user typed/uploaded in the current branch
};

export type PreviewResult = {
  fieldKey: string;
  mainProfile: {
    exists: boolean;
    differs: boolean;
    occurrences: Array<{ path: string; currentValue: any }>;
  };
  branches: Array<{
    employeeId: string;
    branchId: string;
    branchName?: string;
    occurrences: Array<{ path: string; currentValue: any }>;
    differs: boolean; // at least one occurrence differs from newValue
  }>;
};

/**
 * PREVIEW: show which branches (and main) differ for this fieldKey vs newValue.
 * We do NOT mutate anything here.
 */
export async function previewPropagation({
  profileId,
  fieldKey,
  newValue,
}: PreviewInput): Promise<PreviewResult> {
  const [employees, profile] = await Promise.all([
    getEmployeesByProfileId(profileId),
    getMainProfile(profileId),
  ]);

  // main profile scan
  const mainOcc = findOccurrencesInMainProfile(profile, fieldKey);
  const mainExists = mainOcc.length > 0;
  const mainDiffers = mainOcc.some((o) => !deepEqual(o.currentValue, newValue));

  // branch scans
  const branches = employees.map((emp: any) => {
    const occ = findOccurrencesInEmployeePOJO(emp, fieldKey);
    const differs = occ.some((o) => !deepEqual(o.currentValue, newValue));
    return {
      employeeId: String(emp._id),
      branchId: String(emp.branchId?._id || emp.branchId),
      branchName: emp.branchId?.name,
      occurrences: occ,
      differs,
    };
  });

  // ONLY return branches where it differs
  const filteredBranches = branches.filter(
    (b) => b.occurrences.length && b.differs
  );

  return {
    fieldKey,
    mainProfile: {
      exists: mainExists,
      differs: mainDiffers,
      occurrences: mainOcc,
    },
    branches: filteredBranches,
  };
}

export type ApplyInput = {
  profileId: Types.ObjectId;
  fieldKey: string;
  newValue: any;
  targetBranchIds?: string[]; // branches chosen in UI to update (subset of profile's branches)
  updateMainProfile?: boolean; // checkbox: "update/add main profile"
  // Optional: if you want strict replace semantics for documents, etc., pass flags later
};

// ----------------------------------------

// naive, safe path validator – we only allow updates inside employeeFields.*
// and we disallow array numeric notation in $set to avoid accidental new sparse arrays.
// (If you DO want numeric array indexes, relax this.)
function isSafeEmployeePath(path: string) {
  if (!path || typeof path !== "string") return false;
  if (!path.startsWith("employeeFields.")) return false;
  // disallow something like '..' or '$' or positional updates
  if (path.includes("..") || path.includes("$")) return false;
  // basic defense against array index creation; allow plain segments only
  return path.split(".").every((seg) => !!seg && !/^\d+$/.test(seg));
}

// find all dotted paths under employee.employeeFields whose last segment === fieldKey
function findPathsByFieldKeyInEmployee(
  employeeDoc: any,
  fieldKey: string
): string[] {
  const root = employeeDoc?.employeeFields || {};
  const out: string[] = [];

  const walk = (node: any, prefix: string) => {
    if (node && typeof node === "object" && !Array.isArray(node)) {
      for (const k of Object.keys(node)) {
        const nextPrefix = prefix ? `${prefix}.${k}` : k;
        const v = node[k];
        if (k === fieldKey) {
          out.push(`employeeFields.${nextPrefix}`);
        }
        if (v && typeof v === "object") {
          walk(v, nextPrefix);
        }
      }
    }
  };

  walk(root, "");
  return out;
}

// find every occurrence of fieldKey in the EmployeeProfile (ignoring sections)
function findPathsByFieldKeyInProfile(
  profileDoc: any,
  fieldKey: string
): string[] {
  const out: string[] = [];
  const skipKeys = new Set([
    "_id",
    "userId",
    "createdAt",
    "updatedAt",
    "__v",
    "additionalFields",
  ]); // handle additionalFields separately

  const walk = (node: any, prefix: string) => {
    if (node && typeof node === "object" && !Array.isArray(node)) {
      for (const k of Object.keys(node)) {
        if (skipKeys.has(k)) continue;
        const nextPrefix = prefix ? `${prefix}.${k}` : k;
        const v = node[k];
        if (k === fieldKey) {
          out.push(nextPrefix); // profile paths do NOT start with employeeFields
        }
        if (v && typeof v === "object") {
          walk(v, nextPrefix);
        }
      }
    }
  };

  walk(profileDoc, "");
  return out;
}

// update Employee.additionalFields: upsert by fieldKey
async function upsertEmployeeAdditionalField(
  employeeId: Types.ObjectId,
  fieldKey: string,
  value: any,
  session?: ClientSession
) {
  const emp = await EmployeeModel.findById(employeeId).session(session || null);
  if (!emp) return;

  const fields = emp.employeeFields?.additionalFields || [];
  const idx = fields.findIndex((f: any) => f && f.fieldKey === fieldKey);
  if (idx >= 0) {
    fields[idx].value = value;
  } else {
    fields.push({ fieldKey, value });
  }

  await EmployeeModel.updateOne(
    { _id: employeeId, isDeleted: false },
    { $set: { "employeeFields.additionalFields": fields } },
    { session }
  );
}

// update EmployeeProfile.additionalFields: upsert by fieldKey
async function upsertProfileAdditionalField(
  profileId: Types.ObjectId,
  fieldKey: string,
  value: any,
  session?: ClientSession
) {
  const profile = await EmployeeProfile.findById(profileId).session(
    session || null
  );
  if (!profile) return;

  const fields = Array.isArray(profile.additionalFields)
    ? [...profile.additionalFields]
    : [];
  const idx = fields.findIndex((f: any) => f && f.fieldKey === fieldKey);
  if (idx >= 0) {
    (fields[idx] as any).value = value;
  } else {
    fields.push({ fieldKey, value });
  }

  await EmployeeProfile.updateOne(
    { _id: profileId },
    { $set: { additionalFields: fields } },
    { session }
  );
}

export type ApplyServiceInput = {
  profileId: Types.ObjectId;
  fieldKey: string;
  newValue: any;
  selections: Array<{ branchId: string; paths?: string[] }>;
  updateMainProfile: boolean;
};

/**
 * APPLY: update the chosen branches and (optionally) main profile.
 * Rules:
 *  - For each selected branch:
 *      - If occurrences found → update all occurrences for this fieldKey
 *      - If none found → create an additionalFields entry with this fieldKey + value
 *  - For main profile:
 *      - If occurrences found → update all occurrences
 *      - Else → push into additionalFields as { fieldKey, value }
 */

export async function applyPropagation(
  {
    profileId,
    fieldKey,
    newValue,
    selections,
    updateMainProfile,
  }: ApplyServiceInput,
  session?: ClientSession
) {
  const employees = await getEmployeesByProfileId(profileId);
  const byBranchId = new Map<string, any>();
  employees.forEach((e) =>
    byBranchId.set(String(e.branchId?._id || e.branchId), e)
  );

  let branchUpdatedCount = 0;

  // 1) Branch updates
  for (const sel of selections || []) {
    const branchId = String(sel.branchId);
    const emp = byBranchId.get(branchId);
    if (!emp) continue;

    const explicitPaths = (sel.paths || []).filter(isSafeEmployeePath);

    let setSpec: Record<string, any> = {};
    if (explicitPaths.length) {
      // use the paths FE gave us
      explicitPaths.forEach((p) => {
        setSpec[p] = newValue;
      });
    } else {
      // fallback: search by fieldKey in employeeFields
      const discovered = findPathsByFieldKeyInEmployee(emp, fieldKey);
      discovered.forEach((p) => {
        setSpec[p] = newValue;
      });
    }

    if (Object.keys(setSpec).length > 0) {
      await EmployeeModel.updateOne(
        { _id: emp._id, isDeleted: false },
        { $set: setSpec },
        { session }
      );
      branchUpdatedCount++;
    } else {
      // nothing to update by path → upsert into additionalFields
      await upsertEmployeeAdditionalField(emp._id, fieldKey, newValue, session);
      branchUpdatedCount++;
    }
  }

  // 2) Main profile update
  let mainUpdated = false;
  if (updateMainProfile) {
    const profileDoc = await EmployeeProfile.findById(profileId).lean();
    if (profileDoc) {
      const profilePaths = findPathsByFieldKeyInProfile(profileDoc, fieldKey);

      if (profilePaths.length > 0) {
        const setSpec: Record<string, any> = {};
        profilePaths.forEach((p) => (setSpec[p] = newValue));

        await EmployeeProfile.updateOne(
          { _id: profileId },
          { $set: setSpec },
          { session }
        );
        mainUpdated = true;
      } else {
        await upsertProfileAdditionalField(
          profileId,
          fieldKey,
          newValue,
          session
        );
        mainUpdated = true;
      }
    }
  }

  return {
    ok: true,
    updatedBranches: branchUpdatedCount,
    mainUpdated,
  };
}
