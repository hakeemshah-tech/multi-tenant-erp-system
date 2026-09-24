import { z } from "zod";

export const createAwardSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().max(1000, "Description is too long").optional(),
  icon: z.string().max(100, "Icon name is too long").optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateAwardSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title is too long")
    .optional(),
  description: z.string().max(1000, "Description is too long").optional(),
  icon: z.string().max(100, "Icon name is too long").optional(),
  isActive: z.boolean().optional(),
});
