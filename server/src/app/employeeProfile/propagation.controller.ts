// // propagation.controller.ts
// import { Request, Response } from "express";
// import mongoose from "mongoose";
// import EmployeeModel from "@/database/models/employee.model";
// import {
//   deepEqual,
//   normalizeProfileUpdatesToFields,
//   indexEmployeeFieldsByFieldKey,
//   EmployeeFieldTarget,
// } from "./propagation.util";
// import { EmployeeProfile } from "@/database/models/employeeProfile.model";

// // ---------- Types returned to UI (compact & fieldKey-based) ----------
// type OrgFieldPreview = {
//   employeeId: string;
//   tenantId: string;
//   branchId: string;
//   tenantName?: string;
//   branchName?: string;

//   fieldKey: string;

//   /** total occurrences (paths or additionalFields) this key has on this employee */
//   occurrences: number;

//   /** how many of those occurrences are currently "empty" (null/undefined/""/[]/{}) */
//   emptyOccurrences: number;

//   /** how many occurrences would be modified by applying the new value */
//   willChangeOccurrences: number;
// };

// type PreviewResponse = {
//   overlaps: OrgFieldPreview[];
// };

// /** tiny helpers */
// const isPlainObject = (v: any) =>
//   v && typeof v === "object" && !Array.isArray(v);
// const isEmptyObject = (v: any) =>
//   isPlainObject(v) && Object.keys(v).length === 0;
// const isEmptyValue = (v: any) =>
//   v === null ||
//   v === undefined ||
//   v === "" ||
//   (Array.isArray(v) && v.length === 0) ||
//   isEmptyObject(v);

// /**
//  * POST /employee-profiles/self/preview-propagation
//  * Body: { updates: Partial<EmployeeProfileInput> }
//  *
//  * Returns one row per (employee, fieldKey) if at least one occurrence would change.
//  * Also includes how many occurrences are empty so the UI can message "fill blanks".
//  * No paths, no values.
//  */
// export const previewPropagation = async (req: Request, res: Response) => {
//   const userId = (req as any)?.user?.userId;
//   if (!userId) return res.status(401).json({ message: "Unauthorized" });

//   const { updates } = req.body || {};
//   if (!updates || typeof updates !== "object") {
//     return res.status(400).json({ message: "Missing updates" });
//   }

//   const profile = await EmployeeProfile.findOne({ userId }, { _id: 1 }).lean();
//   if (!profile) return res.status(404).json({ message: "Profile not found" });

//   // Flatten incoming profile changes to fieldKey-level
//   const proposed = normalizeProfileUpdatesToFields(updates);
//   if (!proposed.length) return res.json(<PreviewResponse>{ overlaps: [] });

//   // Dedup proposed by fieldKey (last write wins)
//   const latestByKey = new Map<string, any>();
//   proposed.forEach((p) => latestByKey.set(p.fieldKey, p.value));

//   // Fetch org employees for this profile
//   const employees = await EmployeeModel.find({
//     employeeProfile: profile._id,
//     isDeleted: false,
//   })
//     .select({
//       tenantId: 1,
//       branchId: 1,
//       employeeFields: 1,
//     })
//     .populate({ path: "tenantId", select: "name" })
//     .populate({ path: "branchId", select: "name" })
//     .lean();

//   const overlaps: OrgFieldPreview[] = [];

//   for (const emp of employees) {
//     const index = indexEmployeeFieldsByFieldKey(emp);

//     for (const [fieldKey, newValue] of latestByKey.entries()) {
//       const targets = index.get(fieldKey);
//       if (!targets?.length) continue;

//       let occurrences = 0;
//       let emptyOccurrences = 0;
//       let willChangeOccurrences = 0;

//       for (const t of targets) {
//         occurrences++;

//         let oldValue: any;
//         if (t.kind === "path") {
//           oldValue = safeGet(emp, t.employeePath);
//         } else {
//           const found = Array.isArray(emp?.employeeFields?.additionalFields)
//             ? emp.employeeFields.additionalFields.find(
//                 (a: any) => a?.fieldKey === t.fieldKey
//               )
//             : null;
//           oldValue = found?.value;
//         }

//         if (isEmptyValue(oldValue)) emptyOccurrences++;
//         if (!deepEqual(oldValue, newValue)) willChangeOccurrences++;
//       }

