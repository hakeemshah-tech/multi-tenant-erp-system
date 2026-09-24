// audit/clickhouse.ts
// import { createClient, type ClickHouseClient } from "@clickhouse/client";

// const {
//   CLICKHOUSE_URL,
//   CLICKHOUSE_USER,
//   CLICKHOUSE_PASSWORD,
//   AUDIT_DB = "default",
//   AUDIT_TABLE = "audit_events",
// } = process.env;

// export const ch: ClickHouseClient = createClient({
//   host: CLICKHOUSE_URL!,
//   username: CLICKHOUSE_USER!,
//   password: CLICKHOUSE_PASSWORD!,
// });

// export const AUDIT_DB_TABLE = `${AUDIT_DB}.${AUDIT_TABLE}`;

// /**
//  * Creates the audit table if it doesn't exist (with all ops),
//  * and performs best-effort migrations if it already exists.
//  */
// export async function ensureAuditTable() {
//   await ch.command({ query: `CREATE DATABASE IF NOT EXISTS ${AUDIT_DB}` });

//   const ddl = `
//     CREATE TABLE IF NOT EXISTS ${AUDIT_DB_TABLE} (
//       event_id String,
//       ts DateTime64(3, 'UTC'),

//       tenant_id   Nullable(String),
//       branch_id   Nullable(String),
//       user_id     Nullable(String),
//       actor       Nullable(String),
//       actor_name  Nullable(String),

//       aggregate_type String,
//       aggregate_id   String,

//       op Enum8(
//         'insert'            = 1,
//         'update'            = 2,
//         'replace'           = 3,
//         'delete'            = 4,
//         'custom'            = 5,
//         'view'              = 6,
//         'login'             = 7,
//         'register'          = 8,
//         'logout'            = 9,
//         'register-tenant'   = 10,
//         'register-employee' = 11
//       ),
//       path   String,
//       source LowCardinality(String),

//       diff_json Nullable(String),
//       meta_json Nullable(String),

//       changed_paths Array(String) MATERIALIZED
//         arrayFilter(
//           x -> x != '',
//           arrayMap(
//             x -> ifNull(JSON_VALUE(x, '$.path'), ''),
//             JSONExtractArrayRaw(coalesce(diff_json, '[]'))
//           )
//         ),

//       INDEX idx_tenant (tenant_id) TYPE set(0) GRANULARITY 1,
//       INDEX idx_agg   (aggregate_type, aggregate_id) TYPE set(0) GRANULARITY 1,
//       INDEX idx_paths (changed_paths) TYPE bloom_filter GRANULARITY 1,
//       INDEX idx_op    (op) TYPE set(0) GRANULARITY 1,
//       INDEX idx_path  (path) TYPE tokenbf_v1(512, 2, 0) GRANULARITY 1
//     )
//     ENGINE = MergeTree
//     PARTITION BY toYYYYMM(ts)
//     ORDER BY (coalesce(tenant_id, ''), aggregate_type, aggregate_id, ts, event_id)
//     TTL toDate(ts) + toIntervalYear(50)
//     SETTINGS index_granularity = 8192
//   `;
//   await ch.command({ query: ddl });

//   await migrateAddOpEnums();
//   await migrateAddIndexes();
// }

// async function migrateAddOpEnums() {
//   try {
//     const rs = await ch.query({
//       query: `
//         SELECT type
//         FROM system.columns
//         WHERE database = {db: String}
//           AND table = {table: String}
//           AND name = 'op'
//         LIMIT 1
//       `,
//       format: "JSONEachRow",
//       query_params: { db: AUDIT_DB, table: AUDIT_TABLE },
//     });
//     const rows = await rs.json<{ type: string }[]>();
//     const type = rows?.[0]?.type || "";

//     const needs: Record<string, boolean> = {
//       view: !type.includes("'view'"),
//       login: !type.includes("'login'"),
//       register: !type.includes("'register'"),
//       logout: !type.includes("'logout'"),
//       "register-tenant": !type.includes("'register-tenant'"),
//       "register-employee": !type.includes("'register-employee'"),
//     };

//     if (!Object.values(needs).some(Boolean)) return;

//     const alter = `
//       ALTER TABLE ${AUDIT_DB_TABLE}
//       MODIFY COLUMN op Enum8(
//         'insert'            = 1,
//         'update'            = 2,
//         'replace'           = 3,
//         'delete'            = 4,
//         'custom'            = 5,
//         'view'              = 6,
//         'login'             = 7,
//         'register'          = 8,
//         'logout'            = 9,
//         'register-tenant'   = 10,
//         'register-employee' = 11
//       )
//     `;
//     await ch.command({ query: alter });
//   } catch (err) {
//     console.error("[audit] enum migration failed:", err);
//   }
// }

