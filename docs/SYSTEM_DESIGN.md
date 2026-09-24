# System Design

How Enterprise ERP is put together, and why it is put together that way.

- [1. Shape of the system](#1-shape-of-the-system)
- [2. The modular monolith](#2-the-modular-monolith)
- [3. Multi-tenancy](#3-multi-tenancy)
- [4. Role-Based Access Control](#4-role-based-access-control)
- [5. Docker networking](#5-docker-networking)
- [6. Data layer](#6-data-layer)
- [7. Caching and background work](#7-caching-and-background-work)
- [8. Document handling](#8-document-handling)
- [9. Known limitations](#9-known-limitations)

---

## 1. Shape of the system

Four runtime services plus two datastores:

```
                 ┌───────────────────────────────────────┐
  browser ──────▶│  nginx : 80          (edge network)   │
                 └───────────┬───────────────┬───────────┘
                             │ /             │ /api
                             ▼               ▼
                 ┌───────────────────┐  ┌──────────────────┐
                 │ client            │  │ server           │
                 │ Next.js 15 :3000  │  │ Express 5 :5000  │
                 └───────────────────┘  └────────┬─────────┘
                                                 │  (data network, internal)
                                        ┌────────┴────────┐
                                        ▼                 ▼
                                 ┌─────────────┐   ┌─────────────┐
                                 │ mongo :27017│   │ redis :6379 │
                                 │ replSet rs0 │   │             │
                                 └─────────────┘   └─────────────┘
```

**The frontend is not a static bundle.** Next.js App Router with middleware,
server components and route handlers needs a Node runtime, so `client` is a Node
process running Next's `standalone` output. Nginx is a reverse proxy in front of
it, not a file server for it. Only `/_next/static/*` is treated as cacheable
static content, because those filenames are content-hashed.

Consequence: the browser talks to exactly one origin. `NEXT_PUBLIC_API_BASE_URL`
is `/api`, a relative path, so there is no cross-origin preflight in the default
setup and the internal service addresses never appear in client code.

---

## 2. The modular monolith

One deployable, internally divided by business capability. `server/src/app/`
holds roughly thirty modules (`employee`, `contracts`, `roles`, `departments`,
`documentManagement`, `bulkImport` and so on), each following the same layering:

```
app/<module>/
  <module>.routes.ts        HTTP surface, middleware composition
  <module>.controller.ts    request/response translation
  <module>.service.ts       business rules
  <module>.validation.ts    Zod schemas, applied before the controller
  <module>.types.ts         module-local contracts
```

Shared concerns live outside `app/`: `common/middlewares` (auth, permissions,
pagination, error handling), `database/models` (Mongoose schemas),
`database/repositories`, `services` (email, notifications), `jobs` (cron).

**Why a monolith rather than services.** The domain is densely joined. A contract
approval reads the employee, their designation, their branch, the tenant, the
contract template and the applicable pay rate, and must write several of those
consistently. Across services that becomes a distributed transaction; in one
process against one database it is a single MongoDB transaction. The module
boundaries are already drawn, so extraction stays possible if one capability
develops genuinely different scaling needs.

**What holds the boundaries.** Convention and the directory layout, not
compile-time enforcement. Nothing currently stops a service importing another
module's service directly, and some do. An import-boundary lint rule is the
obvious next step.

---

## 3. Multi-tenancy

Tenancy is **row-level within a shared database**, on two axes:

- `tenantId`: the customer organization
- `branchId`: an operating location within that organization

Nearly every domain collection carries both, and compound indexes lead with
`tenantId` so a tenant's working set stays contiguous.

A user is not bound to one tenant. `activeAssignment` on the authenticated user
names the `{ tenantId, branchId }` pair the current request acts within, which is
what lets one person hold roles at several organizations and switch between them,
the flow behind `/nexus-profile/organizations`.

> **Where the risk sits.** Isolation depends on every query filtering by
> `tenantId`. That is applied per-repository rather than by a global Mongoose
> plugin, so a query written without the filter would silently read across
> tenants. A pre-find hook enforcing it centrally would convert a discipline
> problem into a structural guarantee.

---

## 4. Role-Based Access Control

Authorization resolves in four stages. Each can only narrow what the previous
allowed.

### Stage 1: Authentication

`authMiddleware` verifies the bearer token against `JWT_ACCESS_SECRET` and
attaches the user. Access tokens live 1 day, refresh tokens 7.

> The signing secret is read with no fallback: if it is unset or under 32
> characters the process refuses to start. An earlier revision read a different
> variable name than deployments set, and so signed every token with a default
> string committed to the repository. `src/tests/auth/auth.spec.ts` is a
> regression test against that returning.

### Stage 2: Escalation bypasses

Checked in order, before any database lookup:

| Actor             | Result                          |
| ----------------- | ------------------------------- |
| `isPlatformAdmin` | Full access, all tenants        |
| `tenant-owner`    | Full access within their tenant |
| `admin`           | Full access within their tenant |
| everyone else     | Continue to stage 3             |

### Stage 3: Section and action permission

The unit of permission is a `(section, action)` pair, where action is one of
`read` / `write` / `delete`. `RolePermission` documents are scoped per tenant,
branch and role:

```ts
{
  tenantId, branchId,
  roleId,
  sectionKey: "employees",
  permissions: { read: true, write: false, delete: false },
  dataAccessLevel: 3,
}
```

Routes declare what they need, so the requirement sits next to the handler:

```ts
router.get(
  "/employees",
  authenticate,
  checkPermission({ section: "employees", action: "read" }),
  getEmployees
);
```

A user's roles are aggregated across their assignment; permissions are the union,
and a missing section entry is a denial rather than a default-allow.

### Stage 4: Data access level

Sections listing people apply `dataAccessLevel` on top. `RoleLevel` defines a
numeric hierarchy per tenant and branch (1 = base worker, ascending). A role may
only read employees at or below its own level, which is what stops a team lead
enumerating executive records through an endpoint they legitimately hold `read`
on.

### Deliberate carve-out

An employee with no `activeAssignment` may `read` `organisation-details` and
nothing else. Invitees need to see which organization invited them before
accepting. It is scoped to one section and one action; `user.spec.ts` asserts it
does not extend to writes.

---

## 5. Docker networking

Two networks, and the separation is the security boundary:

| Network | Members               | `internal` | Reachable from host             |
| ------- | --------------------- | ---------- | ------------------------------- |
| `edge`  | nginx, client, server | no         | only via nginx's published port |
| `data`  | server, mongo, redis  | **yes**    | no                              |

`data` is declared `internal: true`, so Docker creates it with no gateway. The
datastores cannot reach the internet and nothing outside the network can reach
them. `server` is the only member of both, making it the sole route to the data.

No database port is published to the host. `make sh-mongo` reaches the shell by
executing _inside_ the container, not by connecting through a mapped port. CI
asserts this rather than trusting it: the pipeline fails if 27017 or 6379 answers
on the host.

Startup order is expressed with `depends_on: condition: service_healthy`, not
sleeps. The API starts only once Mongo reports a live replica set and Redis
answers `PING`; Nginx starts only once both applications are healthy.

---

## 6. Data layer

MongoDB with Mongoose, ~31 collections.

### Transactions require a replica set

The employee propagation flow uses `session.withTransaction(...)` to keep an
employee record and its dependent documents consistent. MongoDB serves
multi-document transactions **only on a replica set**, so the compose file runs
`mongod --replSet rs0` and initiates a single-node set from the healthcheck
probe. A standalone `mongod` accepts every other write and then fails these,
which is why the replica set is not presented as optional.

### Indexing

Compound indexes lead with the tenancy keys, matching how every query filters:

```ts
employeeSchema.index({ tenantId: 1, branchId: 1, isDeleted: 1 });
employeeSchema.index({ designation: 1, tenantId: 1, branchId: 1 });
contractTemplateSchema.index({
  tenantId: 1,
  branchId: 1,
  title: 1,
  version: 1,
});
```

High-volume history collections add a descending time component so the newest
entries are a prefix scan rather than a sort:

```ts
DocumentHistorySchema.index({ tenantId: 1, branchId: 1, createdAt: -1 });
DocumentHistorySchema.index({ documentId: 1, createdAt: -1 });
DocumentHistorySchema.index({ expiryDate: 1, status: 1 });
```

That last one backs the expiry cron: it scans by `expiryDate` filtered on
`status` rather than reading the collection.

### Soft deletes

Domain records carry `isDeleted` and `deletedAt` rather than being removed, which
preserves the audit trail and keeps historical contracts resolvable. `isDeleted`
is part of the leading index keys so filtered reads stay selective.

### Contract snapshots

An approved contract is frozen into a `ContractSnapshot` capturing the employee,
branch and template values as they stood at approval. Later edits to any source
record do not alter an executed contract: the document remains what was agreed.

---

## 7. Caching and background work

**Redis** backs session and token state.

An unreachable Redis is **not** fatal. It used to be: `connectRedis()` called
`process.exit(1)` when its startup ping failed. Because Express is already
listening by then, that turned a container which was answering `/api/health`
correctly into a crash loop, and compose refused to start every dependent
service behind an opaque `container erp-server is unhealthy`. The client now
reconnects with a capped backoff, the startup probe is bounded so it always
reports an outcome, and the same reasoning applies to MongoDB.

Health is therefore split in two:

| Endpoint      | Meaning                                                                                                    | Used by                      |
| ------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `/api/health` | Liveness. 200 whenever the process is serving. Reports dependency state in the body but never fails on it. | Docker healthcheck, Nginx    |
| `/api/ready`  | Readiness. 503 until both Mongo and Redis are connected.                                                   | CI assertion, load balancers |

Gating the container healthcheck on liveness is the point: a cache blip must not
make Docker tear down a process that is handling requests correctly, and a
readable log beats a restart loop.

**Cron jobs** (`node-cron`, in `src/jobs/`) drive document-expiry notification
sweeps. They run in-process, which means each API replica would run its own copy
(fine at one replica), but horizontal scaling needs a leader lock or an external
scheduler first. This is noted again in §9.

---

## 8. Document handling

Uploads take a two-stage path: `multer` receives to a local volume, then objects
move to S3-compatible storage. Reads are served through CloudFront using signed
URLs with a short TTL (`URL_SIGNING_EXPIRES_SECONDS`), so object URLs are not
durable links and cannot be shared beyond their expiry.

Signing is optional. With `CLOUDFRONT_*` unset the module still loads and serves
unsigned: a missing key degrades the feature instead of crashing the service at
import.

Generated contract PDFs (`pdfkit`) and bulk-import spreadsheets (`exceljs`) run
in the API process. Both are memory-resident operations and are the most likely
first source of memory pressure under load.

---

## 9. Known limitations

Stated plainly, because a design document that lists only strengths is not much
use.

| Area                 | Limitation                                                                   | Direction                                                                             |
| -------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Tenant isolation     | Enforced per-query, not globally                                             | Mongoose pre-find plugin asserting `tenantId`                                         |
| Module boundaries    | Convention only                                                              | Import-boundary lint rule                                                             |
| Type safety          | `strict: false`; builds ignore TS and ESLint errors                          | Enable `strict` per module                                                            |
| Test coverage        | Unit tests cover auth config and the RBAC gate only                          | Integration suite against the compose stack                                           |
| Scheduled jobs       | In-process; would duplicate across replicas                                  | Leader election or external scheduler                                                 |
| Audit log            | ClickHouse writer is live but gated off; no sink runs in compose             | Add a `clickhouse` service, or drop the dependency                                    |
| Local datastores     | No auth on Mongo in the compose setup                                        | Acceptable on an `internal` network; production uses managed, authenticated instances |
| Rate limiting        | Only at the Nginx edge for `/api/auth`; the Express limiter is commented out | Re-enable per-route limits in the app                                                 |
| PDF/Excel generation | Synchronous and in-process                                                   | Move to a worker queue                                                                |