//       // Only surface if at least one occurrence would actually change
//       if (willChangeOccurrences > 0) {
//         overlaps.push({
//           employeeId: String(emp._id),
//           tenantId: String((emp as any).tenantId?._id || emp.tenantId),
//           branchId: String((emp as any).branchId?._id || emp.branchId),
//           tenantName: (emp as any).tenantId?.name,
//           branchName: (emp as any).branchId?.name,
//           fieldKey,
//           occurrences,
//           emptyOccurrences,
//           willChangeOccurrences,
//         });
//       }
//     }
//   }

//   return res.json(<PreviewResponse>{ overlaps });
// };

// export const applyPropagation = async (req: Request, res: Response) => {
//   const userId = (req as any)?.user?.userId;
//   if (!userId) return res.status(401).json({ message: "Unauthorized" });

//   const { selections } = req.body || {};
//   if (!Array.isArray(selections) || selections.length === 0) {
//     return res.status(400).json({ message: "No selections provided" });
//   }

//   const profile = await EmployeeProfile.findOne({ userId }, { _id: 1 }).lean();
//   if (!profile) return res.status(404).json({ message: "Profile not found" });

//   // Normalize selections → (employeeId, fieldKey, value), last write wins per (emp,key)
//   type NormSel = { employeeId: string; fieldKey: string; value: any };
//   const normMap = new Map<string, NormSel>(); // key: `${empId}::${fieldKey}`

//   for (const s of selections) {
//     if (!s) continue;
//     const employeeId = String(s.employeeId || "");
//     if (!employeeId) continue;

//     // new shape
//     if (s.fieldKey) {
//       const fieldKey = String(s.fieldKey);
//       normMap.set(`${employeeId}::${fieldKey}`, {
//         employeeId,
//         fieldKey,
//         value: s.value,
//       });
//       continue;
//     }

//     // legacy shape { target }
//     const t: EmployeeFieldTarget | undefined = (s as any).target;
//     if (t?.kind === "path") {
//       const leaf = t.employeePath?.split(".").pop();
//       if (leaf) {
//         normMap.set(`${employeeId}::${leaf}`, {
//           employeeId,
//           fieldKey: leaf,
//           value: s.value,
//         });
//       }
//     } else if (t?.kind === "additionalField" && t.fieldKey) {
//       const fieldKey = String(t.fieldKey);
//       normMap.set(`${employeeId}::${fieldKey}`, {
//         employeeId,
//         fieldKey,
//         value: s.value,
//       });
//     }
//   }

//   const byEmp = new Map<
//     string,
//     { fieldValues: Map<string, any> } // fieldKey -> value
//   >();
//   for (const sel of normMap.values()) {
//     const bucket = byEmp.get(sel.employeeId) || { fieldValues: new Map() };
//     bucket.fieldValues.set(sel.fieldKey, sel.value);
//     byEmp.set(sel.employeeId, bucket);
//   }

//   const results: Array<{ employeeId: string; modified: number }> = [];

//   for (const [empId, bucket] of byEmp) {
//     // ensure employee belongs to this profile
//     const filter = {
//       _id: new mongoose.Types.ObjectId(empId),
//       employeeProfile: profile._id,
//       isDeleted: false,
//     };

//     const emp = await EmployeeModel.findOne(filter)
//       .select({
//         employeeFields: 1,
//       })
//       .lean();

//     if (!emp) {
//       results.push({ employeeId: empId, modified: 0 });
//       continue;
//     }

//     const index = indexEmployeeFieldsByFieldKey(emp);
//     const setObj: Record<string, any> = {};
//     const toPush: Array<{ fieldKey: string; value: any }> = [];

//     // map of fieldKey -> array of indices in additionalFields
//     const existingAF: Array<{ fieldKey: string; value: any }> =
//       (emp as any)?.employeeFields?.additionalFields || [];
//     const afIdxMap = new Map<string, number[]>();
//     existingAF.forEach((row, idx) => {
//       if (!row?.fieldKey) return;
//       const key = String(row.fieldKey);
//       const arr = afIdxMap.get(key) || [];
//       arr.push(idx);
//       afIdxMap.set(key, arr);
//     });

//     for (const [fieldKey, val] of bucket.fieldValues.entries()) {
//       const targets = index.get(fieldKey) || [];

//       // set all path occurrences
//       for (const t of targets) {
//         if (t.kind === "path") {
//           // SECURITY: only allow writes under employeeFields.*
//           if (t.employeePath?.startsWith("employeeFields.")) {
//             setObj[t.employeePath] = val;
//           }
//         }
//       }

