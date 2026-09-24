import { z } from "zod";

const sectionPermissionSchema = z.object({
  read: z.boolean(),
  write: z.boolean(),
  delete: z.boolean(),
  dataAccessLevel: z.number().int().min(1).max(7).optional(),
});

export const createOrUpdateRolePermissionSchema = z.object({
  roleId: z.string().min(1, "Role ID is required"),
  sectionKey: z.string().min(1, "Section key is required"),
  permissions: sectionPermissionSchema,
});

export const bulkUpdateRolePermissionsSchema = z.object({
  roleId: z.string().min(1, "Role ID is required"),
  permissions: z.record(z.string(), sectionPermissionSchema),
});
