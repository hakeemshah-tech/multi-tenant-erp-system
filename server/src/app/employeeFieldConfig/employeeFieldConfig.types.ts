// src/modules/employeeFieldConfig/employeeFieldConfig.types.ts

export type FieldType =
  | "text"
  | "select"
  | "date"
  | "file"
  | "number"
  | "email"
  | "checkbox"
  | "textarea";

export interface EmployeeField {
  key: string;
  label: string;
  placeholder: string;
  hint?: string;
  required: boolean;
  type: FieldType;
  jobRole?: string[]; // Array of designation IDs
}

export interface InnerSection {
  sectionKey: string;
  sectionLabel: string;
  fields: EmployeeField[];
}

export interface Section {
  sectionKey: string;
  sectionLabel: string;
  fields: EmployeeField[];
  innerSections?: InnerSection[];
}

export interface EmployeeConfig {
  tenantId: string;
  branchId: string;
  designationId?: string;
  sections: Section[];
}

// Used when creating or updating config from controller
export interface CreateOrUpdateEmployeeFieldConfigInput {
  designationId?: string;
  sections: Section[];
}