//       // set/update all additionalFields occurrences; push one if none exist
//       const indices = afIdxMap.get(fieldKey) || [];
//       if (indices.length) {
//         for (const idx of indices) {
//           setObj[`employeeFields.additionalFields.${idx}.value`] = val;
//         }
//       } else {
//         toPush.push({ fieldKey, value: val });
//       }
//     }

//     const update: any = {};
//     if (Object.keys(setObj).length) update.$set = setObj;
//     if (toPush.length) {
//       update.$push = {
//         "employeeFields.additionalFields": { $each: toPush },
//       };
//     }

//     if (!update.$set && !update.$push) {
//       results.push({ employeeId: empId, modified: 0 });
//       continue;
//     }

//     const r = await EmployeeModel.updateOne(filter, update);
//     results.push({ employeeId: empId, modified: r.modifiedCount || 0 });
//   }

//   return res.json({ ok: true, results });
// };

// // --- tiny safe getter ---
// function safeGet(obj: any, path: string) {
//   if (!obj || !path) return undefined;
//   const parts = path.split(".");
//   let cur = obj;
//   for (const p of parts) {
//     if (cur == null) return undefined;
//     cur = cur[p];
//   }
//   return cur;
// }

// propagation.controller.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import EmployeeModel from "@/database/models/employee.model";
import { EmployeeProfile } from "@/database/models/employeeProfile.model";
import EmployeeFieldConfig from "@/database/models/EmployeeFieldConfig";
import { deepEqual, normalizeProfileUpdatesToFields } from "./propagation.util";

/* ---------- Types sent to UI ---------- */
type OrgFieldPreview = {
  employeeId: string;
  tenantId: string;
  branchId: string;
  tenantName?: string;
  branchName?: string;
  fieldKey: string;
  /** total occurrences for this key in this org (from CONFIG) */
  occurrences: number;
  /** how many of those occurrences are currently "empty" */
  emptyOccurrences: number;
  /** how many occurrences would change if we apply the new value */
  willChangeOccurrences: number;
};

type PreviewResponse = { overlaps: OrgFieldPreview[] };

/* ---------- Small helpers ---------- */
function resolveArrayPositionalPath(doc: any, path: string): string {
  // Turns "a.b.c" into "a.b.$[].c" when "b" is an array in `doc`
  const parts = path.split(".");
  let cur: any = doc;
  const out: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];

    // If the next value is an array, insert $[] and descend into a sample element
    if (
      cur &&
      typeof cur === "object" &&
      !Array.isArray(cur) &&
      Array.isArray(cur[seg])
    ) {
      out.push(seg, "$[]");
      const arr = cur[seg] as any[];
      cur = arr && arr.length ? arr[0] : undefined; // descend into representative element
    } else {
      out.push(seg);
      cur = cur ? (cur as any)[seg] : undefined;
    }
  }

  return out.join(".");
}

const isPlainObject = (v: any) =>
  v && typeof v === "object" && !Array.isArray(v);
const isEmptyObject = (v: any) =>
  isPlainObject(v) && Object.keys(v).length === 0;
const isEmptyValue = (v: any) =>
  v === null ||
  v === undefined ||
  v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  isEmptyObject(v);

const safeGet = (obj: any, path: string) => {
  if (!obj || !path) return undefined;
  let cur = obj;
  for (const p of path.split(".")) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
};

/* ---------- Targets derived from CONFIG (not from employee) ---------- */
type Target =
  | { kind: "path"; employeePath: string }
  | { kind: "additionalField"; fieldKey: string };

function buildTargetIndexFromConfig(cfg: any): Map<string, Target[]> {
  const map = new Map<string, Target[]>();
  if (!cfg || !Array.isArray(cfg.sections)) return map;

  const push = (key: string, t: Target) => {
    const arr = map.get(key) || [];
    arr.push(t);
    map.set(key, arr);
  };

  for (const sec of cfg.sections) {
    const secKey = sec?.sectionKey;
    if (!secKey) continue;

    // top-level fields under the section
    for (const f of sec?.fields || []) {
      const fieldKey = f?.key;
      if (!fieldKey) continue;
      const isAdd = !!(f?.isAdditional || sec?.isAdditional);
      if (isAdd)
        push(String(fieldKey), {
          kind: "additionalField",
          fieldKey: String(fieldKey),
        });
      else
        push(String(fieldKey), {
          kind: "path",
          employeePath: `employeeFields.${secKey}.${fieldKey}`,
        });
    }

    // inner sections
    for (const inn of sec?.innerSections || []) {
      const innerKey = inn?.sectionKey;
      if (!innerKey) continue;

      for (const f of inn?.fields || []) {
        const fieldKey = f?.key;
        if (!fieldKey) continue;
        const isAdd = !!(
          f?.isAdditional ||
          inn?.isAdditional ||
          sec?.isAdditional
        );
        if (isAdd)
          push(String(fieldKey), {
            kind: "additionalField",
            fieldKey: String(fieldKey),
          });
        else
          push(String(fieldKey), {
            kind: "path",
            employeePath: `employeeFields.${secKey}.${innerKey}.${fieldKey}`,
          });
      }
    }
  }

  return map;
}

