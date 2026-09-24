"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Table,
  Input,
  Select,
  Badge,
  Title,
  Checkbox,
  Text,
} from "rizzui";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import { ArrowDownTrayIcon } from "@heroicons/react/24/solid";
import axiosInstance from "@/app/lib/axios";

/* =========================================================
   Types
   ========================================================= */

type AuditRow = {
  event_id: string;
  ts: string; // ISO
  tenant_id?: string | null;
  branch_id?: string | null;
  user_id?: string | null;
  actor?: string | null;
  actor_name?: string | null;
  aggregate_type: string;
  aggregate_id: string;
  op: "insert" | "update" | "replace" | "delete" | "custom";
  path: string;
  source?: string | null;
  diff_json?: string | null;
  meta_json?: string | null;
};

type DiffChange = { path: string; old: any; new: any };

type MetaJson = {
  summary?: string;
  sectionKey?: string;
  isAdditional?: boolean;
  count?: number;
  route?: string;
  method?: string;
  ip?: string;
  ua?: string;
  page?: string;
};

/* =========================================================
   General Utils
   ========================================================= */

const OP_OPTIONS = [
  { label: "Any", value: "" },
  { label: "Insert", value: "insert" },
  { label: "Update", value: "update" },
  { label: "Replace", value: "replace" },
  { label: "Delete", value: "delete" },
  { label: "Custom", value: "custom" },
  { label: "View", value: "view" },
  { label: "Login", value: "login" },
  { label: "Register", value: "register" },
  { label: "Logout", value: "logout" },
  { label: "Register Tenant", value: "register-tenant" },
  { label: "Register Employee", value: "register-employee" },
  { label: "Invitation Sent", value: "invitation-sent" },
  { label: "Invitation Accepted", value: "invitation-accepted" },
  { label: "Field Change Requested", value: "field-change-requested" },
  { label: "Field Change Approved", value: "field-change-approved" },
  { label: "Field Change Rejected", value: "field-change-rejected" },
];

function safeParse<T = any>(json?: string | null): T | undefined {
  if (!json) return undefined;
  try {
    return JSON.parse(json) as T;
  } catch {
    return undefined;
  }
}
function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}
function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  if (isNaN(d)) return "";
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24);
  return `${dd}d ago`;
}
function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    // Format: MM/DD/YYYY, H:MM:SS AM/PM {TIMEZONE}
    const dateStr = d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const timeStr = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    // Get timezone abbreviation (e.g., "IST", "PST", "EST", "UTC")
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZoneName: "short",
    });
    const parts = formatter.formatToParts(d);
    const timeZonePart = parts.find((part) => part.type === "timeZoneName");
    const timezoneStr = timeZonePart?.value || "UTC";
    return `${dateStr}, ${timeStr} ${timezoneStr}`;
  } catch {
    return iso;
  }
}
function isIsoDateLike(v: any) {
  if (typeof v !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}T/.test(v);
}
function shortenId(id?: string | null, left = 6, right = 4) {
  if (!id) return "—";
  if (id.length <= left + right + 3) return id;
  return `${id.slice(0, left)}…${id.slice(-right)}`;
}
function fileNameFromKey(key?: string) {
  if (!key) return "";
  const part = key.split("/").pop() || key;
  return decodeURIComponent(part);
}
function toIsoOrUndefined(localDT?: string) {
  if (!localDT) return undefined;
  const d = new Date(localDT);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}
