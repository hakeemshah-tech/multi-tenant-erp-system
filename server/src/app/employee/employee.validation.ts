// src/modules/employee/employee.validation.ts

import { z } from "zod";

/**
 * Schema for dynamic employee data.
 * Accepts a key-value object where each value can be of any valid field input type.
 * You can further customize this schema if you want to validate field types more strictly.
 */
const employeeDataSchema = z.record(z.any());

/**
 * Schema for creating a new employee
 */
export const createEmployeeSchema = z.object({
  designationId: z.string().optional(),
  sections: employeeDataSchema,
});

/**
 * Schema for updating an existing employee
 */
export const updateEmployeeSchema = z.object({
  designationId: z.string().optional(),
  additionalRoleIds: z
    .array(z.string().min(1, "Role ID is required"))
    .optional(),
  additionalDesignationIds: z
    .array(z.string().min(1, "Designation ID is required"))
    .optional(),
  sections: employeeDataSchema.optional(),
});
