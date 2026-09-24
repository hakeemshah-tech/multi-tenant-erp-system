// src/audit/types.ts
import { Types } from "mongoose";

export type AuditOp =
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
  | "invitation-accepted"
  | "field-change-requested"
  | "field-change-approved"
  | "field-change-rejected"
  | "document-uploaded"
  | "document-updated"
  | "document-approved"
  | "document-rejected"
  | "document-expired";

export type AuditSource = "manual" | "mongo_cdc" | "system";

export type AuditChange = {
  path: string; // e.g. "personaldetails.firstname" or "address"
  old: any;
  new: any;
};

export type AuditContext = {
  actorUserId?: string | Types.ObjectId;
  actorEmail?: string;
  actorName?: string; // Actor's actual name (not email)
  route?: string;
  method?: string;
  ip?: string;
  ua?: string;
  page?: string; // frontend page/route where the action originated
};

export type AggregateType =
  | "Employee"
  | "EmployeeProfile"
  | "Timesheet"
  | "User"
  | "EmployeeFieldChangeRequest"
  | "DocumentStatus"
  | "Custom";

export type BaseAuditParams = {
  tenantId: string | Types.ObjectId;
  branchId?: string | Types.ObjectId; // optional for tenant-wide events
  subjectUserId?: string | Types.ObjectId; // the user whose record changed
  subjectUserName?: string | Types.ObjectId; // the user whose record changed
  aggregateType: AggregateType;
  aggregateId: string | Types.ObjectId; // document id / business id
  source?: AuditSource; // default: 'manual'
  audit?: AuditContext; // actor + request metadata
};

export type UpdateAuditParams = BaseAuditParams & {
  sectionKey?: string;
  isAdditional?: boolean;
  changes: AuditChange[]; // if >1, we will set path="*"
};

export type SimpleAuditParams = BaseAuditParams & {
  summary: string; // textual summary for insert/delete/custom
  meta?: Record<string, any>; // extra metadata to embed into meta_json
  path?: string; // default: "*"
};
