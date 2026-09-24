import type { Document } from "mongoose";
import EmployeeModel from "../employee/employee.model";
import { EmployeeProfile } from "./employeeProfile.model";

// A tiny deep equal that’s fast enough for our payloads
export const deepEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

export type ProposedField = {
  fieldKey: string;
  profilePath: string; // e.g. 'personaldetails.firstname' or 'documents.identificationdocuments.passport'
  value: any;
};

// propagation.util.ts
export function normalizeProfileUpdatesToFields(updates: any): ProposedField[] {
  if (!updates || typeof updates !== "object") return [];

  type Pair = { key: string; path: string; value: any };
  const pairs: Pair[] = [];

  const isFileLike = (v: any) =>
    v && typeof v === "object" && typeof v.url === "string";

  const visit = (sectionKey: string, node: any, path: string) => {
    if (node === null || node === undefined) return;

    // arrays (e.g., address[])
    if (Array.isArray(node)) {
      node.forEach((item, i) => visit(sectionKey, item, `${path}[${i}]`));
      return;
    }

    // objects
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        const nextPath = path ? `${path}.${k}` : `${sectionKey}.${k}`;

        if (
          v === null ||
          typeof v !== "object" ||
          isFileLike(v) // treat file {url:...} as a leaf
        ) {
          pairs.push({ key: String(k), path: nextPath, value: v });
        } else {
          visit(sectionKey, v, nextPath);
        }
      }
      return;
    }

    // primitives at section root are rare, but no-op here
  };

  for (const [sectionKey, sectionVal] of Object.entries(updates)) {
    if (sectionKey === "additionalFields" && Array.isArray(sectionVal)) {
      for (const a of sectionVal) {
        if (a?.fieldKey != null) {
          pairs.push({
            key: String(a.fieldKey),
            path: `additionalFields[fieldKey=${a.fieldKey}]`,
            value: a.value,
          });
        }
      }
      continue;
    }
    if (typeof sectionVal === "object") {
      visit(sectionKey, sectionVal, sectionKey); // <-- dynamic: covers personaldetails, address, documents, etc.
    }
  }

  // last write wins per fieldKey
  const latest = new Map<string, ProposedField>();
  for (const p of pairs) {
    latest.set(p.key, { fieldKey: p.key, profilePath: p.path, value: p.value });
  }
  return Array.from(latest.values());
}

export type EmployeeFieldTarget =
  | { kind: "path"; employeePath: string } // e.g. 'employeeFields.personaldetails.firstname'
  | { kind: "additionalField"; fieldKey: string }; // in array

/**
 * Build a map of fieldKey -> targets present in a single Employee’s employeeFields
 * This ignores sections and only indexes by the leaf key, as requested.
 */
export function indexEmployeeFieldsByFieldKey(
  emp: any
): Map<string, EmployeeFieldTarget[]> {
  const map = new Map<string, EmployeeFieldTarget[]>();
  const root = emp?.employeeFields || {};

  // personaldetails
  if (root.personaldetails && typeof root.personaldetails === "object") {
    for (const k of Object.keys(root.personaldetails)) {
      push(map, k, {
        kind: "path",
        employeePath: `employeeFields.personaldetails.${k}`,
      });
    }
  }

  // documents
  const DOC_GROUPS = [
    "identificationdocuments",
    "certificates",
    "checksandclearance",
  ];
  if (root.documents && typeof root.documents === "object") {
    for (const grp of DOC_GROUPS) {
      if (root.documents[grp] && typeof root.documents[grp] === "object") {
        for (const k of Object.keys(root.documents[grp])) {
          push(map, k, {
            kind: "path",
            employeePath: `employeeFields.documents.${grp}.${k}`,
          });
        }
      }
    }
  }

  // additionalFields
  if (Array.isArray(root.additionalFields)) {
    for (const af of root.additionalFields) {
      if (af?.fieldKey) {
        push(map, String(af.fieldKey), {
          kind: "additionalField",
          fieldKey: String(af.fieldKey),
        });
      }
    }
  }

  return map;
}

function push<K, V>(map: Map<K, V[]>, key: K, val: V) {
  const prev = map.get(key) || [];
  prev.push(val);
  map.set(key, prev);
}

// propagation.util.ts
export type NormalizedFieldUpdate = {
  fieldKey: string;
  profilePath: string; // e.g. 'personaldetails.firstname' or 'documents.identificationdocuments.passport'
  value: any;

  // 🆕 for UI reference
  sectionKey?: string; // e.g. 'documents' | 'personaldetails'
  innerSectionKey?: string | null; // e.g. 'identificationdocuments' | null
};

/**
 * Normalize the *incoming profile updates* into a flat list of {fieldKey, profilePath, value}
 * We intentionally match by the last key name only (fieldKey), per your requirement.
 * Sections handled: personaldetails, documents.* groups, additionalFields
 */
// export function normalizeProfileUpdatesToFields(updates: any): ProposedField[] {
//   const pairs: Array<{ key: string; path: string; value: any }> = [];
//   if (!updates || typeof updates !== "object") return [];

//   // personaldetails
//   if (updates.personaldetails && typeof updates.personaldetails === "object") {
//     for (const [k, v] of Object.entries(updates.personaldetails)) {
//       pairs.push({ key: String(k), path: `personaldetails.${k}`, value: v });
//     }
//   }

//   // documents
//   const DOC_GROUPS = [
//     "identificationdocuments",
//     "certificates",
//     "checksandclearance",
//   ] as const;
//   if (updates.documents && typeof updates.documents === "object") {
//     for (const grp of DOC_GROUPS) {
//       const g = updates.documents[grp];
//       if (g && typeof g === "object") {
//         for (const [k, v] of Object.entries(g)) {
//           pairs.push({
//             key: String(k),
//             path: `documents.${grp}.${k}`,
//             value: v,
//           });
//         }
//       }
//     }
//   }

//   // additionalFields (optional)
//   if (Array.isArray(updates.additionalFields)) {
//     for (const a of updates.additionalFields) {
//       if (a?.fieldKey != null) {
//         pairs.push({
//           key: String(a.fieldKey),
//           path: `additionalFields[fieldKey=${a.fieldKey}]`,
//           value: a.value,
//         });
//       }
//     }
//   }

//   // last write wins per fieldKey
//   const latest = new Map<string, ProposedField>();
//   for (const p of pairs) {
//     latest.set(p.key, { fieldKey: p.key, profilePath: p.path, value: p.value });
//   }
//   return Array.from(latest.values());
// }
