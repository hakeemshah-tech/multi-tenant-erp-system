import axiosInstance from "./axios";

export async function auditViewSection(params: {
  branchId: string;
  sectionKey: string;
  innerSectionKey?: string | null;
}) {
  try {
    await axiosInstance.post(
      `/audit/view-employer-employee-section/${params.branchId}`,
      {
        sectionKey: params.sectionKey,
        innerSectionKey: params.innerSectionKey ?? null,
      },
      { headers: { "x-audit": "1" } }
    );
  } catch (err) {
    // best-effort: do not block UI
    // console.warn("audit view failed", err);
  }
}

// // lib/utils.ts
// import { clsx } from "clsx";
// import { twMerge } from "tailwind-merge";
// import type { FieldConfig, SectionConfig } from "@/app/types/index";

// // Combines clsx and tailwind-merge for clean class handling
// export function cn(...inputs: unknown[]) {
//   return twMerge(clsx(inputs));
// }

// /** Endpoint builder */
// export const SAVE_ENDPOINT = (branchId: string | undefined | null) =>
//   `/employees/me/org-fields/${branchId}`;

// /* ---------- Primitives ---------- */
// export const isObject = (v: any) =>
//   v && typeof v === "object" && !Array.isArray(v);
// export const isEmptyObject = (v: any) =>
//   isObject(v) && Object.keys(v).length === 0;

// export const deepClone = <T>(x: T): T => JSON.parse(JSON.stringify(x ?? {}));
// export const deepEqual = (a: any, b: any) => {
//   try {
//     return JSON.stringify(a) === JSON.stringify(b);
//   } catch {
//     return a === b;
//   }
// };

// export const isNonEmpty = (v: any) => {
//   if (v === null || v === undefined) return false;
//   if (typeof v === "string") return v.trim().length > 0;
//   if (Array.isArray(v)) return v.length > 0;
//   if (typeof v === "object") return Object.keys(v).length > 0;
//   return true;
// };

// export const shouldSendValue = (v: any) => {
//   if (v === null || v === undefined) return false;
//   if (typeof v === "string" && v.trim() === "") return false;
//   return true;
// };

// export const prettyLabel = (k: string) =>
//   k
//     .replace(/([a-z])([A-Z])/g, "$1 $2")
//     .replace(/[_\-]+/g, " ")
//     .replace(/\b\w/g, (m) => m.toUpperCase())
//     .trim();

// export const formatDatePretty = (dateString?: string | Date) => {
//   if (!dateString) return "—";
//   try {
//     const date = new Date(dateString);
//     return new Intl.DateTimeFormat("en-IN", {
//       day: "2-digit",
//       month: "long",
//       year: "numeric",
//     }).format(date);
//   } catch {
//     return "—";
//   }
// };

// /* ---------- Profile photo key matcher ---------- */
// export const isProfilePhotoField = (
//   sectionKey?: string,
//   fieldKey?: string
// ): boolean => {
//   if ((sectionKey || "").toLowerCase() !== "personaldetails") return false;
//   const k = (fieldKey || "").toLowerCase();
//   return ["employeephoto", "profilephoto", "photo", "avatar"].includes(k);
// };

// /* ---------- Data lookups ---------- */
// export function getProfileOrAdditionalValue(
//   employee: any,
//   sectionKey: string,
//   fieldKey: string,
//   innerKey?: string
// ) {
//   const root = employee?.employeeFields || {};
//   let val = innerKey
//     ? root?.[sectionKey]?.[innerKey]?.[fieldKey]
//     : root?.[sectionKey]?.[fieldKey];

//   if (!isNonEmpty(val)) {
//     const found = root?.additionalFields?.find(
//       (f: any) =>
//         f.sectionKey === sectionKey &&
//         f.fieldKey === fieldKey &&
//         (innerKey ? f.innerSectionKey === innerKey : !f.innerSectionKey)
//     );
//     return found?.value;
//   }
//   return val;
// }

// export function passesShowIf(
//   field: FieldConfig,
//   lookup: (key: string) => any
// ): boolean {
//   if (!field.showIf) return true;
//   const actual = lookup(field.showIf.fieldKey);
//   return field.showIf.operator === "equals"
//     ? actual === field.showIf.value
//     : actual !== field.showIf.value;
// }

// /** Trim address array rows and drop empty rows */
// export const sanitizeAddressArray = (
//   arr: any[],
//   visibleKeys: Set<string>
// ): any[] =>
//   (arr || [])
//     .map((addr) => {
//       const out: Record<string, any> = {};
//       Object.keys(addr || {}).forEach((k) => {
//         if (k === "id" || k === "_id") return;
//         if (!visibleKeys.has(k)) return; // drop hidden-by-showIf keys
//         const v = addr[k];
//         if (shouldSendValue(v)) out[k] = v;
//       });
//       return out;
//     })
//     .filter((obj) => Object.keys(obj).length > 0);

