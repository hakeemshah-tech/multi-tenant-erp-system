// =============================
// File: src/utils/common.ts
// =============================
export const isObject = (v: any) =>
  v && typeof v === "object" && !Array.isArray(v);
export const isEmptyObject = (v: any) =>
  isObject(v) && Object.keys(v).length === 0;
export const deepClone = <T = any>(x: T): T =>
  JSON.parse(JSON.stringify(x ?? {}));
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

export const shouldSendValue = (v: any) => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string" && v.trim() === "") return false;
  return true;
};

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

export const prettyLabel = (k: string) =>
  k
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();

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

export const deepClean = (node: any): any => {
  if (Array.isArray(node)) {
    return node
      .map(deepClean)
      .filter((x) => !(isObject(x) && !Object.keys(x).length));
  }
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
      const pv = p[k];
      const nv = n[k];
      if (!deepEqual(pv, nv)) grpOut[k] = nv;
    });
    if (Object.keys(grpOut).length) out[grp] = grpOut;
  });
  return out;
};

export const passesShowIf = (
  field: {
    showIf?: { fieldKey: string; operator: "equals" | "notEquals"; value: any };
  },
  lookup: (key: string) => any
): boolean => {
  if (!field.showIf) return true;
  const actual = lookup(field.showIf.fieldKey);
  return field.showIf.operator === "equals"
    ? actual === field.showIf.value
    : actual !== field.showIf.value;
};

export const isProfilePhotoField = (
  sectionKey?: string,
  fieldKey?: string
): boolean => {
  if ((sectionKey || "").toLowerCase() !== "personaldetails") return false;
  const k = (fieldKey || "").toLowerCase();
  return ["employeephoto", "profilephoto", "photo", "avatar"].includes(k);
};