/* ---------- Cache configs per (tenantId, branchId) for this request ---------- */
async function getConfigFor(
  cache: Map<string, any>,
  tenantId: any,
  branchId: any
) {
  const key = `${String(tenantId)}::${String(branchId)}`;
  if (cache.has(key)) return cache.get(key);

  // Basic branch-level config (designation-aware could be added here if needed)
  const cfg = await EmployeeFieldConfig.findOne(
    { tenantId, branchId },
    { sections: 1 }
  ).lean();

  cache.set(key, cfg || null);
  return cfg;
}

/* =======================================
   PREVIEW (driven by CONFIG)
   ======================================= */
export const previewPropagation = async (req: Request, res: Response) => {
  const userId = (req as any)?.user?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { updates } = req.body || {};
  if (!updates || typeof updates !== "object")
    return res.status(400).json({ message: "Missing updates" });

  const profile = await EmployeeProfile.findOne({ userId }, { _id: 1 }).lean();
  if (!profile) return res.status(404).json({ message: "Profile not found" });

  // dedup incoming by fieldKey (last write wins)
  const props = normalizeProfileUpdatesToFields(updates);
  if (!props.length) return res.json(<PreviewResponse>{ overlaps: [] });
  const latestByKey = new Map<string, any>();
  props.forEach((p) => latestByKey.set(p.fieldKey, p.value));

  // employees referencing this profile
  const employees = await EmployeeModel.find({
    employeeProfile: profile._id,
    isDeleted: false,
  })
    .select({ tenantId: 1, branchId: 1, employeeFields: 1 })
    .populate({ path: "tenantId", select: "name" })
    .populate({ path: "branchId", select: "name" })
    .lean();

  const cfgCache = new Map<string, any>();
  const overlaps: OrgFieldPreview[] = [];

  for (const emp of employees) {
    const cfg = await getConfigFor(
      cfgCache,
      (emp as any).tenantId,
      (emp as any).branchId
    );
    if (!cfg) continue; // no config → nothing to match against
    const index = buildTargetIndexFromConfig(cfg);

    // Pre-scan additionalFields rows for this employee
    const af: Array<{ fieldKey?: string; value?: any }> =
      (emp as any)?.employeeFields?.additionalFields || [];

    for (const [fieldKey, newValue] of latestByKey.entries()) {
      const targets = index.get(fieldKey);
      if (!targets?.length) continue;

      // collect all additional rows for this key once
      const afValues = af
        .filter((r) => r?.fieldKey === fieldKey)
        .map((r) => r?.value);

      let occurrences = 0;
      let emptyOccurrences = 0;
      let willChangeOccurrences = 0;
      let addIdx = 0;

      for (const t of targets) {
        occurrences++;
        let oldValue: any;

        if (t.kind === "path") {
          oldValue = safeGet(emp, t.employeePath);
        } else {
          // consume one additional row value if present; else treat as empty
          oldValue = addIdx < afValues.length ? afValues[addIdx++] : undefined;
        }

        if (isEmptyValue(oldValue)) emptyOccurrences++;
        if (!deepEqual(oldValue, newValue)) willChangeOccurrences++;
      }

      if (willChangeOccurrences > 0) {
        overlaps.push({
          employeeId: String(emp._id),
          tenantId: String((emp as any).tenantId?._id || emp.tenantId),
          branchId: String((emp as any).branchId?._id || emp.branchId),
          tenantName: (emp as any).tenantId?.name,
          branchName: (emp as any).branchId?.name,
          fieldKey,
          occurrences,
          emptyOccurrences,
          willChangeOccurrences,
        });
      }
    }
  }

  return res.json(<PreviewResponse>{ overlaps });
};

/* =======================================
   APPLY (update all config-defined occurrences)
   ======================================= */