function download(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function toCSV(rows: AuditRow[]) {
  const header = [
    "event_id",
    "ts",
    "tenant_id",
    "branch_id",
    "user_id",
    "actor",
    "actor_name",
    "aggregate_type",
    "aggregate_id",
    "op",
    "path",
    "source",
    "diff_json",
    "meta_json",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const vals = header.map((h) => {
      const v = (r as any)[h];
      if (v == null) return "";
      const s = String(v);
      if (s.includes(",") || s.includes("\n") || s.includes('"')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    });
    lines.push(vals.join(","));
  }
  return lines.join("\n");
}

const OpBadge: React.FC<{ op: AuditRow["op"] }> = ({ op }) => {
  const map: Record<string, { color: any; label: string }> = {
    insert: { color: "success", label: "Insert" },
    update: { color: "info", label: "Update" },
    replace: { color: "purple", label: "Replace" },
    delete: { color: "danger", label: "Delete" },
    custom: { color: "gray", label: "Custom" },
  };
  const m = map[op] || { color: "gray", label: op };
  return <Text style={{ color: m.color as any }}>{m.label}</Text>;
};

function formatUA(ua?: string) {
  if (!ua) return "Unknown device";
  const s = ua;

  let browser = "Browser";
  let version = "";
  if (/Edg\/([\d.]+)/.test(s)) {
    browser = "Edge";
    version = RegExp.$1;
  } else if (/Chrome\/([\d.]+)/.test(s) && !/Chromium/.test(s)) {
    browser = "Chrome";
    version = RegExp.$1;
  } else if (/Version\/([\d.]+).*Safari/.test(s)) {
    browser = "Safari";
    version = RegExp.$1;
  } else if (/Firefox\/([\d.]+)/.test(s)) {
    browser = "Firefox";
    version = RegExp.$1;
  }

  let os = "OS";
  if (/Windows NT 10/.test(s)) os = "Windows 10+";
  else if (/Windows NT 6\.3/.test(s)) os = "Windows 8.1";
  else if (/Windows NT 6\.2/.test(s)) os = "Windows 8";
  else if (/Windows NT 6\.1/.test(s)) os = "Windows 7";
  else if (/Mac OS X ([\d_]+)/.test(s))
    os = "macOS " + RegExp.$1.replace(/_/g, ".");
  else if (/Android ([\d.]+)/.test(s)) os = "Android " + RegExp.$1;
  else if (/iPhone OS ([\d_]+)/.test(s))
    os = "iOS " + RegExp.$1.replace(/_/g, ".");
  else if (/iPad; CPU OS ([\d_]+)/.test(s))
    os = "iPadOS " + RegExp.$1.replace(/_/g, ".");
  else if (/Linux/.test(s)) os = "Linux";

  const device = /Mobi|Mobile|Android/i.test(s) ? "Mobile" : "Desktop";
  return `${browser}${version ? " " + version : ""} on ${os} (${device})`;
}

function PrettyValue({ value }: { value: any }) {
  if (value === null || value === undefined || value === "")
    return <span className="text-gray-400">—</span>;
  if (typeof value === "boolean")
    return <span>{value ? "true" : "false"}</span>;
  if (typeof value === "number") return <span>{value}</span>;
  if (typeof value === "string") {
    if (isIsoDateLike(value)) {
      return <span title={value}>{formatDateTime(value)}</span>;
    }
    return <span className="break-words">{value}</span>;
  }
  if (typeof value === "object" && (value.fileId || value.key)) {
    const name = fileNameFromKey(value.key);
    return (
      <div className="space-y-0.5 text-xs">
        <div className="font-medium break-words">{name || "file"}</div>
        <div className="text-gray-500">
          fileId: {shortenId(String(value.fileId || ""))}
        </div>
        {value.expiryDate && (
          <div className="text-gray-500">
            expiry: {formatDateTime(value.expiryDate)}
          </div>
        )}
        {value.issuingDate && (
          <div className="text-gray-500">
            issued: {formatDateTime(value.issuingDate)}
          </div>
        )}
      </div>
    );
  }
  return (
    <pre className="text-[12px] leading-5 whitespace-pre-wrap break-words font-mono">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

/* =========================================================
   Address Diff – Array<row> ↔ Array<row> (your diff_json format)
   ========================================================= */

type AddressRow = Record<string, any>;
type AddressArrayDiff = {
  index: number;
  title: string;
  fields: Array<{
    key: string;
    label: string;
    oldVal: any;
    newVal: any;
    changed: boolean;
  }>;
};

/** Friendly labels for common keys; fallback to capitalized key */
const ADDRESS_LABELS: Record<string, string> = {
  addressFor: "Label",
  buildingpropertyname: "Building/Property",
  flatunitnumber: "Unit / Flat",
  streetnumber: "Street No.",
  streetname: "Street Name",
  suburbcity: "Suburb / City",
  stateterritiory: "State / Territory",
  zippostalcode: "ZIP / Postal",
  country: "Country",
  addressLine1: "Address Line 1",
  addressLine2: "Address Line 2",
  city: "City",
  state: "State",
  zip: "ZIP / Postal",
};

const ADDRESS_FIELD_ORDER = [
  "addressFor",
  "buildingpropertyname",
  "flatunitnumber",
  "streetnumber",
  "streetname",
  "suburbcity",
  "stateterritiory",
  "zippostalcode",
  "country",
  // common alt names (if your data sometimes uses them)
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "zip",
];

function normalizeAddressRow(row?: AddressRow): AddressRow {
  return { ...(row ?? {}) };
}

function labelFor(key: string) {
  return (
    ADDRESS_LABELS[key] ||
    key
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .replace(/^./, (c) => c.toUpperCase())
  );
}

function buildAddressArrayDiff(
  oldArr: AddressRow[],
  newArr: AddressRow[]
): AddressArrayDiff[] {
  const maxLen = Math.max(oldArr?.length ?? 0, newArr?.length ?? 0);
  const out: AddressArrayDiff[] = [];

  for (let i = 0; i < maxLen; i++) {
    const oldRow = normalizeAddressRow(oldArr?.[i]);
    const newRow = normalizeAddressRow(newArr?.[i]);

    const allKeys = Array.from(
      new Set([
        ...ADDRESS_FIELD_ORDER,
        ...Object.keys(oldRow),
        ...Object.keys(newRow),
      ])
    );

    const fields = allKeys.map((key) => {
      const oldVal = oldRow[key];
      const newVal = newRow[key];
      const changed =
        JSON.stringify(oldVal ?? null) !== JSON.stringify(newVal ?? null);
      return {
        key,
        label: labelFor(key),
        oldVal,
        newVal,
        changed,
      };
    });

    const title = (newRow.addressFor ||
      oldRow.addressFor ||
      `Address #${i + 1}`) as string;

    // sort by our curated order
    fields.sort((a, b) => {
      const ai = ADDRESS_FIELD_ORDER.indexOf(a.key);
      const bi = ADDRESS_FIELD_ORDER.indexOf(b.key);
      if (ai === -1 && bi === -1) return a.label.localeCompare(b.label);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    out.push({ index: i, title, fields });
  }

  return out;
}

function isAddressArrayChange(change: { path: string; old: any; new: any }) {
  return (
    change?.path === "address" &&
    Array.isArray(change.old) &&
    Array.isArray(change.new)
  );
}

function PrettyInline({ v }: { v: any }) {
  if (v === null || v === undefined || v === "")
    return <span className="text-gray-400">—</span>;
  if (typeof v === "boolean") return <span>{v ? "true" : "false"}</span>;
  if (typeof v === "string") return <span className="break-words">{v}</span>;
  if (typeof v === "number") return <span>{v}</span>;
  return <span className="break-words">{String(v)}</span>;
}

const AddressChangeCard: React.FC<{ group: AddressArrayDiff }> = ({
  group,
}) => {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const hasAnyChanged = group.fields.some((f) => f.changed);
  const visible = group.fields.filter((f) =>
    showUnchanged ? true : f.changed
  );

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-indigo-50">
        <div className="text-xs font-semibold text-indigo-800">
          {group.title}
        </div>
        <div className="flex items-center gap-2">
          {!hasAnyChanged && (
            <span className="text-[11px] text-gray-600">No changes</span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowUnchanged((s) => !s)}
          >
            {showUnchanged ? (
              <>
                <ChevronUpIcon className="w-4 h-4 mr-1" />
                Hide unchanged
              </>
            ) : (
              <>
                <ChevronDownIcon className="w-4 h-4 mr-1" />
                Show unchanged
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="divide-y">
        {visible.map((f) => (
          <div key={f.key} className="grid grid-cols-12 gap-2 p-3">
            <div className="col-span-12 md:col-span-3">
              <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
                {f.label}
              </div>
              {f.changed ? (
                <span className="inline-flex items-center text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">
                  changed
                </span>
              ) : (
                <span className="inline-flex items-center text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">
                  unchanged
                </span>
              )}
            </div>

            <div className="col-span-12 md:col-span-4">
              <div className="text-[11px] text-gray-500 mb-1">Old</div>
              <div className="rounded border border-red-100 bg-red-50/50 px-2 py-1.5">
                <PrettyInline v={f.oldVal} />
              </div>
            </div>

            <div className="hidden md:flex md:col-span-1 items-center justify-center text-gray-400">
              <span>→</span>
            </div>

            <div className="col-span-12 md:col-span-4">
              <div className="text-[11px] text-gray-500 mb-1">New</div>
              <div
                className={
                  "rounded px-2 py-1.5 " +
                  (f.changed
                    ? "border border-green-100 bg-green-50/60"
                    : "border border-gray-100 bg-gray-50")
                }
              >
                <PrettyInline v={f.newVal} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AddressArrayDiffViewer: React.FC<{
  oldArr: AddressRow[];
  newArr: AddressRow[];
}> = ({ oldArr, newArr }) => {
  const groups = useMemo(
    () => buildAddressArrayDiff(oldArr, newArr),
    [oldArr, newArr]
  );
  if (!groups.length) {
    return <div className="text-xs text-gray-500">No address items.</div>;
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <AddressChangeCard key={g.index} group={g} />
      ))}
    </div>
  );
};

/* =========================================================
   Address Diff – Field-level (address.0.city style) – fallback
   ========================================================= */

const ADDRESS_FIELDS_ORDER_FALLBACK = [
  "addressFor",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "zip",
  "country",
  "buildingpropertyname",
  "flatunitnumber",
  "streetnumber",
  "streetname",
  "suburbcity",
  "stateterritiory",
  "zippostalcode",
];

function parseAddressPath(
  path: string
): { isAddress: true; index: number; field: string } | { isAddress: false } {
  // supports: "address.0.city" OR "address[0].city" OR "employeeFields.address.0.city"
  const m =
    /^address(?:\.|\[)(\d+)(?:\])?\.(.+)$/.exec(path) ||
    /^employeeFields\.address(?:\.|\[)(\d+)(?:\])?\.(.+)$/.exec(path);
  if (!m) return { isAddress: false };
  const index = Number(m[1]);
  const field = m[2];
  if (Number.isNaN(index)) return { isAddress: false };
  return { isAddress: true, index, field };
}

type AddressDiffMap = Record<
  number,
  Array<{ field: string; old: any; new: any }>
>;

function buildAddressDiffMap(changes: DiffChange[]): AddressDiffMap {
  const out: AddressDiffMap = {};
  for (const c of changes) {
    const p = parseAddressPath(c.path);
    if (!("isAddress" in p) || !p.isAddress) continue;
    if (!out[p.index]) out[p.index] = [];
    out[p.index].push({ field: p.field, old: c.old, new: c.new });
  }
  for (const idx of Object.keys(out)) {
    out[Number(idx)].sort((a, b) => {
      const ai = ADDRESS_FIELDS_ORDER_FALLBACK.indexOf(a.field);
      const bi = ADDRESS_FIELDS_ORDER_FALLBACK.indexOf(b.field);
      if (ai === -1 && bi === -1) return a.field.localeCompare(b.field);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }
  return out;
}

const AddressTable: React.FC<{
  rows: Array<{ label: string; old: any; nevv: any }>;
}> = ({ rows }) => {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-12 bg-gray-50 text-xs font-medium text-gray-600 border-b">
        <div className="col-span-4 px-3 py-2">Field</div>
        <div className="col-span-4 px-3 py-2">Old</div>
        <div className="col-span-4 px-3 py-2">New</div>
      </div>
      {rows.map((r, i) => (
        <div
          className={classNames(
            "grid grid-cols-12 text-sm",
            i % 2 ? "bg-white" : "bg-gray-50/40"
          )}
          key={i}
        >
          <div className="col-span-4 px-3 py-2 text-gray-700">{r.label}</div>
          <div className="col-span-4 px-3 py-2">
            <div className="rounded border border-red-100 bg-red-50/50 p-2">
              <PrettyValue value={r.old} />
            </div>
          </div>
          <div className="col-span-4 px-3 py-2">
            <div className="rounded border border-green-100 bg-green-50/50 p-2">
              <PrettyValue value={r.nevv} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const AddressGroupCard: React.FC<{
  index: number;
  items: Array<{ field: string; old: any; new: any }>;
}> = ({ index, items }) => {
  const forItem = items.find((i) => i.field === "addressFor");
  const title = (forItem?.new ||
    forItem?.old ||
    `Address #${Number(index) + 1}`) as string;

  const byField: Record<string, { old: any; new: any }> = {};
  items.forEach((i) => (byField[i.field] = { old: i.old, new: i.new }));

  const allFields = Array.from(
    new Set([...ADDRESS_FIELDS_ORDER_FALLBACK, ...items.map((i) => i.field)])
  ).filter((f) => f !== "addressFor");

  const rows = allFields.map((f) => ({
    label: labelFor(f),
    old: byField[f]?.old,
    nevv: byField[f]?.new,
  }));

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-3 py-2 border-b bg-indigo-50 text-xs font-semibold text-indigo-800">
        {title}
      </div>
      <div className="p-3">
        <AddressTable rows={rows} />
      </div>
    </div>
  );
};

/* =========================================================
   Generic diff fallback (non-address / non-documents)
   ========================================================= */

function DiffCard({ change }: { change: DiffChange }) {
  return (
    <div className="rounded-md border border-gray-200 overflow-hidden">
      <div className="px-3 py-2 border-b bg-gray-50 text-xs font-medium text-gray-700">
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
            {change.path}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="p-3 border-r md:border-r">
          <div className="text-[11px] text-gray-500 mb-1">Old</div>
          <div className="rounded border border-red-100 bg-red-50/50 p-2">
            <PrettyValue value={change.old} />
          </div>
        </div>
        <div className="p-3">
          <div className="text-[11px] text-gray-500 mb-1">New</div>
          <div className="rounded border border-green-100 bg-green-50/50 p-2">
            <PrettyValue value={change.new} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Page
   ========================================================= */

export default function AuditEventsPage() {
  // Filters
  const [tenantId, setTenantId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [userId, setUserId] = useState("");
  const [actorName, setActorName] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [op, setOp] = useState<string>("");
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [limit, setLimit] = useState<number>(100);

  // Date range
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  // Data
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Available pages for filtering - Static list of all possible routes
  const availablePages = [
    // Main pages
    "/",
    "/login",
    "/register",
    "/register-tenant",
    "/accept-invite",
    "/onboarding",
    "/create-nexus-profile",
    "/join-review",

    // Tenant pages
    "/tenant",
    "/tenant/dashboard",
    "/tenant/departments",
    "/tenant/job-titles",
    "/tenant/employees",
    "/tenant/employees/add",
    "/tenant/employees/[id]",
    "/tenant/employees/[id]/edit",
    "/tenant/configs/fields",
    "/tenant/configs/documents",
    "/tenant/audit",

    // Nexus Profile pages
    "/nexus-profile",
    "/nexus-profile/organizations",
    "/nexus-profile/organizations/[branchId]",
    "/nexus-profile/invitations",
    "/nexus-profile/profile-update",

    // Employee pages
    "/employee/dashboard",

    // Superadmin pages
    "/superadmin/dashboard",

    // Audit pages
    "/audit",
  ];

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  const [paginationLoading, setPaginationLoading] = useState(false);

  // UI state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchEvents = useCallback(
    async (page: number = 1, resetData: boolean = true) => {
      if (resetData) {
        setLoading(true);
      } else {
        setPaginationLoading(true);
      }
      setErr(null);

      try {
        const params: Record<string, any> = {
          limit,
          page,
          count: true, // Request total count for pagination
        };

        if (tenantId) params.tenantId = tenantId;
        if (branchId) params.branchId = branchId;
        if (userId) params.userId = userId;
        if (actorName) params.actor_name = actorName;
        if (subjectName) params.subject_name = subjectName;
        if (op) params.op = op;
        if (selectedPages.length > 0) params.pages = selectedPages.join(",");

        if (from) params.from = toIsoOrUndefined(from);
        if (to) params.to = toIsoOrUndefined(to);

        const res = await axiosInstance.get("/audit/events", { params });
        const data = (res.data?.data || []) as AuditRow[];
        const total = res.data?.total || 0;
        const hasNext = res.data?.hasNext || false;
        const hasPrev = res.data?.hasPrev || false;

        console.log("API Response:", {
          dataLength: data.length,
          total,
          hasNext,
          hasPrev,
          page,
          limit,
        });

        if (resetData) {
          setRows(data);
          setCurrentPage(page);
        } else {
          setRows(data);
          setCurrentPage(page);
        }

        setTotalCount(total);
        setHasNextPage(hasNext);
        setHasPrevPage(hasPrev);
      } catch (e: any) {
        console.error(e);
        setErr(e?.response?.data?.message || "Failed to load audit events");
      } finally {
        setLoading(false);
        setPaginationLoading(false);
      }
    },
    [
      limit,
      tenantId,
      branchId,
      userId,
      actorName,
      subjectName,
      op,
      selectedPages,
      from,
      to,
    ]
  );

  // No need to fetch pages anymore - using static list

  useEffect(() => {
    fetchEvents(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => fetchEvents(currentPage, false), 15000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchEvents, currentPage]);

  const onApplyFilters = () => fetchEvents(1, true);
  const onClearFilters = () => {
    // Reset all filter states
    setTenantId("");
    setBranchId("");
    setUserId("");
    setActorName("");
    setSubjectName("");
    setOp("");
    setSelectedPages([]);
    setFrom("");
    setTo("");
    setLimit(100); // Reset limit to default
    setCurrentPage(1); // Reset to first page

    // Force a fetch with cleared parameters to ensure it works
    setTimeout(() => {
      // Create a fresh fetch with no filters
      const fetchClearedEvents = async () => {
        setLoading(true);
        setErr(null);

        try {
          const params: Record<string, any> = {
            limit: 100,
            page: 1,
            count: true,
          };

          const res = await axiosInstance.get("/audit/events", { params });
          const data = (res.data?.data || []) as AuditRow[];
          const total = res.data?.total || 0;
          const hasNext = res.data?.hasNext || false;
          const hasPrev = res.data?.hasPrev || false;

          setRows(data);
          setTotalCount(total);
          setHasNextPage(hasNext);
          setHasPrevPage(hasPrev);
          setCurrentPage(1);

          console.log(
            "Cleared filters - fetched events:",
            data.length,
            "total:",
            total
          );
        } catch (e: any) {
          console.error("Error fetching cleared events:", e);
          setErr(e?.response?.data?.message || "Failed to load audit events");
        } finally {
          setLoading(false);
        }
      };

      fetchClearedEvents();
    }, 50); // Slightly longer delay to ensure state updates
  };

  const quickRange = (days: number) => {
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 3600 * 1000);
    const toLocal = (d: Date) =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    setFrom(toLocal(start));
    setTo(toLocal(now));
  };

  const exportJSON = () =>
    download(
      `audit-events-${Date.now()}.json`,
      JSON.stringify(rows, null, 2),
      "application/json"
    );
  const exportCSV = () =>
    download(`audit-events-${Date.now()}.csv`, toCSV(rows), "text/csv");

  // Pagination functions
  const goToPage = (page: number) => {
    if (page >= 1 && page <= Math.ceil(totalCount / limit)) {
      fetchEvents(page, false);
    }
  };

  const goToNextPage = () => {
    if (hasNextPage) {
      fetchEvents(currentPage + 1, false);
    }
  };

  const goToPrevPage = () => {
    if (hasPrevPage) {
      fetchEvents(currentPage - 1, false);
    }
  };

  const totalPages = Math.ceil(totalCount / limit);
  const startItem = (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, totalCount);

  console.log("Pagination State:", {
    currentPage,
    totalCount,
    limit,
    totalPages,
    hasNextPage,
    hasPrevPage,
    startItem,
    endItem,
  });

  return (
    <div className="space-y-6">
      {/* Header / Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Audit Events</h2>
          <p className="text-sm text-gray-500">
            Inspect activity across your tenant with rich filters & readable
            diffs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            label="Auto-refresh"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          <Button variant="outline" onClick={exportCSV}>
            <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
            CSV
          </Button>
          <Button variant="outline" onClick={exportJSON}>
            <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
            JSON
          </Button>
          <Button onClick={onApplyFilters}>Refresh</Button>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <FunnelIcon className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((s) => !s)}
            className="flex items-center gap-1"
          >
            <span>{showFilters ? "Hide" : "Show"}</span>
            <ChevronDownIcon
              className={classNames(
                "w-4 h-4 transition-transform",
                showFilters ? "rotate-180" : ""
              )}
            />
          </Button>
        </div>

        {showFilters && (
          <div className="p-6 bg-white border-t border-gray-200">
            <div className="space-y-6">
              {/* Core Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Input
                  label="Subject Name"
                  placeholder="e.g. John, Jane"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                />
                <Input
                  label="Actor Name"
                  placeholder="e.g. John, Jane"
                  value={actorName}
                  onChange={(e) => setActorName(e.target.value)}
                />
                <Select
                  label="Operation"
                  value={
                    OP_OPTIONS.find((o) => o.value === op) || OP_OPTIONS[0]
                  }
                  onChange={(opt: any) => setOp(opt?.value || "")}
                  options={OP_OPTIONS}
                />
              </div>

              {/* Limit, Date Range, and Page Filter */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Results Limit */}
                <div>
                  <Input
                    label="Results Limit"
                    type="number"
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value || 100))}
                    min={1}
                    max={1000}
                  />
                </div>

                {/* From Date */}
                <div>
                  <Input
                    label="From Date"
                    type="datetime-local"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </div>

                {/* To Date */}
                <div>
                  <Input
                    label="To Date"
                    type="datetime-local"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>

                {/* Page Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filter by Pages
                  </label>
                  <div className="space-y-2">
                    {/* Selected Pages Tags */}
                    {selectedPages.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedPages.map((page) => (
                          <span
                            key={page}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md"
                          >
                            {page}
                            <button
                              onClick={() =>
                                setSelectedPages((prev) =>
                                  prev.filter((p) => p !== page)
                                )
                              }
                              className="ml-1 text-blue-600 hover:text-blue-800"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Page Selection */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <select
                          className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                          value=""
                          onChange={(e) => {
                            const selectedPage = e.target.value;
                            if (
                              selectedPage &&
                              !selectedPages.includes(selectedPage)
                            ) {
                              setSelectedPages((prev) => [
                                ...prev,
                                selectedPage,
                              ]);
                            }
                          }}
                        >
                          <option value="">Select pages...</option>
                          {availablePages.map((page) => (
                            <option key={page} value={page}>
                              {page}
                            </option>
                          ))}
                        </select>
                      </div>
                      {selectedPages.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPages([])}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Date Range Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickRange(1)}
                >
                  Last 24h
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickRange(7)}
                >
                  Last 7d
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickRange(30)}
                >
                  Last 30d
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickRange(90)}
                >
                  Last 90d
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button onClick={onApplyFilters} className="px-6">
                  Apply Filters
                </Button>
                <Button
                  variant="outline"
                  onClick={onClearFilters}
                  className="px-6"
                >
                  Clear All
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 overflow-x-auto">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head className="min-w-[200px]">Time</Table.Head>
              <Table.Head>Action Made Email</Table.Head>
              <Table.Head>Action Made Name</Table.Head>
              <Table.Head>Subject User Name</Table.Head>
              <Table.Head>Op</Table.Head>
              <Table.Head>Page</Table.Head>
              <Table.Head>Summary</Table.Head>
              <Table.Head className="text-right">Changes</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body className="text-sm">
            {loading ? (
              <Table.Row>
                <Table.Cell colSpan={8}>
                  <div className="flex items-center justify-center gap-2 py-10 text-gray-500">
                    Loading…
                  </div>
                </Table.Cell>
              </Table.Row>
            ) : err ? (
              <Table.Row>
                <Table.Cell colSpan={8}>
                  <div className="text-center text-red-600 py-6">{err}</div>
                </Table.Cell>
              </Table.Row>
            ) : rows.length ? (
              rows.map((r) => {
                const meta = safeParse<MetaJson>(r.meta_json) || {};
                const diff = safeParse<DiffChange[]>(r.diff_json) || [];
                const isExpanded = expandedId === r.event_id;

                // Flags
                const isDocumentsEvent = meta.sectionKey === "documents";

                // Address array-diff (primary) – path === "address" and both old/new arrays
                const addressArrayChange = diff.find(isAddressArrayChange);
                const isAddressEvent =
                  meta.sectionKey === "address" ||
                  !!addressArrayChange ||
                  diff.some((d) => parseAddressPath(d.path).isAddress);

                return (
                  <React.Fragment key={r.event_id}>
                    <Table.Row
                      className={classNames(
                        "align-top",
                        isExpanded ? "bg-indigo-50/50" : ""
                      )}
                    >
                      <Table.Cell title={r.ts}>
                        <div className="font-medium">
                          {formatDateTime(r.ts)}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {timeAgo(r.ts)}
                        </div>
                      </Table.Cell>

                      <Table.Cell className="max-w-[220px]">
                        <div className="truncate">{r.actor || "—"}</div>
                      </Table.Cell>

                      <Table.Cell title={r.actor_name || ""}>
                        {r.actor_name || "—"}
                      </Table.Cell>

                      <Table.Cell className="max-w-[200px]">
                        <div
                          className="truncate"
                          title={r.subject_user_name || ""}
                        >
                          {r.subject_user_name || "—"}
                        </div>
                      </Table.Cell>

                      <Table.Cell>
                        <OpBadge op={r.op} />
                      </Table.Cell>

                      <Table.Cell className="max-w-[200px]">
                        <div
                          className="text-xs text-gray-600 font-mono truncate"
                          title={meta.page || ""}
                        >
                          {meta.page || "—"}
                        </div>
                      </Table.Cell>

                      <Table.Cell className="max-w-[420px]">
                        <div className="">
                          {meta.summary || "—"}
                          {isAddressEvent && (
                            <span className="ml-2 text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">
                              Address
                            </span>
                          )}
                          {isDocumentsEvent && (
                            <span className="ml-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">
                              Documents
                            </span>
                          )}
                        </div>
                      </Table.Cell>

                      <Table.Cell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setExpandedId((id) =>
                              id === r.event_id ? null : r.event_id
                            )
                          }
                        >
                          {isDocumentsEvent ? "View" : `${diff.length || 0}`}{" "}
                          {isExpanded ? "▲" : "▼"}
                        </Button>
                      </Table.Cell>
                    </Table.Row>

                    {/* Expanded details row */}
                    {isExpanded && (
                      <Table.Row>
                        <Table.Cell colSpan={8}>
                          <div className="rounded-xl border p-4 bg-white">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                              {/* Changes */}
                              <div className="lg:col-span-2">
                                <Title as="h6" className="mb-2">
                                  {isDocumentsEvent
                                    ? "Details"
                                    : isAddressEvent
                                      ? "Address Changes"
                                      : "Changes"}
                                </Title>

                                {/* Documents – no changes table */}
                                {isDocumentsEvent ? (
                                  <div className="text-xs text-gray-600">
                                    This event relates to{" "}
                                    <strong>Documents</strong>. By design,
                                    field-level diffs are not shown here. Use
                                    the summary above and file history inside
                                    the Documents panel to inspect changes.
                                  </div>
                                ) : isAddressEvent ? (
                                  // Address rendering (prefer array-to-array; fallback to field-level)
                                  (() => {
                                    // 1) Array-to-array format (your diff_json example)
                                    if (addressArrayChange) {
                                      const oldArr = Array.isArray(
                                        addressArrayChange.old
                                      )
                                        ? addressArrayChange.old
                                        : [];
                                      const newArr = Array.isArray(
                                        addressArrayChange.new
                                      )
                                        ? addressArrayChange.new
                                        : [];
                                      return (
                                        <AddressArrayDiffViewer
                                          oldArr={oldArr}
                                          newArr={newArr}
                                        />
                                      );
                                    }

                                    // 2) Field-level fallback: address.0.city etc.
                                    const map = buildAddressDiffMap(diff);
                                    const idxs = Object.keys(map)
                                      .map(Number)
                                      .sort((a, b) => a - b);

                                    if (!idxs.length) {
                                      return (
                                        <div className="text-xs text-gray-500">
                                          No structured address diffs found.
                                        </div>
                                      );
                                    }

                                    return (
                                      <div className="space-y-4">
                                        {idxs.map((idx) => (
                                          <AddressGroupCard
                                            key={idx}
                                            index={idx}
                                            items={map[idx]}
                                          />
                                        ))}
                                      </div>
                                    );
                                  })()
                                ) : diff.length ? (
                                  // Generic diffs
                                  <div className="space-y-3">
                                    {diff.map((d, i) => (
                                      <DiffCard key={i} change={d} />
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-500">
                                    No field-level diff
                                    (insert/replace/delete/custom).
                                  </div>
                                )}
                              </div>

                              {/* Details (meta) */}
                              <div className="lg:col-span-1">
                                <Title as="h6" className="mb-2">
                                  Details
                                </Title>
                                <div className="space-y-2 text-xs">
                                  {meta.ip && (
                                    <div className="flex flex-wrap gap-1 items-center">
                                      <Badge variant="flat">ip</Badge>
                                      <span>{meta.ip}</span>
                                    </div>
                                  )}
                                  {meta.ua && (
                                    <div className="flex flex-wrap gap-1 items-center">
                                      <Badge variant="flat">device</Badge>
                                      <span className="break-words">
                                        {formatUA(meta.ua)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <Table.Row>
                <Table.Cell colSpan={8}>
                  <div className="text-center text-gray-500 py-8">
                    No audit events found with current filters.
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onClearFilters}
                      >
                        Clear filters
                      </Button>
                    </div>
                  </div>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {totalCount > 0 ? (
            <>
              Showing {startItem}-{endItem} of {totalCount} events
              {paginationLoading && <span className="ml-2">(Loading...)</span>}
            </>
          ) : (
            "No events found"
          )}
        </div>

        {/* Pagination Controls */}
        {(totalPages > 1 || totalCount === 0) && (
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500 mr-4">
              Page {currentPage} of {totalPages || 1} (Total: {totalCount})
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevPage}
              disabled={!hasPrevPage || paginationLoading}
            >
              Previous
            </Button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {totalPages > 0 &&
                Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "solid" : "outline"}
                      size="sm"
                      onClick={() => goToPage(pageNum)}
                      disabled={paginationLoading}
                      className="min-w-[32px]"
                    >
                      {pageNum}
                    </Button>
                  );
                })}

              {totalPages > 5 && currentPage < totalPages - 2 && (
                <>
                  <span className="text-gray-400">...</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(totalPages)}
                    disabled={paginationLoading}
                  >
                    {totalPages}
                  </Button>
                </>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={!hasNextPage || paginationLoading}
            >
              Next
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => fetchEvents(currentPage, false)}
          >
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}
