import { z } from "zod";

export const createContractTypeSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
});

export const updateContractTypeSchema = z.object({
  title: z.string().min(2, "Title is required").optional(),
  description: z.string().optional(),
});

export type CreateContractTypeInput = z.infer<typeof createContractTypeSchema>;
export type UpdateContractTypeInput = z.infer<typeof updateContractTypeSchema>;
