import { randomUUID } from "crypto";
import type { Request } from "express";
import { ch, AUDIT_DB_TABLE, isAuditConfigured } from "./clickhouse";
//
type AuditOp =
  | "insert"
  | "update"
  | "replace"
  | "delete"
  | "custom"
  | "view"
  | "login"
  | "register"
  | "logout"
  | "register-tenant"
  | "register-employee"
  | "invitation-sent"
  | "invitation-accepted";

type EventBase = {
  op?: AuditOp;
  /** Namespaced action, e.g. "auth.login.success", "profile.registerSelf" */
  path?: string;
  /** Route or origin url; defaults to req.originalUrl if req is provided */
  source?: string;
  tenantId?: string | null;
  branchId?: string | null;
  /** The subject user id the event is about (not necessarily the actor) */
  userId?: string | null;
  /** Usually actor email/identifier */
  actor?: string | null;
  actorName?: string | null;
  /** Subject user ID (who was affected by the action) */
  subjectUserId?: string | null;
  /** Subject user name (who was affected by the action) */
  subjectUserName?: string | null;
  /** Logical object type this event touches */
  aggregateType: string; // "User" | "Tenant" | "Branch" | "EmployeeProfile" | ...
  /** Identifier of that logical object */
  aggregateId: string;
  /** Optional structured field changes */
  diff?: Array<{ path: string; old: any; new: any }>;
  /** Extra metadata (ip, ua, summary override, etc.) */
  meta?: Record<string, any>;
  /** If provided, request details (ip/ua/route/method) will be captured */
  req?: Request | null;
};

function nowISOms() {
  return new Date().toISOString();
}

function reqMeta(req?: Request | null) {
  if (!req) return {};
  return {
    route: (req as any).route?.path,
    method: req.method,
    ip: req.ip,
    ua: req.headers["user-agent"],
    page: req.headers["x-page"] as string | undefined, // frontend page info
  };
}

/** Emit a single event to ClickHouse. No-op when no sink is configured. */
export async function logAudit(event: EventBase) {
  if (!isAuditConfigured) return;

  const ts = nowISOms();
  const event_id = randomUUID();

  const op: AuditOp = event.op ?? "custom";
  const path = event.path ?? "";
  const source = event.source ?? (event.req ? event.req.originalUrl : "");

  const diff_json = event.diff ? JSON.stringify(event.diff) : null;

  const metaMerged = {
    ...(event.meta || {}),
    ...reqMeta(event.req),
    summary:
      event.meta?.summary ??
      buildDefaultSummary(op, event.aggregateType, path, event.diff),
  };
  const meta_json = JSON.stringify(metaMerged);

  await ch.insert({
    table: AUDIT_DB_TABLE,
    values: [
      {
        event_id,
        ts,
        tenant_id: event.tenantId ?? null,
        branch_id: event.branchId ?? null,
        user_id: event.userId ?? null,
        actor: event.actor ?? null,
        actor_name: event.actorName ?? null,
        subject_user_id: event.subjectUserId ?? null,
        subject_user_name: event.subjectUserName ?? null,
        aggregate_type: event.aggregateType,
        aggregate_id: String(event.aggregateId),
        op,
        path,
        source,
        diff_json,
        meta_json,
      },
    ],
    format: "JSONEachRow",
  });
}

function buildDefaultSummary(
  op: AuditOp,
  aggregateType: string,
  path: string,
  diff?: Array<{ path: string; old: any; new: any }>
) {
  const changesCount = diff?.length ?? 0;

  // clear, friendly verbs for each op
  const opWord =
    op === "insert"
      ? "created"
      : op === "update"
        ? "updated"
        : op === "replace"
          ? "replaced"
          : op === "delete"
            ? "deleted"
            : op === "view"
              ? "viewed"
              : op === "login"
                ? "login"
                : op === "register"
                  ? "registered"
                  : op === "logout"
                    ? "logout"
                    : op === "register-tenant"
                      ? "registered tenant"
                      : op === "register-employee"
                        ? "registered employee"
                        : "performed";

  if (path && changesCount > 0) {
    return `${opWord} ${aggregateType} (${path}, ${changesCount} change${
      changesCount === 1 ? "" : "s"
    })`;
  }
  if (path) return `${opWord} ${aggregateType} (${path})`;
  if (changesCount > 0)
    return `${opWord} ${aggregateType} (${changesCount} change${
      changesCount === 1 ? "" : "s"
    })`;
  return `${opWord} ${aggregateType}`;
}

/* ---------------------------------------------------------
   Convenience helpers for your auth / lifecycle flows
   --------------------------------------------------------- */

/** Login success */
export async function logLoginSuccess(args: {
  req?: Request | null;
  userId: string;
  actorEmail: string;
  actorName?: string | null;
  tenantId?: string | null;
  branchId?: string | null;
}) {
  await logAudit({
    req: args.req ?? null,
    op: "login",
    path: "",
    source: args.req?.originalUrl,
    aggregateType: "User",
    aggregateId: args.userId,
    userId: args.userId,
    actor: args.actorEmail,
    actorName: args.actorName ?? null,
    tenantId: args.tenantId ?? null,
    branchId: args.branchId ?? null,
    diff: [],
    meta: { outcome: "success" },
  });
}

/** Login failure */
export async function logLoginFailure(args: {
  req?: Request | null;
  email: string;
  reason?: string;
}) {
  await logAudit({
    req: args.req ?? null,
    op: "login",
    path: "",
    aggregateType: "User",
    aggregateId: "unknown",
    userId: null,
    actor: args.email,
    actorName: null,
    diff: [],
    meta: { outcome: "failure", reason: args.reason || "Invalid credentials" },
  });
}

