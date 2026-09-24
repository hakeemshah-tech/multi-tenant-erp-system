import { Types } from "mongoose";

export interface CreateEmployeeServiceInput {
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  data: {
    designationId: Types.ObjectId;
    employeeProfileId: Types.ObjectId;
    reportingto: Types.ObjectId;
    additionalDesignationIds?: Types.ObjectId[];
    additionalFields?: Record<
      string,
      {
        sectionKey: string;
        innerSectionKey?: string | null;
        fieldKey: string;
        value: any;
      }
    >;
  };
}

export interface EmployeeInput {
  designation?: Types.ObjectId;
  employeeProfile?: Types.ObjectId;
  additionalRoleIds?: string[]; // Additional roles assigned directly to employee
  additionalDesignationIds?: Types.ObjectId[]; // Additional job titles assigned directly to employee
  additionalFields?: Record<
    string,
    {
      sectionKey: string;
      innerSectionKey?: string | null;
      fieldKey: string;
      value: any;
    }
  >;
}

export interface AdditionalFieldInput {
  sectionKey: string;
  innerSectionKey?: string | null;
  fieldKey: string;
  value: string | number | boolean | Date | null;
}

export interface CreateEmployeeInput {
  designationId: string; // Input as string
  employeeProfileId: string; // Input as string
  additionalRoleIds?: string[]; // Additional roles assigned directly to employee
  additionalDesignationIds?: string[]; // Additional job titles assigned directly to employee (as strings)
  additionalFields?: Record<string, AdditionalFieldInput>;
}
