// src/audit/logger.ts
import { randomUUID } from "crypto";
import { ch, AUDIT_DB_TABLE } from "./client";
import {
  AuditChange,
  UpdateAuditParams,
  SimpleAuditParams,
  AuditOp,
} from "./types";

function s(x: unknown): string | undefined {
  if (x === undefined || x === null) return undefined;
  return String(x);
}

function actorString(p: SimpleAuditParams | UpdateAuditParams): string {
  const email = p.audit?.actorEmail;
  if (email) return email;
  const id = p.audit?.actorUserId;
  if (id) return String(id);
  return "";
}

function actorNameString(p: SimpleAuditParams | UpdateAuditParams): string {
  // Try to get actor name from audit context first
  if (p.audit?.actorName) {
    return p.audit.actorName;
  }

  // Fallback to email if no name is provided
  return p.audit?.actorEmail || "";
}

async function _insertRow(row: Record<string, any>) {
  console.log(row, "sjoww");
  try {
    await ch.insert({
      table: AUDIT_DB_TABLE,
      values: [row],
      format: "JSONEachRow",
    });
  } catch (err) {
    // Never block the main flow
    console.error("[audit] insert failed:", err);
  }
}

/** Log an UPDATE with one or more field changes. */
export async function logUpdate(p: UpdateAuditParams) {
  console.log(p, "show-data");
  if (!p.changes?.length) return;

  const ts = new Date().toISOString();
  const actor = actorString(p);

  const subjectName = p.subjectUserName ? ` of "${p.subjectUserName}"` : "";
  const summary =
    p.changes.length === 1
      ? `updated "${p.changes[0].path}" in "${
          p.sectionKey ?? ""
        }"${subjectName}${p.isAdditional ? " (additional)" : ""}`.trim()
      : `updated ${p.changes.length} fields${
          p.sectionKey ? ` in "${p.sectionKey}"` : ""
        }${subjectName}${p.isAdditional ? " (additional)" : ""}`;

  const row = {
    event_id: randomUUID(),
    ts, // DateTime string; ClickHouse column is DateTime64(3,'UTC')

    tenant_id: s(p.tenantId),
    branch_id: s(p.branchId),
    user_id: s(p.subjectUserId),
    actor,
    actor_name: actorNameString(p),
    subject_user_id: s(p.subjectUserId),
    subject_user_name: p.subjectUserName,
    aggregate_type: p.aggregateType,
    aggregate_id: s(p.aggregateId),

    op: "update" as AuditOp,
    path: p.changes.length > 1 ? "*" : p.changes[0].path,
    source: p.source ?? "manual",

    diff_json: JSON.stringify(p.changes),
    meta_json: JSON.stringify({
      summary,
      sectionKey: p.sectionKey,
      isAdditional: !!p.isAdditional,
      count: p.changes.length,
      route: p.audit?.route,
      method: p.audit?.method,
      ip: p.audit?.ip,
      ua: p.audit?.ua,
      page: p.audit?.page,
    }),
  };

  await _insertRow(row);
}

/** Log a CREATE/INSERT event with a concise summary (no field diffs). */
export async function logInsertSummary(p: SimpleAuditParams) {
  const ts = new Date().toISOString();
  const row = {
    event_id: randomUUID(),
    ts,

    tenant_id: s(p.tenantId),
    branch_id: s(p.branchId),
    user_id: s(p.subjectUserId),
    actor: actorString(p),
    actor_name: actorNameString(p),
    subject_user_id: s(p.subjectUserId),
    subject_user_name: p.subjectUserName,

    aggregate_type: p.aggregateType,
    aggregate_id: s(p.aggregateId),

    op: "insert" as AuditOp,
    path: p.path ?? "*",
    source: p.source ?? "manual",

    diff_json: null,
    meta_json: JSON.stringify({
      summary: p.summary,
      ...(p.meta || {}),
      route: p.audit?.route,
      method: p.audit?.method,
      ip: p.audit?.ip,
      ua: p.audit?.ua,
      page: p.audit?.page,
    }),
  };

  await _insertRow(row);
}

