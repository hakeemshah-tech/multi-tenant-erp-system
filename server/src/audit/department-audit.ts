// src/server/audit/department-audit.ts
import type { Request } from "express";
import { logAudit } from "./auth-audit";

type AuditCtx = {
  req?: Request | null;
  tenantId: string;
  branchId: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
};

type DeptShape = {
  _id: string;
  name?: string;
  description?: string;
  // ...any other department fields you allow
};

type PartialDeptUpdate = Record<string, any>;

/** Build a diff array with only changed keys */
function buildChangedDiff(
  before: Record<string, any> | null | undefined,
  after: Record<string, any> | null | undefined,
  onlyKeys?: string[]
) {
  const out: Array<{ path: string; old: any; new: any }> = [];
  const keys =
    onlyKeys && onlyKeys.length
      ? onlyKeys
      : Array.from(
          new Set([
            ...(before ? Object.keys(before) : []),
            ...(after ? Object.keys(after) : []),
          ])
        );

  for (const k of keys) {
    const oldVal = before ? before[k] : undefined;
    const newVal = after ? after[k] : undefined;
    // Only record if actually different (strict-ish)
    const changed =
      oldVal !== newVal && JSON.stringify(oldVal) !== JSON.stringify(newVal);

    if (changed) {
      out.push({ path: k, old: oldVal ?? null, new: newVal ?? null });
    }
  }
  return out;
}

/** Log department creation */
export async function logDepartmentCreate(args: {
  ctx: AuditCtx;
  department: DeptShape;
  payload: Record<string, any>; // what you passed to create (used to list only set fields)
}) {
  const { ctx, department, payload } = args;
  const diff = buildChangedDiff(null, payload);

  await logAudit({
    req: ctx.req ?? null,
    op: "insert",
    path: "department.create",
    aggregateType: "Department",
    aggregateId: String(department._id),
    tenantId: ctx.tenantId,
    branchId: ctx.branchId,
    userId: ctx.actorUserId ?? null,
    actor: ctx.actorEmail ?? null,
    actorName: ctx.actorName ?? null,
    diff,
    meta: {
      summary: `Department "${department.name ?? ""}" created`,
      page: ctx.req?.headers["x-page"] as string | undefined,
    },
  });
}

/** Log department update (only changed fields in the incoming update) */
export async function logDepartmentUpdate(args: {
  ctx: AuditCtx;
  departmentId: string;
  before: Record<string, any>;
  after: Record<string, any>;
  updatePayload: PartialDeptUpdate; // the partial `data` you attempted to set
}) {
  const { ctx, departmentId, before, after, updatePayload } = args;

  // Only compare keys present in the updatePayload (what caller intended to change)
  const changedKeys = Object.keys(updatePayload || {});
  const diff = buildChangedDiff(before, after, changedKeys);

  // If nothing changed (e.g., same values), still log with empty diff or skip, your call.
  await logAudit({
    req: ctx.req ?? null,
    op: "update",
    path: "department.update",
    aggregateType: "Department",
    aggregateId: String(departmentId),
    tenantId: ctx.tenantId,
    branchId: ctx.branchId,
    userId: ctx.actorUserId ?? null,
    actor: ctx.actorEmail ?? null,
    actorName: ctx.actorName ?? null,
    diff,
    meta: {
      summary: `Department "${after?.name ?? before?.name ?? ""}" updated`,
      page: ctx.req?.headers["x-page"] as string | undefined,
    },
  });
}

/** Log department deletion */
export async function logDepartmentDelete(args: {
  ctx: AuditCtx;
  department: DeptShape;
}) {
  const { ctx, department } = args;

  await logAudit({
    req: ctx.req ?? null,
    op: "delete",
    path: "department.delete",
    aggregateType: "Department",
    aggregateId: String(department._id),
    tenantId: ctx.tenantId,
    branchId: ctx.branchId,
    userId: ctx.actorUserId ?? null,
    actor: ctx.actorEmail ?? null,
    actorName: ctx.actorName ?? null,
    diff: [],
    meta: {
      summary: `Department "${department.name ?? ""}" deleted`,
      page: ctx.req?.headers["x-page"] as string | undefined,
    },
  });
}
