import { z } from "zod";

export const createTemplateTypeSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  contractTypeId: z.string().min(1, "contractTypeId is required"),
});

export const updateTemplateTypeSchema = z.object({
  title: z.string().min(2, "Title is required").optional(),
  description: z.string().optional(),
});

export type CreateTemplateTypeInput = z.infer<typeof createTemplateTypeSchema>;
export type UpdateTemplateTypeInput = z.infer<typeof updateTemplateTypeSchema>;
