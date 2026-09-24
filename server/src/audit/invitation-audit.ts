import { logAudit } from "./auth-audit";

export async function logInvitationSent(args: {
  req?: Request | null;
  tenantId: string;
  branchId: string;
  designationId: string;
  invitationId: string;
  invitedEmail: string; // the person being invited
  actorUserId?: string | null; // who sent the invite
  actorEmail?: string | null;
  actorName?: string | null;
}) {
  await logAudit({
    req: args.req ?? null,
    op: "invitation-sent",
    path: "employee.invitation.sent",
    aggregateType: "EmployeeInvitation",
    aggregateId: args.invitationId,
    tenantId: args.tenantId,
    branchId: args.branchId,
    userId: args.actorUserId ?? null,
    actor: args.actorEmail ?? null,
    actorName: args.actorName ?? null,
    diff: [
      //   { path: "email", old: null, new: args.invitedEmail },
      //   { path: "designationId", old: null, new: args.designationId },
      //   { path: "status", old: null, new: "pending" },
    ],
    meta: {
      invitedEmail: args.invitedEmail,
      designationId: args.designationId,
      summary: `${args.invitedEmail} has sented invitation`, // per your exact phrasing
    },
  });
}

export async function logInvitationAccepted(args: {
  req?: Request | null;
  tenantId: string;
  branchId: string;
  designationId: string;
  invitationId: string;
  actorName: string;
  actorEmail: string;
  invitedEmail: string; // person who accepted
  userId?: string | null; // resulting user id if available
  meta: any;
}) {
  await logAudit({
    req: args.req ?? null,
    op: "invitation-accepted",
    path: "employee.invitation.accepted",
    aggregateType: "EmployeeInvitation",
    aggregateId: args.invitationId,
    tenantId: args.tenantId,
    branchId: args.branchId,
    userId: args.userId ?? null,
    actor: args.actorEmail, // actor is the accepting email
    actorName: args.actorName,
    diff: [],
    meta: args.meta,
  });
}
