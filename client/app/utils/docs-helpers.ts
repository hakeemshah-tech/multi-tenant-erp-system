import { SectionConfig, FieldConfig } from "../types/employee-fields";
import {
  deepClone,
  diffDocsSubtree,
  isEmptyObject,
  isObject,
  prettyLabel,
} from "./common";

function readDocSubkeyFlags(field: FieldConfig | any) {
  const allowExpiry = field?.expiryDate === true;
  const allowIssuing = field?.issuingDate === true;
  const allowRefNum = field?.referenceNumber === true;

  const allowedKeys = new Set<string>(["url"]); // url is always allowed
  if (allowExpiry) allowedKeys.add("expiryDate");
  if (allowIssuing) allowedKeys.add("issuingDate");
  if (allowRefNum) allowedKeys.add("referenceNumber");
  return { allowedKeys };
}

/** Build doc values from employee, merging BOTH additional stores */
export function buildDocsValuesFromEmployee(emp: any) {
  const base = deepClone(emp?.employeeFields?.documents || {});

  const mergeAdds = (list: any[] = []) => {
    for (const a of list) {
      if (a?.sectionKey !== "documents") continue;
      const groupKey = a?.innerSectionKey ?? "__other_docs";
      base[groupKey] = base[groupKey] || {};

      const existing = base[groupKey][a.fieldKey];
      // Always update additional fields, as they might have newer data (like updated status after approval)
      if (a?.value !== undefined) {
        // Deep clone the value to avoid mutating the original
        const value = deepClone(a.value);

        // Convert ObjectId fileId to string if it exists
        if (value && typeof value === "object" && value.fileId) {
          value.fileId = String(value.fileId);
        }

        base[groupKey][a.fieldKey] = value; // string or {url,...}
      }
    }
  };

  // 🔁 include both additional stores
  mergeAdds(emp?.employeeFields?.additionalFields || []);
  mergeAdds(emp?.employeerOnlyAdditionalFields || []);

  return base;
}

export const seedInitialORSelections = (
  cfgSections: SectionConfig[],
  docsTree: any
) => {
  const docsCfg =
    cfgSections?.find((s) => s.sectionKey === "documents") || null;
  const initial: Record<string, string> = {};
  if (!docsCfg) return initial;
  (docsCfg.innerSections || []).forEach((inner) => {
    if (inner.requirementMode !== "OR") return;
    const group = docsTree?.[inner.sectionKey] || {};
    for (const f of inner.fields || []) {
      const v = group?.[f.key];
      const has =
        (typeof v === "string" && !!v) ||
        (isObject(v) && Object.keys(v).length > 0);
      if (has) {
        initial[`documents.${inner.sectionKey}`] = f.key;
        break;
      }
    }
  });
  return initial;
};

/** Add additional doc fields (normal + employer-only) into the docs config for display */
export function mergeAdditionalDocFieldsIntoConfig(
  docsConfigSection: SectionConfig | null,
  employee: any
): SectionConfig | null {
  if (!docsConfigSection) return null;

  const clone: SectionConfig = {
    ...docsConfigSection,
    innerSections: (docsConfigSection.innerSections || []).map((inner) => ({
      ...inner,
      fields: [...(inner.fields || [])],
    })),
  };

  const ensureInner = (key: string, label?: string) => {
    let target = clone.innerSections?.find((s) => s.sectionKey === key);
    if (!target) {
      target = {
        sectionKey: key,
        sectionLabel: label ?? prettyLabel(key),
        fields: [],
        requirementMode: "AND",
      };
      clone.innerSections = clone.innerSections || [];
      clone.innerSections.push(target);
    }
    return target;
  };

  const addFrom = (list: any[] = []) => {
    for (const a of list) {
      if (a?.sectionKey !== "documents") continue;
      const innerKey = a?.innerSectionKey ?? "__other_docs";
      const innerLabel = a?.innerSectionKey ? undefined : "Other Documents";
      const inner = ensureInner(innerKey, innerLabel);

      if (!inner.fields.some((f) => f.key === a.fieldKey)) {
        inner.fields.push({
          key: a.fieldKey,
          label: prettyLabel(a.fieldKey),
          type: "file",
          isAdditional: true, // mark as additional
        } as any);
      }
    }
  };

  // 🔁 include both lists
  addFrom(employee?.employeeFields?.additionalFields || []);
  addFrom(employee?.employeerOnlyAdditionalFields || []);

  return clone;
}

/** Build path meta for docs (unchanged) */
export function buildDocsPathMeta(docsDisplaySection: SectionConfig | null) {
  const map: Record<
    string,
    {
      isAdditional: boolean;
      innerSectionKey?: string | null;
      fieldKey: string;
      allowedKeys: Set<string>;
    }
  > = {};

  (docsDisplaySection?.innerSections || []).forEach((inner) => {
    (inner.fields || []).forEach((f: any) => {
      const path = `documents.${inner.sectionKey}.${f.key}`;
      const { allowedKeys } = readDocSubkeyFlags(f);
      map[path] = {
        isAdditional: !!f.isAdditional,
        innerSectionKey: inner.sectionKey,
        fieldKey: f.key,
        allowedKeys,
      };
    });
  });

  return map;
}

export function sanitizeDocValueByMeta(
  value: any,
  meta?: { allowedKeys?: Set<string> }
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const allowed = meta?.allowedKeys ?? new Set<string>(["url"]);
  const out: any = {};
  for (const k of Object.keys(value)) {
    if (allowed.has(k)) {
      // Convert ObjectId fileId to string if it exists
      if (k === "fileId" && value[k]) {
        out[k] = String(value[k]);
      } else {
        out[k] = value[k];
      }
    }
  }
  return out;
}

export function sanitizeDocTreeByConfig(
  docsTree: any,
  docsPathMeta: Record<
    string,
    {
      isAdditional: boolean;
      innerSectionKey?: string | null;
      fieldKey: string;
      allowedKeys: Set<string>;
    }
  >
) {
  const out: any = {};
  for (const [innerKey, fieldsAny] of Object.entries(docsTree || {})) {
    const fields = fieldsAny as Record<string, any>;
    for (const [fieldKey, value] of Object.entries(fields || {})) {
      const path = `documents.${innerKey}.${fieldKey}`;
      const meta = docsPathMeta[path];
      const sanitized = sanitizeDocValueByMeta(value, meta);
      if (sanitized && Object.keys(sanitized).length) {
        if (!out[innerKey]) out[innerKey] = {};
        out[innerKey][fieldKey] = sanitized;
      }
    }
  }
  return out;
}

export const diffChangedDocs = (prevDocs: any, nextDocs: any) => {
  const changed = diffDocsSubtree(prevDocs, nextDocs);
  return { changed, isEmpty: isEmptyObject(changed) };
};
