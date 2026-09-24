// src/audit/client.ts
import { createClient } from "@clickhouse/client";

const {
  CLICKHOUSE_URL,
  CLICKHOUSE_USER,
  CLICKHOUSE_PASSWORD,
  AUDIT_DB = "default",
  AUDIT_TABLE = "audit_events",
} = process.env;

export const ch = createClient({
  host: CLICKHOUSE_URL!,
  username: CLICKHOUSE_USER!,
  password: CLICKHOUSE_PASSWORD!,
});

export const AUDIT_DB_TABLE = `${AUDIT_DB}.${AUDIT_TABLE}`;
