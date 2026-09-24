import { z } from "zod";

export const createRoleSchema = z.object({
  roleId: z
    .string()
    .min(2, "Role ID is required")
    .regex(
      /^[a-z0-9_]+$/,
      "Role ID can only contain lowercase letters, numbers, and underscores"
    ),
  name: z.string().min(2, "Role name is required"),
  description: z.string().optional(),
  color: z.enum(
    ["purple", "blue", "green", "amber", "red", "pink", "teal", "gray"],
    {
      errorMap: () => ({
        message:
          "Invalid color. Must be one of: purple, blue, green, amber, red, pink, teal, gray",
      }),
    }
  ),
  level: z
    .number()
    .int()
    .min(1, "Level must be between 1 and 7")
    .max(7, "Level must be between 1 and 7")
    .optional(),
});

export const updateRoleSchema = z.object({
  name: z.string().min(2, "Role name is required").optional(),
  description: z.string().optional(),
  color: z
    .enum(["purple", "blue", "green", "amber", "red", "pink", "teal", "gray"])
    .optional(),
  level: z
    .number()
    .int()
    .min(1, "Level must be between 1 and 7")
    .max(7, "Level must be between 1 and 7")
    .optional(),
});
