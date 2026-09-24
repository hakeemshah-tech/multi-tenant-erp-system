import { randomUUID } from "crypto";
import { ch, AUDIT_DB_TABLE, isAuditConfigured } from "./clickhouse";
import { computeFieldChanges, FieldChange } from "./diff";

export type AuditEvent = {
  event_id: string;
  ts: string; // ISO UTC
  tenant_id?: string | null;
  branch_id?: string | null;
  user_id?: string | null; // subject user
  actor?: string | null; // performer
  aggregate_type: string;
  aggregate_id: string;
  op: "insert" | "update" | "replace" | "delete" | "custom";
  path: string;
  source?: "manual" | "mongo_cdc";
  diff_json?: string | null; // JSON(FieldChange[]) for updates
  meta_json?: string | null; // JSON({ summary, changed_paths, ip, user_agent, route, method, ... })
};

async function insertEvents(rows: AuditEvent[]) {
  if (!rows.length) return;

  // No sink configured: drop the event rather than throwing into the caller's
  // best-effort try/catch on every request.
  if (!isAuditConfigured) return;

  await ch.insert({
    table: AUDIT_DB_TABLE,
    values: rows,
    format: "JSONEachRow",
  });
}

/** Emit one compact create event (no per-field diffs) */
export async function auditCreated(params: {
  tenantId?: string | null;
  branchId?: string | null;
  userId?: string | null; // subject
  actor?: string | null; // who performed
  aggregateType: string;
  aggregateId: string;
  summary?: string;
  context?: Record<string, any>;
}) {
  const {
    tenantId,
    branchId,
    userId,
    actor,
    aggregateType,
    aggregateId,
    summary,
    context,
  } = params;

  const ev: AuditEvent = {
    event_id: randomUUID(),
    ts: new Date().toISOString(),
    tenant_id: tenantId ?? null,
    branch_id: branchId ?? null,
    user_id: userId ?? null,
    actor: actor ?? null,
    aggregate_type: aggregateType,
    aggregate_id: aggregateId,
    op: "insert",
    path: "*",
    source: "manual",
    diff_json: null,
    meta_json: JSON.stringify({
      summary: summary ?? `${aggregateType} created`,
      ...context,
    }),
  };
  await insertEvents([ev]);
}

/** Emit one update event containing an array of field changes */
export async function auditUpdated(params: {
  tenantId?: string | null;
  branchId?: string | null;
  userId?: string | null; // subject
  actor?: string | null; // who performed
  aggregateType: string;
  aggregateId: string;
  before: any;
  after: any;
  whitelistPaths?: Set<string>;
  summary?: string;
  context?: Record<string, any>;
  forceWhenNoChanges?: boolean;
}) {
  const {
    tenantId,
    branchId,
    userId,
    actor,
    aggregateType,
    aggregateId,
    before,
    after,
    whitelistPaths,
    summary,
    context,
    forceWhenNoChanges = false,
  } = params;

  const changes: FieldChange[] = computeFieldChanges(
    before,
    after,
    "",
    whitelistPaths
  );
  if (!changes.length && !forceWhenNoChanges) return;

  const ev: AuditEvent = {
    event_id: randomUUID(),
    ts: new Date().toISOString(),
    tenant_id: tenantId ?? null,
    branch_id: branchId ?? null,
    user_id: userId ?? null,
    actor: actor ?? null,
    aggregate_type: aggregateType,
    aggregate_id: aggregateId,
    op: "update",
    path: "*",
    source: "manual",
    diff_json: JSON.stringify(changes),
    meta_json: JSON.stringify({
      summary: summary ?? `Updated ${changes.length} field(s)`,
      changed_paths: changes.map((c) => c.path),
      ...context,
    }),
  };

  await insertEvents([ev]);
}

/** Optional: custom events (approvals, state changes, etc.) */
export async function auditCustom(params: {
  tenantId?: string | null;
  branchId?: string | null;
  userId?: string | null;
  actor?: string | null;
  aggregateType: string;
  aggregateId: string;
  summary: string;
  meta?: Record<string, any>;
}) {
  const {
    tenantId,
    branchId,
    userId,
    actor,
    aggregateType,
    aggregateId,
    summary,
    meta,
  } = params;

  const ev: AuditEvent = {
    event_id: randomUUID(),
    ts: new Date().toISOString(),
    tenant_id: tenantId ?? null,
    branch_id: branchId ?? null,
    user_id: userId ?? null,
    actor: actor ?? null,
    aggregate_type: aggregateType,
    aggregate_id: aggregateId,
    op: "custom",
    path: "*",
    source: "manual",
    diff_json: null,
    meta_json: JSON.stringify({ summary, ...meta }),
  };

  await insertEvents([ev]);
}
