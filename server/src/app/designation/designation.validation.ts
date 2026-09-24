import { z } from "zod";

export const createDesignationSchema = z.object({
  name: z.string().min(2, "Designation name is required"),
  description: z.string().optional(),
  departmentIds: z
    .array(z.string().min(1, "Department ID is required"))
    .min(1, "At least one department must be selected"),
  roleIds: z.array(z.string().min(1, "Role ID is required")).optional(),
  selectedDocumentFields: z.array(z.string()).optional(),
});

export const updateDesignationSchema = z.object({
  name: z.string().min(2, "Designation name is required").optional(),
  description: z.string().optional(),
  departmentIds: z
    .array(z.string().min(1, "Department ID is required"))
    .min(1, "At least one department must be selected")
    .optional(),
  roleIds: z.array(z.string().min(1, "Role ID is required")).optional(),
  selectedDocumentFields: z.array(z.string()).optional(),
});
