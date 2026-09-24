import { SectionConfig, FieldConfig } from "../types/employee-fields";
import { isNonEmpty, shouldSendValue, passesShowIf } from "./common";

export function getProfileOrAdditionalValue(
  employee: any,
  sectionKey: string,
  fieldKey: string,
  innerKey?: string
) {
  const root = employee?.employeeFields || {};

  // 1) structured value (core)
  const v1 = innerKey
    ? root?.[sectionKey]?.[innerKey]?.[fieldKey]
    : root?.[sectionKey]?.[fieldKey];
  if (isNonEmpty(v1)) return v1;

  // 2) Fallback to employeeProfile if employeeFields is empty
  const profileRoot = employee?.employeeProfile || {};
  const v2 = innerKey
    ? profileRoot?.[sectionKey]?.[innerKey]?.[fieldKey]
    : profileRoot?.[sectionKey]?.[fieldKey];
  if (isNonEmpty(v2)) return v2;

  // helper to search list-shaped stores
  const findIn = (list: any[] = []) =>
    list.find(
      (f: any) =>
        f?.sectionKey === sectionKey &&
        f?.fieldKey === fieldKey &&
        (innerKey ? f?.innerSectionKey === innerKey : !f?.innerSectionKey)
    );

  // 3) normal additional fields
  const fromAdd = findIn(root?.additionalFields);
  if (isNonEmpty(fromAdd?.value)) return fromAdd.value;

  // 4) employer-only additional fields (lives at employee root)
  const fromEO = findIn(employee?.employeerOnlyAdditionalFields);
  return fromEO?.value;
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

export function buildAdditionalItems(section: SectionConfig, draftState: any) {
  const lookup = (key: string) => {
    if (key in draftState) return draftState[key];
    const groups = draftState.__inners || {};
    for (const g of Object.keys(groups)) {
      if (key in (groups[g] || {})) return groups[g][key];
    }
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
    const value =
      f.type === "file" && raw && typeof raw === "object" && "url" in raw
        ? raw.url
        : raw;
    items.push({ sectionKey: section.sectionKey, fieldKey: f.key, value });
  });

  (section.innerSections || []).forEach((inn) => {
    (inn.fields || []).forEach((f) => {
      if (!passesShowIf(f, lookup)) return;
      const raw = draftState.__inners?.[inn.sectionKey]?.[f.key];
      if (!shouldSendValue(raw)) return;
      const value =
        f.type === "file" && raw && typeof raw === "object" && "url" in raw
          ? raw.url
          : raw;
      items.push({
        sectionKey: section.sectionKey,
        innerSectionKey: inn.sectionKey,
        fieldKey: f.key,
        value,
      });
    });
  });

  return items;
}
