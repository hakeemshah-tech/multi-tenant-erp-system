import { z } from "zod";

export const createRoleLevelSchema = z.object({
  level: z.number().int().min(1, "Level must be at least 1"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export const updateRoleLevelSchema = z.object({
  level: z.number().int().min(1, "Level must be at least 1").optional(),
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().optional(),
});
