// src/server/audit/designation-audit.ts
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

type DesignationShape = {
  _id: string;
  name?: string;
  description?: string;
  // add any other designation fields you support
};

type PartialUpdate = Record<string, any>;

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

    const changed =
      oldVal !== newVal && JSON.stringify(oldVal) !== JSON.stringify(newVal);

    if (changed) {
      out.push({ path: k, old: oldVal ?? null, new: newVal ?? null });
    }
  }
  return out;
}

/** Log designation creation */
export async function logDesignationCreate(args: {
  ctx: AuditCtx;
  designation: DesignationShape;
  payload: Record<string, any>; // the data you passed to create
}) {
  const { ctx, designation, payload } = args;
  //   const diff = buildChangedDiff(null, payload);

  await logAudit({
    req: ctx.req ?? null,
    op: "insert",
    path: "designation.create",
    aggregateType: "Designation",
    aggregateId: String(designation._id),
    tenantId: ctx.tenantId,
    branchId: ctx.branchId,
    userId: ctx.actorUserId ?? null,
    actor: ctx.actorEmail ?? null,
    actorName: ctx.actorName ?? null,
    diff: [],
    meta: {
      summary: `${ctx.actorEmail ?? "Someone"} created designation "${
        designation.name ?? ""
      }"`,
    },
  });
}

/** Log designation update (only keys present in update payload) */
export async function logDesignationUpdate(args: {
  ctx: AuditCtx;
  designationId: string;
  before: Record<string, any>;
  after: Record<string, any>;
  updatePayload: PartialUpdate; // the partial update body
}) {
  const { ctx, designationId, before, after, updatePayload } = args;

  const changedKeys = Object.keys(updatePayload || {});
  //   const diff = buildChangedDiff(before, after, changedKeys);

  await logAudit({
    req: ctx.req ?? null,
    op: "update",
    path: "designation.update",
    aggregateType: "Designation",
    aggregateId: String(designationId),
    tenantId: ctx.tenantId,
    branchId: ctx.branchId,
    userId: ctx.actorUserId ?? null,
    actor: ctx.actorEmail ?? null,
    actorName: ctx.actorName ?? null,
    diff: [],
    meta: {
      summary: `${ctx.actorEmail ?? "Someone"} updated designation "${
        after?.name ?? before?.name ?? ""
      }"`,
    },
  });
}
