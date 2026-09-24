import { z } from "zod";

export const createAwardEmployeeTypeSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().max(1000, "Description is too long").optional(),
  awardId: z.string().min(1, "Award is required"),
});

export const updateAwardEmployeeTypeSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title is too long")
    .optional(),
  description: z.string().max(1000, "Description is too long").optional(),
  awardId: z.string().min(1, "Award is required").optional(),
});
