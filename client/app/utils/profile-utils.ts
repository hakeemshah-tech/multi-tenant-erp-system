// Small, pure helpers used across components

import get from "lodash/get";

export const formatDDMMYYYY = (d?: string | Date | null) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (!date || isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

export const keyOf = (
  sectionKey: string,
  innerSectionKey: string | null | undefined,
  fieldKey: string
) => `${sectionKey}||${innerSectionKey ?? ""}||${fieldKey}`;

export const hasMeaningfulValue = (val: any, fieldType?: string) => {
  if (val === undefined || val === null) return false;
  if (typeof val === "string") return val.trim().length > 0;
  if (typeof val === "number") return true;
  if (typeof val === "boolean") return val === true;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "object") {
    if (fieldType === "file" && val?.url) return true;
    return Object.keys(val).length > 0;
  }
  return !!val;
};

export const previewValue = (val: any, fieldType?: string) => {
  if (fieldType === "file") return val?.url ? "File uploaded" : "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") return String(val);
  if (typeof val === "string") {
    const maybeDate = new Date(val);
    if (!isNaN(maybeDate.getTime()) && /\d{4}-\d{2}-\d{2}/.test(val)) {
      return formatDDMMYYYY(val);
    }
    return val.length > 36 ? val.slice(0, 33) + "…" : val;
  }
  if (typeof val === "object") {
    if (val?._id && Object.keys(val).length === 1) return `Ref: ${val._id}`;
    return "—";
  }
  return "—";
};

// DFS: find first value by key anywhere in the profile object
export const findValueByFieldKeyAnywhere = (
  obj: any,
  targetKey: string
): any => {
  if (!obj || typeof obj !== "object") return undefined;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const v = findValueByFieldKeyAnywhere(item, targetKey);
      if (v !== undefined) return v;
    }
    return undefined;
  }

  for (const [k, v] of Object.entries(obj)) {
    if (k === targetKey && v !== undefined && v !== null) {
      if (
        typeof v === "object" &&
        !Array.isArray(v) &&
        Object.keys(v).length === 0
      ) {
        // keep searching
      } else {
        return v;
      }
    }
    const nested = findValueByFieldKeyAnywhere(v as any, targetKey);
    if (nested !== undefined) return nested;
  }
  return undefined;
};

export const deepClean = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(deepClean).filter((v) => v !== undefined && v !== null);
  }
  if (obj && typeof obj === "object") {
    const out: any = {};
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (
        v === "" ||
        (v &&
          typeof v === "object" &&
          !Array.isArray(v) &&
          Object.keys(v).length === 0)
      )
        continue;
      out[k] = typeof v === "object" ? deepClean(v) : v;
    }
    return out;
  }
  return obj;
};

// Build payload: separate profile vs additionalFields
export const splitProfileAndAdditionalFields = (
  values: any,
  sections: any[]
) => {
  const profileUpdates: any = {};
  const additionalFields: any[] = [];

  for (const section of sections) {
    if (section.employeerOnlyEditable) continue;
    const sectionGroup = values[section.sectionKey];
    if (!sectionGroup) continue;

    if (section.sectionKey === "address") {
      profileUpdates["address"] = values["address"];
      continue;
    }

    for (const field of section.fields || []) {
      const val = sectionGroup[field.key];
      if (field.isAdditional) {
        if (val !== undefined) {
          additionalFields.push({
            sectionKey: section.sectionKey,
            innerSectionKey: null,
            fieldKey: field.key,
            value: val,
          });
        }
      } else {
        if (!profileUpdates[section.sectionKey])
          profileUpdates[section.sectionKey] = {};
        profileUpdates[section.sectionKey][field.key] = val;
      }
    }

    for (const inner of section.innerSections || []) {
      const innerGroup = sectionGroup?.[inner.sectionKey];
      if (!innerGroup) continue;

      for (const field of inner.fields || []) {
        const val = innerGroup[field.key];
        if (field.isAdditional) {
          if (val !== undefined) {
            additionalFields.push({
              sectionKey: section.sectionKey,
              innerSectionKey: inner.sectionKey,
              fieldKey: field.key,
              value: val,
            });
          }
        } else {
          if (!profileUpdates[section.sectionKey])
            profileUpdates[section.sectionKey] = {};
          if (!profileUpdates[section.sectionKey][inner.sectionKey]) {
            profileUpdates[section.sectionKey][inner.sectionKey] = {};
          }
          profileUpdates[section.sectionKey][inner.sectionKey][field.key] = val;
        }
      }
    }
  }

  return { profileUpdates, additionalFields };
};

// Build post-accept candidates (with exact-hide, key-fallback read)
export const buildAdditionalCandidates = (
  cleanedValues: any,
  cfgSections: any[],
  prof: any,
  getVal: typeof get,
  keyOfFn = keyOf,
  hasValue = hasMeaningfulValue
) => {
  const addMapByExact: Record<string, any> = {};
  const addMapByKey: Record<string, any> = {};
  (prof?.additionalFields || []).forEach((af: any) => {
    addMapByExact[
      `${af.sectionKey}||${af.innerSectionKey ?? ""}||${af.fieldKey}`
    ] = af;
    if (!addMapByKey[af.fieldKey]) addMapByKey[af.fieldKey] = af;
  });

  const cands: any[] = [];

  for (const section of cfgSections) {
    const sectionLabel = section.sectionLabel || section.sectionKey;

    for (const field of section.fields || []) {
      if (!field.isAdditional) continue;
      const path = `${section.sectionKey}.${field.key}`;
      const val = getVal(cleanedValues, path);
      const id = keyOfFn(section.sectionKey, null, field.key);
      const exact = addMapByExact[id];
      const existing = exact || addMapByKey[field.key];
      if (exact?.isShowInProfile === true) continue;
      if (!existing) continue;
      if (!hasValue(val, field.type)) continue;
      cands.push({
        id,
        sectionKey: section.sectionKey,
        innerSectionKey: null,
        fieldKey: field.key,
        label: field.label,
        sectionLabel,
        path,
        value: val,
      });
    }

    for (const inner of section.innerSections || []) {
      const innerLabel = inner.sectionLabel || inner.sectionKey;
      for (const field of inner.fields || []) {
        if (!field.isAdditional) continue;
        const path = `${section.sectionKey}.${inner.sectionKey}.${field.key}`;
        const val = getVal(cleanedValues, path);
        const id = keyOfFn(section.sectionKey, inner.sectionKey, field.key);
        const exact = addMapByExact[id];
        const existing = exact || addMapByKey[field.key];
        if (exact?.isShowInProfile === true) continue;
        if (!existing) continue;
        if (!hasValue(val, field.type)) continue;
        cands.push({
          id,
          sectionKey: section.sectionKey,
          innerSectionKey: inner.sectionKey,
          fieldKey: field.key,
          label: field.label,
          sectionLabel,
          innerSectionLabel: innerLabel,
          path,
          value: val,
        });
      }
    }
  }

  return cands;
};