// /** Deep clean null/empty leaves */
// export const deepClean = (node: any): any => {
//   if (Array.isArray(node)) {
//     const arr = node
//       .map(deepClean)
//       .filter((x) => !(isObject(x) && !Object.keys(x).length));
//     return arr;
//   }
//   if (isObject(node)) {
//     const out: any = {};
//     Object.entries(node).forEach(([k, v]) => {
//       const cv = deepClean(v);
//       if (
//         cv !== null &&
//         cv !== undefined &&
//         !(typeof cv === "string" && cv.trim() === "") &&
//         !(Array.isArray(cv) && cv.length === 0) &&
//         !(isObject(cv) && Object.keys(cv).length === 0)
//       ) {
//         out[k] = cv;
//       }
//     });
//     return out;
//   }
//   return node;
// };

// /** Deep set utility */
// export function setDeep(obj: any, path: string, value: any) {
//   const parts = path.split(".");
//   let cur = obj;
//   while (parts.length > 1) {
//     const k = parts.shift() as string;
//     if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
//     cur = cur[k];
//   }
//   cur[parts[0]] = value;
// }

// /** JSON-diff for docs subtree */
// export const diffDocsSubtree = (prev: any = {}, next: any = {}) => {
//   const out: any = {};
//   const groups = new Set([
//     ...Object.keys(prev || {}),
//     ...Object.keys(next || {}),
//   ]);
//   groups.forEach((grp) => {
//     const p = prev?.[grp] || {};
//     const n = next?.[grp] || {};
//     const grpOut: any = {};
//     const keys = new Set([...Object.keys(p), ...Object.keys(n)]);
//     keys.forEach((k) => {
//       const pv = p[k];
//       const nv = n[k];
//       if (!deepEqual(pv, nv)) grpOut[k] = nv;
//     });
//     if (Object.keys(grpOut).length) out[grp] = grpOut;
//   });
//   return out;
// };

// /** Build additional-items payload for non-doc additional sections */
// export function buildAdditionalItems(section: SectionConfig, draftState: any) {
//   const lookup = (key: string) => {
//     if (key in draftState) return draftState[key];
//     const groups = draftState.__inners || {};
//     for (const g of Object.keys(groups)) {
//       if (key in (groups[g] || {})) return groups[g][key];
//     }
//     return undefined;
//   };

//   const items: Array<{
//     sectionKey: string;
//     innerSectionKey?: string;
//     fieldKey: string;
//     value: any;
//   }> = [];

//   // top-level
//   (section.fields || []).forEach((f) => {
//     if (!passesShowIf(f, lookup)) return;
//     const raw = draftState[f.key];
//     if (!shouldSendValue(raw)) return;
//     const value =
//       f.type === "file" && raw && typeof raw === "object" && "url" in raw
//         ? (raw as any).url
//         : raw;
//     items.push({
//       sectionKey: section.sectionKey,
//       fieldKey: f.key,
//       value,
//     });
//   });

//   // inner
//   (section.innerSections || []).forEach((inn) => {
//     (inn.fields || []).forEach((f) => {
//       if (!passesShowIf(f, lookup)) return;
//       const raw = draftState.__inners?.[inn.sectionKey]?.[f.key];
//       if (!shouldSendValue(raw)) return;
//       const value =
//         f.type === "file" && raw && typeof raw === "object" && "url" in raw
//           ? (raw as any).url
//           : raw;
//       items.push({
//         sectionKey: section.sectionKey,
//         innerSectionKey: inn.sectionKey,
//         fieldKey: f.key,
//         value,
//       });
//     });
//   });

//   return items;
// }

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { FieldConfig, SectionConfig } from "@/app/types/employee-fields";

// Combines clsx and tailwind-merge for clean class handling
export function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs));
}

/** Endpoint builders */
export const SAVE_ENDPOINT_BRANCH = (branchId: string | undefined | null) =>
  `/employees/me/org-fields/${branchId}`;
export const SAVE_ENDPOINT_EMPLOYEE = (
  id: string | string[] | undefined | null
) => `/employees/${id}/employee-fields`;

/* primitives */
export const isObject = (v: any) =>
  v && typeof v === "object" && !Array.isArray(v);
export const isEmptyObject = (v: any) =>
  isObject(v) && Object.keys(v).length === 0;
export const deepClone = <T>(x: T): T => JSON.parse(JSON.stringify(x ?? {}));
export const deepEqual = (a: any, b: any) => {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
};
export const isNonEmpty = (v: any) => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
};
export const shouldSendValue = (v: any) =>
  !(
    v === null ||
    v === undefined ||
    (typeof v === "string" && v.trim() === "")
  );

export const prettyLabel = (k: string) =>
  k
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();

export const formatDatePretty = (dateString?: string | Date) => {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return "—";
  }
};

/* profile photo field detector */
export const isProfilePhotoField = (
  sectionKey?: string,
  fieldKey?: string
): boolean => {
  if ((sectionKey || "").toLowerCase() !== "personaldetails") return false;
  const k = (fieldKey || "").toLowerCase();
  return ["employeephoto", "profilephoto", "photo", "avatar"].includes(k);
};