// async function migrateAddIndexes() {
//   const addIndexIfMissing = async (
//     indexName: string,
//     indexExpr: string,
//     indexType: string
//   ) => {
//     try {
//       const rs = await ch.query({
//         query: `
//           SELECT name
//           FROM system.data_skipping_indices
//           WHERE database = {db: String}
//             AND table   = {table: String}
//             AND name    = {name: String}
//           LIMIT 1
//         `,
//         format: "JSONEachRow",
//         query_params: { db: AUDIT_DB, table: AUDIT_TABLE, name: indexName },
//       });
//       const rows = await rs.json<{ name: string }[]>();
//       if (rows?.length) return;
//       await ch.command({
//         query: `ALTER TABLE ${AUDIT_DB_TABLE}
//                 ADD INDEX ${indexName} (${indexExpr}) TYPE ${indexType} GRANULARITY 1`,
//       });
//     } catch (err) {
//       console.error(`[audit] add index '${indexName}' failed:`, err);
//     }
//   };

//   await addIndexIfMissing("idx_op", "op", "set(0)");
//   await addIndexIfMissing("idx_path", "path", "tokenbf_v1(512, 2, 0)");
// }

import { randomUUID } from "crypto";
import type { Request } from "express";
import { createClient, type ClickHouseClient } from "@clickhouse/client";

const {
  CLICKHOUSE_URL,
  CLICKHOUSE_USER,
  CLICKHOUSE_PASSWORD,
  AUDIT_DB = "default",
  AUDIT_TABLE = "audit_events",
} = process.env;

/**
 * The ClickHouse audit sink is optional.
 *
 * With CLICKHOUSE_URL unset there is no sink to talk to, and the client would
 * silently fall back to http://localhost:8123 and fail on first use. Every
 * audit path therefore checks this flag and becomes a no-op instead: the API
 * has to boot and serve requests whether or not the audit sink exists.
 */
export const isAuditConfigured = Boolean(CLICKHOUSE_URL);

export const ch: ClickHouseClient = createClient({
  host: CLICKHOUSE_URL || "http://localhost:8123",
  username: CLICKHOUSE_USER,
  password: CLICKHOUSE_PASSWORD,
});

export const AUDIT_DB_TABLE = `${AUDIT_DB}.${AUDIT_TABLE}`;

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
  | "field-change-rejected";

/** Create table + migrate enum/indexes */
export async function ensureAuditTable() {
  if (!isAuditConfigured) {
    console.warn(
      "[audit] CLICKHOUSE_URL is not set; audit sink disabled and no table will be created."
    );
    return;
  }

  await ch.command({ query: `CREATE DATABASE IF NOT EXISTS ${AUDIT_DB}` });

  const ddl = `
    CREATE TABLE IF NOT EXISTS ${AUDIT_DB_TABLE} (
      event_id String,
      ts DateTime64(3, 'UTC'),

      tenant_id   Nullable(String),
      branch_id   Nullable(String),
      user_id     Nullable(String),
      actor       Nullable(String),
      actor_name  Nullable(String),
      subject_user_id   Nullable(String),
      subject_user_name Nullable(String),

      aggregate_type String,
      aggregate_id   String,

      op Enum8(
        'insert'            = 1,
        'update'            = 2,
        'replace'           = 3,
        'delete'            = 4,
        'custom'            = 5,
        'view'              = 6,
        'login'             = 7,
        'register'          = 8,
        'logout'            = 9,
        'register-tenant'   = 10,
        'register-employee' = 11,
        'invitation-sent'   = 12,
        'invitation-accepted' = 13,
        'field-change-requested' = 14,
        'field-change-approved' = 15,
        'field-change-rejected' = 16,
        'document-uploaded' = 17,
        'document-approved' = 18,
        'document-rejected' = 19,
        'document-expired' = 20
      ),
      path   String,
      source LowCardinality(String),

      diff_json Nullable(String),
      meta_json Nullable(String),

      changed_paths Array(String) MATERIALIZED
        arrayFilter(
          x -> x != '',
          arrayMap(
            x -> ifNull(JSON_VALUE(x, '$.path'), ''),
            JSONExtractArrayRaw(coalesce(diff_json, '[]'))
          )
        ),

      INDEX idx_tenant (tenant_id) TYPE set(0) GRANULARITY 1,
      INDEX idx_agg   (aggregate_type, aggregate_id) TYPE set(0) GRANULARITY 1,
      INDEX idx_paths (changed_paths) TYPE bloom_filter GRANULARITY 1,
      INDEX idx_op    (op) TYPE set(0) GRANULARITY 1,
      INDEX idx_path  (path) TYPE tokenbf_v1(512, 2, 0) GRANULARITY 1
    )
    ENGINE = MergeTree
    PARTITION BY toYYYYMM(ts)
    ORDER BY (coalesce(tenant_id, ''), aggregate_type, aggregate_id, ts, event_id)
    TTL toDate(ts) + toIntervalYear(50)
    SETTINGS index_granularity = 8192
  `;
  await ch.command({ query: ddl });

  await migrateAddOpEnums();
  await migrateAddIndexes();
  await migrateAddSubjectFields();
}

