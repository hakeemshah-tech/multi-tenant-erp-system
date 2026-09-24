import isEqual from "lodash/isEqual";

/** Convert a Date | string | number to UTC YYYY-MM-DD; returns null if invalid/empty */
function toUTCYMD(value: any): string | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** For audit compare: if meta.type === 'date', compare on YYYY-MM-DD; else deep-equal */
function isEqualForAudit(
  meta: any | undefined,
  oldVal: any,
  newVal: any
): boolean {
  if (meta?.type === "date") {
    return toUTCYMD(oldVal) === toUTCYMD(newVal);
  }
  return isEqual(oldVal, newVal);
}

/** For audit payload: normalize values for readability & stability */
function normalizeForAuditValue(meta: any | undefined, val: any) {
  if (meta?.type === "date") return toUTCYMD(val);
  return val;
}

/** Normalize an object (section or inner object) into audit-comparable values, using meta maps */
function normalizeObjectForAudit(obj: any, metaMap: Record<string, any>): any {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  // Safety check: ensure metaMap is an object
  if (!metaMap || typeof metaMap !== "object") return obj;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const meta = metaMap[k];
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      meta &&
      typeof meta === "object" &&
      !meta.type
    ) {
      // inner group
      out[k] = normalizeObjectForAudit(v, meta);
    } else {
      out[k] = normalizeForAuditValue(meta, v);
    }
  }
  return out;
}

/** When the section is an array of objects (e.g., address[]), normalize per-row using meta. */
function normalizeArrayOfObjectsForAudit(
  arr: any[],
  rowMeta: Record<string, any>
): any[] {
  return (arr || []).map((row) => normalizeObjectForAudit(row, rowMeta));
}

/* ------------------------------ Path helper ------------------------------ */

function buildAdditionalPath(
  sectionKey: string,
  innerSectionKey: string | undefined,
  fieldKey: string
) {
  return innerSectionKey
    ? `additionalFields.${sectionKey}.${innerSectionKey}.${fieldKey}`
    : `additionalFields.${sectionKey}.${fieldKey}`;
}

export {
  buildAdditionalPath,
  normalizeArrayOfObjectsForAudit,
  normalizeObjectForAudit,
  normalizeForAuditValue,
  isEqualForAudit,
  toUTCYMD,
};
