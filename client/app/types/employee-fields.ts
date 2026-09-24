export type FieldType =
  | "text"
  | "select"
  | "date"
  | "file"
  | "number"
  | "email"
  | "checkbox"
  | "textarea"
  | "reference";

export interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  showIf?: { fieldKey: string; operator: "equals" | "notEquals"; value: any };
  referenceModel?: string;
  isAdditional?: boolean;
  placeholder?: string;
  hint?: string;
  defaultValue?: any;
  isMulti?: boolean; // For multi-select fields
  isCountrySelect?: boolean; // For country select fields
}

export interface InnerSectionConfig {
  sectionKey: string;
  sectionLabel: string;
  fields: FieldConfig[];
  requirementMode?: "AND" | "OR";
}

export interface SectionConfig {
  sectionKey: string;
  sectionLabel: string;
  fields: FieldConfig[];
  innerSections?: InnerSectionConfig[];
  isAdditional?: boolean;
  employeerOnlyEditable?: boolean;
}