async function migrateAddOpEnums() {
  try {
    const rs = await ch.query({
      query: `
        SELECT type
        FROM system.columns
        WHERE database = {db: String}
          AND table = {table: String}
          AND name = 'op'
        LIMIT 1
      `,
      format: "JSONEachRow",
      query_params: { db: AUDIT_DB, table: AUDIT_TABLE },
    });
    const rows = (await rs.json()) as { type: string }[];
    const type = rows && rows.length > 0 ? rows[0].type : "";

    const needs = {
      view: !type.includes("'view'"),
      login: !type.includes("'login'"),
      register: !type.includes("'register'"),
      logout: !type.includes("'logout'"),
      "register-tenant": !type.includes("'register-tenant'"),
      "register-employee": !type.includes("'register-employee'"),
      "invitation-sent": !type.includes("'invitation-sent'"),
      "invitation-accepted": !type.includes("'invitation-accepted'"),
      "field-change-requested": !type.includes("'field-change-requested'"),
      "field-change-approved": !type.includes("'field-change-approved'"),
      "field-change-rejected": !type.includes("'field-change-rejected'"),
      "document-uploaded": !type.includes("'document-uploaded'"),
      "document-approved": !type.includes("'document-approved'"),
      "document-rejected": !type.includes("'document-rejected'"),
      "document-expired": !type.includes("'document-expired'"),
    };

    if (!Object.values(needs).some(Boolean)) return;

    const alter = `
      ALTER TABLE ${AUDIT_DB_TABLE}
      MODIFY COLUMN op Enum8(
        'insert'              = 1,
        'update'              = 2,
        'replace'             = 3,
        'delete'              = 4,
        'custom'              = 5,
        'view'                = 6,
        'login'               = 7,
        'register'            = 8,
        'logout'              = 9,
        'register-tenant'     = 10,
        'register-employee'   = 11,
        'invitation-sent'     = 12,
        'invitation-accepted' = 13,
        'field-change-requested' = 14,
        'field-change-approved' = 15,
        'field-change-rejected' = 16,
        'document-uploaded' = 17,
        'document-approved' = 18,
        'document-rejected' = 19,
        'document-expired' = 20
      )
    `;
    await ch.command({ query: alter });
  } catch (err) {
    console.error("[audit] enum migration failed:", err);
  }
}

async function migrateAddIndexes() {
  const addIndexIfMissing = async (
    indexName: string,
    indexExpr: string,
    indexType: string
  ) => {
    try {
      const rs = await ch.query({
        query: `
          SELECT name
          FROM system.data_skipping_indices
          WHERE database = {db: String}
            AND table   = {table: String}
            AND name    = {name: String}
          LIMIT 1
        `,
        format: "JSONEachRow",
        query_params: { db: AUDIT_DB, table: AUDIT_TABLE, name: indexName },
      });
      const rows = await rs.json<{ name: string }[]>();
      if (rows?.length) return;
      await ch.command({
        query: `ALTER TABLE ${AUDIT_DB_TABLE}
                ADD INDEX ${indexName} (${indexExpr}) TYPE ${indexType} GRANULARITY 1`,
      });
    } catch (err) {
      console.error(`[audit] add index '${indexName}' failed:`, err);
    }
  };

  await addIndexIfMissing("idx_op", "op", "set(0)");
  await addIndexIfMissing("idx_path", "path", "tokenbf_v1(512, 2, 0)");
}

async function migrateAddSubjectFields() {
  try {
    // Check if subject_user_id column exists
    const rs = await ch.query({
      query: `
        SELECT name
        FROM system.columns
        WHERE database = {db: String}
          AND table = {table: String}
          AND name = 'subject_user_id'
        LIMIT 1
      `,
      format: "JSONEachRow",
      query_params: { db: AUDIT_DB, table: AUDIT_TABLE },
    });
    const rows = await rs.json<{ name: string }[]>();

    if (!rows?.length) {
      // Add subject_user_id column
      await ch.command({
        query: `ALTER TABLE ${AUDIT_DB_TABLE} ADD COLUMN subject_user_id Nullable(String)`,
      });
      console.log("[audit] Added subject_user_id column");
    }

    // Check if subject_user_name column exists
    const rs2 = await ch.query({
      query: `
        SELECT name
        FROM system.columns
        WHERE database = {db: String}
          AND table = {table: String}
          AND name = 'subject_user_name'
        LIMIT 1
      `,
      format: "JSONEachRow",
      query_params: { db: AUDIT_DB, table: AUDIT_TABLE },
    });
    const rows2 = await rs2.json<{ name: string }[]>();

    if (!rows2?.length) {
      // Add subject_user_name column
      await ch.command({
        query: `ALTER TABLE ${AUDIT_DB_TABLE} ADD COLUMN subject_user_name Nullable(String)`,
      });
      console.log("[audit] Added subject_user_name column");
    }
  } catch (err) {
    console.error("[audit] subject fields migration failed:", err);
  }
}