export const applyPropagation = async (req: Request, res: Response) => {
  const userId = (req as any)?.user?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { selections } = req.body || {};
  if (!Array.isArray(selections) || selections.length === 0)
    return res.status(400).json({ message: "No selections provided" });

  const profile = await EmployeeProfile.findOne({ userId }, { _id: 1 }).lean();
  if (!profile) return res.status(404).json({ message: "Profile not found" });

  // normalize to { employeeId, fieldKey, value }, last write wins per (emp,key)
  type NormSel = { employeeId: string; fieldKey: string; value: any };
  const norm = new Map<string, NormSel>();

  for (const s of selections) {
    if (!s) continue;
    const employeeId = String(s.employeeId || "");
    if (!employeeId) continue;

    if (s.fieldKey) {
      const fieldKey = String(s.fieldKey);
      norm.set(`${employeeId}::${fieldKey}`, {
        employeeId,
        fieldKey,
        value: s.value,
      });
    } else if ((s as any).target) {
      // legacy conversion
      const t = (s as any).target;
      if (t?.kind === "path") {
        const leaf = String(t.employeePath || "")
          .split(".")
          .pop();
        if (leaf)
          norm.set(`${employeeId}::${leaf}`, {
            employeeId,
            fieldKey: leaf,
            value: s.value,
          });
      } else if (t?.kind === "additionalField" && t.fieldKey) {
        const fieldKey = String(t.fieldKey);
        norm.set(`${employeeId}::${fieldKey}`, {
          employeeId,
          fieldKey,
          value: s.value,
        });
      }
    }
  }

  const cfgCache = new Map<string, any>();
  const results: Array<{ employeeId: string; modified: number }> = [];

  // group by employee
  const byEmp = new Map<string, Map<string, any>>(); // empId -> (fieldKey -> value)
  for (const v of norm.values()) {
    const m = byEmp.get(v.employeeId) || new Map<string, any>();
    m.set(v.fieldKey, v.value);
    byEmp.set(v.employeeId, m);
  }

  for (const [empId, fields] of byEmp) {
    const filter = {
      _id: new mongoose.Types.ObjectId(empId),
      employeeProfile: profile._id,
      isDeleted: false,
    };

    const emp = await EmployeeModel.findOne(filter)
      .select({ tenantId: 1, branchId: 1, employeeFields: 1 })
      .lean();

    if (!emp) {
      results.push({ employeeId: empId, modified: 0 });
      continue;
    }

    // CONFIG drives where to write
    const cfg = await getConfigFor(
      cfgCache,
      (emp as any).tenantId,
      (emp as any).branchId
    );
    if (!cfg) {
      results.push({ employeeId: empId, modified: 0 });
      continue;
    }
    const index = buildTargetIndexFromConfig(cfg);

    // map existing additionalFields indices by fieldKey
    const existingAF: Array<{ fieldKey?: string; value?: any }> =
      (emp as any)?.employeeFields?.additionalFields || [];
    const afIdxMap = new Map<string, number[]>();
    existingAF.forEach((row, idx) => {
      if (!row?.fieldKey) return;
      const key = String(row.fieldKey);
      const arr = afIdxMap.get(key) || [];
      arr.push(idx);
      afIdxMap.set(key, arr);
    });

    const setObj: Record<string, any> = {};
    const toPush: Array<{ fieldKey: string; value: any }> = [];

    for (const [fieldKey, val] of fields) {
      const targets = index.get(fieldKey) || [];
      if (!targets.length) continue;

      // path-backed writes
      for (const t of targets) {
        if (
          t.kind === "path" &&
          t.employeePath?.startsWith("employeeFields.")
        ) {
          const setPath = resolveArrayPositionalPath(emp, t.employeePath);
          setObj[setPath] = val;
        }
      }

      // additional-backed writes
      const configAddCount = targets.filter(
        (t) => t.kind === "additionalField"
      ).length;
      if (configAddCount > 0) {
        const indices = afIdxMap.get(fieldKey) || [];
        // set all existing rows for this key
        for (const idx of indices)
          setObj[`employeeFields.additionalFields.${idx}.value`] = val;
        // if config expects more occurrences than we have rows, push the difference
        const need = Math.max(0, configAddCount - indices.length);
        for (let i = 0; i < need; i++) toPush.push({ fieldKey, value: val });
      }
    }

    const update: any = {};
    if (Object.keys(setObj).length) update.$set = setObj;
    if (toPush.length)
      update.$push = { "employeeFields.additionalFields": { $each: toPush } };

    if (!update.$set && !update.$push) {
      results.push({ employeeId: empId, modified: 0 });
      continue;
    }

    const r = await EmployeeModel.updateOne(filter, update);
    results.push({ employeeId: empId, modified: r.modifiedCount || 0 });
  }

  return res.json({ ok: true, results });
};