/** Basic user account registration (standalone) */
export async function logRegisterUser(args: {
  req?: Request | null;
  userId: string;
  email: string;
  fullName?: string | null;
}) {
  await logAudit({
    req: args.req ?? null,
    op: "register",
    path: "",
    aggregateType: "User",
    aggregateId: args.userId,
    userId: args.userId,
    actor: args.email,
    actorName: args.fullName ?? null,
    // keep diff small/readable (you can uncomment/add more if desired)
    diff: [
      // { path: "user.email", old: null, new: args.email },
      // { path: "user.fullName", old: null, new: args.fullName ?? "" },
    ],
  });
}

/** Tenant registration (owner creates tenant) */
export async function logRegisterTenant(args: {
  req: Request;
  tenantId: string;
  ownerUserId: string;
  ownerEmail: string;
  ownerName?: string | null;
  companyName: string;
}) {
  await logAudit({
    req: args.req,
    op: "register-tenant",
    path: "tenant.create",
    aggregateType: "Tenant",
    aggregateId: args.tenantId,
    userId: args.ownerUserId,
    actor: args.ownerEmail,
    actorName: args.ownerName ?? null,
    tenantId: args.tenantId,
    branchId: null,
    diff: [{ path: "tenant.name", old: null, new: args.companyName }],
  });
}

/**
 * Employee registration (or converting a user into employee mode).
 * If mode === 'employee', op = 'register-employee'; otherwise op = 'register'.
 */
export async function logRegisterEmployee(args: {
  req?: Request | null;
  userId: string;
  email: string;
  fullName?: string | null;
  tenantId?: string | null;
  branchId?: string | null;
  mode?: string | null; // e.g. 'employee'
  profilePreview?: Record<string, any>; // optional small snapshot
}) {
  const op: AuditOp =
    (args.mode || "").toLowerCase() === "employee"
      ? "register-employee"
      : "register";

  //   const diff: Array<{ path: string; old: any; new: any }> = [
  //     { path: "user.email", old: null, new: args.email },
  //     { path: "user.fullName", old: null, new: args.fullName ?? "" },
  //     { path: "currentMode", old: null, new: args.mode ?? "employee" },
  //   ];

  //   if (args.tenantId)
  //     diff.push({ path: "tenantId", old: null, new: args.tenantId });
  //   if (args.branchId)
  //     diff.push({ path: "branchId", old: null, new: args.branchId });

  //   // include a tiny, safe preview of profile fields if provided
  //   if (args.profilePreview) {
  //     Object.entries(args.profilePreview).forEach(([k, v]) => {
  //       diff.push({ path: `profile.${k}`, old: null, new: v });
  //     });
  //   }

  await logAudit({
    req: args.req ?? null,
    op,
    path: "",
    aggregateType: "EmployeeProfile",
    aggregateId: args.userId,
    userId: args.userId,
    actor: args.email,
    actorName: args.fullName ?? null,
    tenantId: args.tenantId ?? null,
    branchId: args.branchId ?? null,
    diff: [],
  });
}

/** Mode change (ex: newbie -> organization/employee) */
export async function logUpdateUserMode(args: {
  req?: Request | null;
  userId: string;
  email?: string | null;
  fullName?: string | null;
  oldMode?: string | null;
  newMode: string;
  tenantId?: string | null;
  branchId?: string | null;
}) {
  await logAudit({
    req: args.req ?? null,
    op: "update",
    path: "user.mode",
    aggregateType: "User",
    aggregateId: args.userId,
    userId: args.userId,
    actor: args.email ?? null,
    actorName: args.fullName ?? null,
    tenantId: args.tenantId ?? null,
    branchId: args.branchId ?? null,
    diff: [
      { path: "currentMode", old: args.oldMode ?? null, new: args.newMode },
    ],
  });
}

/** Logout */
export async function logLogout(args: {
  req?: Request | null;
  userId?: string | null;
  email?: string | null;
}) {
  await logAudit({
    req: args.req ?? null,
    op: "logout",
    path: "",
    aggregateType: "User",
    aggregateId: args.userId || "unknown",
    userId: args.userId ?? null,
    actor: args.email ?? null,
    actorName: null,
    diff: [],
    meta: { outcome: "success" },
  });
}

// Branch
//   await logAudit({
//     req: args.req,
//     op: "register-tenant",
//     path: "branch.create",
//     aggregateType: "Branch",
//     aggregateId: args.branchId,
//     userId: args.ownerUserId,
//     actor: args.ownerEmail,
//     actorName: args.ownerName ?? null,
//     tenantId: args.tenantId,
//     branchId: args.branchId,
//     diff: [{ path: "branchname", old: null, new: args.companyName }],
//   });

// Assignment (owner role)
//   await logAudit({
//     req: args.req,
//     op: "update",
//     path: "user.assignments",
//     aggregateType: "User",
//     aggregateId: args.ownerUserId,
//     userId: args.ownerUserId,
//     actor: args.ownerEmail,
//     actorName: args.ownerName ?? null,
//     tenantId: args.tenantId,
//     branchId: args.branchId,
//     diff: [
//       {
//         path: "assignments",
//         old: "[]",
//         new: `[{"tenantId":"${args.tenantId}","branchId":"${args.branchId}","role":"tenant-owner"}]`,
//       },
//       { path: "currentMode", old: "newbie", new: "organization" },
//     ],
//   });
