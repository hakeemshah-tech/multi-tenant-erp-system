"use client";

import { useEffect, useState } from "react";
import axiosInstance from "../lib/axios";

type AuditRow = {
  event_id: string;
  ts: string;
  tenant_id?: string | null;
  branch_id?: string | null;
  user_id?: string | null;
  actor?: string | null;
  actor_name?: string | null;
  aggregate_type: string;
  aggregate_id: string;
  op: string;
  path: string;
  source?: string | null;
  diff_json?: string | null;
  meta_json?: string | null;
};

type AuditMeta = {
  summary?: string;
  page?: string;
  [key: string]: any;
};

export default function AuditViewerPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [actorName, setActorName] = useState("");
  const [op, setOp] = useState("");
  const [aggregateType, setAggregateType] = useState("");

  useEffect(() => {
    fetchRows();
  }, []);

  async function fetchRows() {
    const params: Record<string, string> = {};
    if (actorName) params.actor_name = actorName;
    if (op) params.op = op;
    if (aggregateType) params.aggregateType = aggregateType;
    const res = await axiosInstance.get("/audit/events", { params });
    setRows(res.data?.data || []);
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Audit Events</h1>
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-sm mb-1">Actor name contains</label>
          <input
            className="border px-2 py-1 rounded"
            value={actorName}
            onChange={(e) => setActorName(e.target.value)}
            placeholder="e.g. john"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Operation</label>
          <input
            className="border px-2 py-1 rounded"
            value={op}
            onChange={(e) => setOp(e.target.value)}
            placeholder="insert/update/view/login"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Aggregate Type</label>
          <input
            className="border px-2 py-1 rounded"
            value={aggregateType}
            onChange={(e) => setAggregateType(e.target.value)}
            placeholder="User/Employee/Designation"
          />
        </div>
        <button
          onClick={fetchRows}
          className="bg-blue-600 text-white px-3 py-1 rounded"
        >
          Search
        </button>
      </div>
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Time</th>
              <th className="text-left p-2">Op</th>
              <th className="text-left p-2">Aggregate</th>
              <th className="text-left p-2">Actor</th>
              <th className="text-left p-2">Path</th>
              <th className="text-left p-2">Page</th>
              <th className="text-left p-2">Summary</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              let summary = "";
              let page = "";
              try {
                const meta: AuditMeta = r.meta_json
                  ? JSON.parse(r.meta_json)
                  : {};
                summary = meta.summary || "";
                page = meta.page || "";
              } catch {}
              return (
                <tr key={r.event_id} className="border-t">
                  <td className="p-2 whitespace-nowrap">
                    {new Date(
                      r.ts.endsWith("Z") ? r.ts : `${r.ts}Z`
                    ).toLocaleString()}
                  </td>
                  <td className="p-2">{r.op}</td>
                  <td className="p-2">
                    {r.aggregate_type}:{r.aggregate_id}
                  </td>
                  <td className="p-2">{r.actor_name || r.actor || "-"}</td>
                  <td className="p-2">{r.path}</td>
                  <td className="p-2 text-xs text-gray-600 font-mono">
                    {page || "-"}
                  </td>
                  <td className="p-2 max-w-[480px] truncate">{summary}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