/* lookups */
export function getProfileOrAdditionalValue(
  employee: any,
  sectionKey: string,
  fieldKey: string,
  innerKey?: string
) {
  const root = employee?.employeeFields || {};

  // 1) Core structured value
  const v1 = innerKey
    ? root?.[sectionKey]?.[innerKey]?.[fieldKey]
    : root?.[sectionKey]?.[fieldKey];
  if (isNonEmpty(v1)) return v1;

  // Helper: search a list of additional fields
  const findIn = (list: any[] = []) =>
    list.find(
      (f: any) =>
        f?.sectionKey === sectionKey &&
        f?.fieldKey === fieldKey &&
        (innerKey ? f?.innerSectionKey === innerKey : !f?.innerSectionKey)
    );

  // 2) Regular additionalFields
  const fromAdd = findIn(root?.additionalFields);
  if (isNonEmpty(fromAdd?.value)) return fromAdd.value;

  // 3) Employer-only additional fields (admin-only store on the employee root)
  const fromEO = findIn(employee?.employeerOnlyAdditionalFields);
  return fromEO?.value;
}
export function passesShowIf(
  field: FieldConfig,
  lookup: (key: string) => any
): boolean {
  if (!field.showIf) return true;
  const actual = lookup(field.showIf.fieldKey);
  return field.showIf.operator === "equals"
    ? actual === field.showIf.value
    : actual !== field.showIf.value;
}

export const sanitizeAddressArray = (
  arr: any[],
  visibleKeys: Set<string>
): any[] =>
  (arr || [])
    .map((addr) => {
      const out: Record<string, any> = {};
      Object.keys(addr || {}).forEach((k) => {
        if (k === "id" || k === "_id") return;
        if (!visibleKeys.has(k)) return;
        const v = addr[k];
        if (shouldSendValue(v)) out[k] = v;
      });
      return out;
    })
    .filter((obj) => Object.keys(obj).length > 0);

export const deepClean = (node: any): any => {
  if (Array.isArray(node))
    return node
      .map(deepClean)
      .filter((x) => !(isObject(x) && !Object.keys(x).length));
  if (isObject(node)) {
    const out: any = {};
    Object.entries(node).forEach(([k, v]) => {
      const cv = deepClean(v);
      if (
        cv !== null &&
        cv !== undefined &&
        !(typeof cv === "string" && cv.trim() === "") &&
        !(Array.isArray(cv) && cv.length === 0) &&
        !(isObject(cv) && Object.keys(cv).length === 0)
      ) {
        out[k] = cv;
      }
    });
    return out;
  }
  return node;
};

export function setDeep(obj: any, path: string, value: any) {
  const parts = path.split(".");
  let cur = obj;
  while (parts.length > 1) {
    const k = parts.shift() as string;
    if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  cur[parts[0]] = value;
}

export const diffDocsSubtree = (prev: any = {}, next: any = {}) => {
  const out: any = {};
  const groups = new Set([
    ...Object.keys(prev || {}),
    ...Object.keys(next || {}),
  ]);
  groups.forEach((grp) => {
    const p = prev?.[grp] || {};
    const n = next?.[grp] || {};
    const grpOut: any = {};
    const keys = new Set([...Object.keys(p), ...Object.keys(n)]);
    keys.forEach((k) => {
      if (!deepEqual(p[k], n[k])) grpOut[k] = n[k];
    });
    if (Object.keys(grpOut).length) out[grp] = grpOut;
  });
  return out;
};

export function buildAdditionalItems(section: SectionConfig, draftState: any) {
  const lookup = (key: string) => {
    if (key in draftState) return draftState[key];
    const groups = draftState.__inners || {};
    for (const g of Object.keys(groups))
      if (key in (groups[g] || {})) return groups[g][key];
    return undefined;
  };

  const items: Array<{
    sectionKey: string;
    innerSectionKey?: string;
    fieldKey: string;
    value: any;
  }> = [];

  (section.fields || []).forEach((f) => {
    if (!passesShowIf(f, lookup)) return;
    const raw = draftState[f.key];
    if (!shouldSendValue(raw)) return;
    items.push({
      sectionKey: section.sectionKey,
      fieldKey: f.key,
      value: f.type === "file" && raw?.url ? raw.url : raw,
    });
  });

  (section.innerSections || []).forEach((inn) => {
    (inn.fields || []).forEach((f) => {
      if (!passesShowIf(f, lookup)) return;
      const raw = draftState.__inners?.[inn.sectionKey]?.[f.key];
      if (!shouldSendValue(raw)) return;
      items.push({
        sectionKey: section.sectionKey,
        innerSectionKey: inn.sectionKey,
        fieldKey: f.key,
        value: f.type === "file" && raw?.url ? raw.url : raw,
      });
    });
  });

  return items;
}
