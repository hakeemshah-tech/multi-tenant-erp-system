import { z } from "zod";

export const createIndustrySubTypeSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  description: z.string().max(1000, "Description is too long").optional(),
  code: z.string().max(50, "Code is too long").optional(),
  industryTypeId: z.string().min(1, "Industry Type is required"),
  isActive: z.boolean().optional().default(true),
});

export const updateIndustrySubTypeSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name is too long")
    .optional(),
  description: z.string().max(1000, "Description is too long").optional(),
  code: z.string().max(50, "Code is too long").optional(),
  industryTypeId: z.string().min(1, "Industry Type is required").optional(),
  isActive: z.boolean().optional(),
});
