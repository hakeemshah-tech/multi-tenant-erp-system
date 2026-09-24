import { SectionConfig, FieldConfig } from "../types/employee-fields";
import { passesShowIf, shouldSendValue, isProfilePhotoField } from "./common";

export function buildCoreSectionData(
  section: SectionConfig,
  draft: any,
  makeDraftLookup: (section: SectionConfig) => (key: string) => any
) {
  const lookup = makeDraftLookup(section);
  const data: Record<string, any> = {};

  for (const f of section.fields || []) {
    if (isProfilePhotoField(section.sectionKey, f.key)) continue;
    if (!passesShowIf(f, lookup)) continue;
    const v = draft?.[f.key];
    if (shouldSendValue(v)) data[f.key] = v;
    else if (f.type === "file") data[f.key] = {};
  }

  for (const inn of section.innerSections || []) {
    const out: Record<string, any> = {};
    for (const f of inn.fields || []) {
      if (isProfilePhotoField(section.sectionKey, f.key)) continue;
      if (!passesShowIf(f, lookup)) continue;
      const v = draft.__inners?.[inn.sectionKey]?.[f.key];
      if (shouldSendValue(v)) out[f.key] = v;
      else if (f.type === "file") out[f.key] = {};
    }
    if (Object.keys(out).length) data[inn.sectionKey] = out;
  }

  return data;
}