/** Log a DELETE event with a concise summary (no field diffs). */
export async function logDelete(p: SimpleAuditParams) {
  const ts = new Date().toISOString();
  const row = {
    event_id: randomUUID(),
    ts,

    tenant_id: s(p.tenantId),
    branch_id: s(p.branchId),
    user_id: s(p.subjectUserId),
    actor: actorString(p),
    actor_name: actorNameString(p),
    subject_user_id: s(p.subjectUserId),
    subject_user_name: p.subjectUserName,

    aggregate_type: p.aggregateType,
    aggregate_id: s(p.aggregateId),

    op: "delete" as AuditOp,
    path: p.path ?? "*",
    source: p.source ?? "manual",

    diff_json: null,
    meta_json: JSON.stringify({
      summary: p.summary,
      ...(p.meta || {}),
      route: p.audit?.route,
      method: p.audit?.method,
      ip: p.audit?.ip,
      ua: p.audit?.ua,
      page: p.audit?.page,
    }),
  };

  await _insertRow(row);
}

/** Log an arbitrary/custom event. */
export async function logCustom(
  p: SimpleAuditParams & { op?: AuditOp; diff?: any }
) {
  const ts = new Date().toISOString();
  const row = {
    event_id: randomUUID(),
    ts,

    tenant_id: s(p.tenantId),
    branch_id: s(p.branchId),
    user_id: s(p.subjectUserId),
    actor: actorString(p),
    actor_name: actorNameString(p),
    subject_user_id: s(p.subjectUserId),
    subject_user_name: p.subjectUserName,

    aggregate_type: p.aggregateType,
    aggregate_id: s(p.aggregateId),

    op: (p.op ?? "custom") as AuditOp,
    path: p.path ?? "*",
    source: p.source ?? "manual",

    diff_json:
      p.diff !== undefined && p.diff !== null ? JSON.stringify(p.diff) : null,
    meta_json: JSON.stringify({
      summary: p.summary,
      ...(p.meta || {}),
      route: p.audit?.route,
      method: p.audit?.method,
      ip: p.audit?.ip,
      ua: p.audit?.ua,
      page: p.audit?.page,
    }),
  };

  await _insertRow(row);
}

/** Log a VIEW event when a user views a section/tab (no field diffs). */
export async function logView(
  p: SimpleAuditParams & {
    sectionKey: string; // e.g., "personaldetails"
    innerSectionKey?: string | null; // optional (e.g., docs inner group)
  }
) {
  const ts = new Date().toISOString();
  const row = {
    event_id: randomUUID(),
    ts,

    tenant_id: s(p.tenantId),
    branch_id: s(p.branchId),
    user_id: s(p.subjectUserId),
    actor: actorString(p),
    actor_name: actorNameString(p),
    subject_user_id: s(p.subjectUserId),
    subject_user_name: p.subjectUserName,

    aggregate_type: p.aggregateType, // e.g., "Employee"
    aggregate_id: s(p.aggregateId),

    op: "view" as AuditOp,
    // put the section in "path" for easy filtering in CH
    path: p.path ?? p.sectionKey ?? "*",
    source: p.source ?? "manual",

    diff_json: null,
    meta_json: JSON.stringify({
      summary:
        p.summary ??
        `viewed "${p.sectionKey}"${
          p.innerSectionKey ? ` → "${p.innerSectionKey}"` : ""
        }${p.subjectUserName ? ` of "${p.subjectUserName}"` : ""}`,
      sectionKey: p.sectionKey,
      innerSectionKey: p.innerSectionKey ?? null,
      ...(p.meta || {}),
      route: p.audit?.route,
      method: p.audit?.method,
      ip: p.audit?.ip,
      ua: p.audit?.ua,
      page: p.audit?.page,
    }),
  };

  await _insertRow(row);
}
