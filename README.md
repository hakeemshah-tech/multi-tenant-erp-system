# Enterprise ERP

A containerized, multi-tenant ERP platform for workforce and contract
administration: employee records, organizational structure, contract lifecycle
and approvals, document management with expiry tracking, and a configurable
role-based permission model.

Built as a **modular monolith** on the MERN stack and shipped as a
**Docker-first** environment: five services, two isolated networks, one command
to bring the whole thing up.

```bash
make init && make up      #  →  http://localhost:8080
```

| | |
| --- | --- |
| **Backend** | Node.js 20 · Express 5 · TypeScript · Mongoose |
| **Frontend** | Next.js 15 (App Router) · React 19 · Redux Toolkit · Tailwind |
| **Data** | MongoDB 7 (replica set) · Redis 7 |
| **Edge** | Nginx reverse proxy |
| **Orchestration** | Docker Compose · Make · GitHub Actions |

---

## Contents

- [Project overview](#project-overview)
- [System architecture](#system-architecture)
- [Database design](#database-design)
- [Local setup](#local-setup)
- [Make targets](#make-targets)
- [Project layout](#project-layout)
- [Configuration](#configuration)
- [CI/CD](#cicd)
- [Security posture](#security-posture)
- [Further reading](#further-reading)

---

## Project overview

The platform serves multiple customer organizations from one deployment.
Tenancy is row-level on two axes: `tenantId` (the organization) and `branchId`
(an operating location within it), and a single user account can hold roles at
several organizations, switching the active assignment between them.

Functional modules, roughly thirty in `server/src/app/`:

| Domain | Capabilities |
| --- | --- |
| **Identity** | Registration, email verification, OTP, refresh-token sessions, invitations |
| **Organization** | Tenants, branches, departments, designations, business structures, industry taxonomy |
| **Workforce** | Employee records, configurable profile schemas, field-level change requests with approval |
| **Contracts** | Templates with versioning, approval chains, immutable signed snapshots, PDF generation |
| **Documents** | Upload, versioned history, expiry tracking, scheduled notifications |
| **Access control** | Roles, role levels, per-section permissions, data-access tiers |
| **Compensation** | Award classifications, employee types, hourly rate tables |
| **Operations** | Bulk spreadsheet import, audit trail, in-app notifications |

---

## System architecture

```
                    ┌────────────────────────────────────────────┐
    browser ───────▶│  nginx : 80        ← only published port   │
                    │  ─────────────────────────────────────────  │
                    │  /            → client                      │
                    │  /api         → server                      │
                    │  /_next/static → client (immutable cache)   │
                    └──────────┬──────────────────┬───────────────┘
                               │                  │
              ═══════════════ edge network ═══════════════════
                               │                  │
                    ┌──────────▼────────┐  ┌──────▼──────────────┐
                    │ client            │  │ server              │
                    │ Next.js 15 :3000  │  │ Express 5 :5000     │
                    │ standalone output │  │ modular monolith    │
                    └───────────────────┘  └──────┬──────────────┘
                                                  │
              ══════ data network (internal: true) ══════
                                                  │
                              ┌───────────────────┴──────────────┐
                              ▼                                  ▼
                    ┌───────────────────┐            ┌────────────────────┐
                    │ mongo :27017      │            │ redis :6379        │
                    │ replica set rs0   │            │ sessions & cache   │
                    └───────────────────┘            └────────────────────┘
```

**Single origin.** Nginx terminates all browser traffic and proxies by path, so
the frontend calls the API at the relative path `/api`. No CORS preflight in the
default setup, and no internal service address ever reaches client code.

**The frontend runs Node, not Nginx.** Next.js App Router uses middleware and
server components, so it cannot be served as static files. The `client` image
ships Next's `standalone` output (a traced, minimal server bundle) and Nginx
sits in front as a reverse proxy. Only `/_next/static/*` is handled as cacheable
static content, since those filenames are content-hashed.

**Network isolation is enforced, not documented.** The `data` network is
declared `internal: true`, so Docker gives it no gateway: MongoDB and Redis
cannot reach the internet and nothing outside that network can reach them. The
API service is the only member of both networks and therefore the only path to
the data. CI asserts this by failing if 27017 or 6379 answers on the host.

**Startup is ordered by health, not by sleeps.** `depends_on` conditions mean the
API starts only after Mongo reports a live replica set and Redis answers `PING`;
Nginx starts only after both applications are healthy.

For the modular-monolith rationale, the four-stage RBAC resolution and the
tenancy model, see **[docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md)**.

---

## Database design

MongoDB with Mongoose, ~31 collections.

### Relations

Mongoose `ObjectId` references with explicit population rather than embedding,
because most entities are queried independently:

```
Tenant ──┬──▶ Branch ──┬──▶ Department ──▶ Designation
         │             ├──▶ RoleLevel ───▶ Role ──▶ RolePermission
         │             └──▶ Employee ────▶ EmployeeProfile
         │                      │
         │                      ├──▶ EmployeeFieldChangeRequest
         │                      └──▶ DocumentHistory ──▶ DocumentExpiryNotification
         │
         └──▶ ContractTemplate ──▶ ContractApproval ──▶ ContractSnapshot
                                                              ▲
Award ──▶ AwardEmployeeType ──▶ HourlyRateManagement ──────────┘
```

Nearly every domain collection carries `tenantId` and `branchId`, which is what
makes row-level tenancy work in a shared database.

### Transaction integrity

Employee propagation (where one change fans out to dependent records) runs in a
MongoDB transaction via `session.withTransaction(...)`, so the fan-out either
lands completely or not at all.

> **This is why the compose file runs a replica set.** MongoDB serves
> multi-document transactions only on a replica set; a standalone `mongod`
> accepts every other write and then fails exactly these. The stack runs
> `mongod --replSet rs0` and self-initiates a single-node set from the
> healthcheck probe, so transactions work locally with no manual step.

Contract integrity uses a different mechanism. On approval, a contract is frozen
into a **`ContractSnapshot`** holding the employee, branch and template values as
they stood at that moment. Later edits to any source record cannot alter an
executed contract.

Destructive operations are **soft deletes** (`isDeleted` and `deletedAt` rather
than removal), preserving the audit trail and keeping historical contracts
resolvable.

### Compound indexing

Index keys lead with the tenancy fields, matching how every query filters, so
each tenant's working set stays contiguous:

```ts
employeeSchema.index({ tenantId: 1, branchId: 1, isDeleted: 1 });
employeeSchema.index({ employeeProfile: 1, tenantId: 1, branchId: 1, isDeleted: 1 });
contractTemplateSchema.index({ tenantId: 1, branchId: 1, title: 1, version: 1 });
```

High-volume history collections append a **descending** time key, turning
"newest first" into an index prefix scan instead of an in-memory sort:

```ts
DocumentHistorySchema.index({ tenantId: 1, branchId: 1, createdAt: -1 });
DocumentHistorySchema.index({ documentId: 1, createdAt: -1 });
DocumentHistorySchema.index({ changeType: 1, status: 1, createdAt: -1 });
DocumentHistorySchema.index({ expiryDate: 1, status: 1 });
```

That last index backs the expiry notification cron, which seeks by `expiryDate`
filtered on `status` rather than scanning the collection.

Including `isDeleted` in the leading keys keeps soft-delete-filtered reads
selective: without it, every query would scan tombstoned rows.

---

## Local setup

### Prerequisites

- **Docker Engine** with the Compose v2 plugin
- **GNU Make** and a POSIX shell (on Windows use Git Bash or WSL)
- ~4 GB free disk for images and volumes

Node.js is *not* required on the host to run the stack.

### Start

```bash
# 1. Generate .env with freshly randomized secrets
make init

# 2. Build images and start all five services
make up

# 3. Watch it come up
make logs
```

`make init` generates `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`REDIS_PASSWORD` and `ADMIN_PASSWORD` with `openssl`. It never overwrites an
existing `.env`.

| Endpoint | URL |
| --- | --- |
| Application | http://localhost:8080 |
| API | http://localhost:8080/api |
| API docs (Swagger) | http://localhost:8080/api-docs |
| Proxy health | http://localhost:8080/healthz |
| API liveness | http://localhost:8080/api/health |
| API readiness | http://localhost:8080/api/ready |

`/api/health` answers 200 whenever the process is serving and reports datastore
state in the body. `/api/ready` returns 503 until Mongo and Redis are both
connected. The container healthcheck deliberately uses liveness, so a cache blip
cannot make Docker tear down a working process.

To use a different host port, set `EDGE_PORT` in `.env`.

### If you don't have `make`

`make` is not installed by default on Windows. Either install it:

```bash
winget install GnuWin32.Make      # or: choco install make
```

Or run the underlying commands directly:

| Instead of | Run |
| --- | --- |
| `make init` | `cp .env.template .env` then fill in the secrets by hand |
| `make build` | `docker compose build` |
| `make up` | `docker compose up -d` |
| `make down` | `docker compose down --remove-orphans` |
| `make logs` | `docker compose logs -f --tail=100` |
| `make ps` | `docker compose ps` |
| `make sh-server` | `docker compose exec server sh` |
| `make clean` | `docker compose down --volumes --remove-orphans` |

Without `make init` you must set `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`REDIS_PASSWORD` and `ADMIN_PASSWORD` yourself. Generate each with
`openssl rand -hex 32`; the API refuses to start on a JWT secret shorter than 32
characters, and Compose refuses to start without `REDIS_PASSWORD`.

### Object storage

`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `S3_BUCKET` are
validated when the storage module loads, so the API will not boot without them.
Placeholder values are enough to start the stack; file uploads then fail at call
time. Supply real values to exercise document features.

### Stop

```bash
make down     # stop, keep database volumes
make clean    # stop and delete volumes (destroys local data)
```

### Without Docker

Supported as a fallback only. It needs MongoDB **running as a replica set** and
Redis already available on the host:

```bash
npm run install:all
cp .env.template .env      # then fill in every value by hand
npm run dev                # concurrently runs server + client
```

---

## Make targets

```
make help                   list every target

make init                   create .env with generated secrets
make build                  build all images
make rebuild                rebuild ignoring the layer cache

make up                     start the stack
make down                   stop it, keeping volumes
make restart                restart every service

make logs                   follow all logs
make logs-server            backend only
make logs-client            frontend only
make ps / make health       container status

make sh-server              shell into the API container
make sh-client              shell into the frontend container
make sh-mongo               mongosh session (executed inside the container)

make test                   backend unit tests
make lint                   lint both codebases
make typecheck              type-check the backend

make clean                  down + delete volumes
make nuke                   clean + remove built images
```

---

## Project layout

```
.
├── client/                    Next.js 15 frontend
│   ├── app/                   App Router: routes, components, store, services
│   ├── lib/
│   ├── middleware.ts          server-side auth/role routing
│   └── Dockerfile             3-stage → standalone output
│
├── server/                    Express 5 API
│   ├── src/
│   │   ├── app/               ~30 business modules
│   │   │   └── <module>/      routes · controller · service · validation · types
│   │   ├── common/middlewares auth, permissions, pagination, errors
│   │   ├── database/
│   │   │   ├── models/        31 Mongoose schemas
│   │   │   ├── repositories/
│   │   │   └── seeders/
│   │   ├── services/          email, notifications
│   │   ├── jobs/              node-cron schedules
│   │   └── tests/             Jest unit suites
│   └── Dockerfile             4-stage → dist + prod deps only
│
├── nginx/conf.d/              reverse proxy configuration
├── docs/SYSTEM_DESIGN.md      architecture deep dive
├── .github/workflows/         CI pipeline
├── .husky/pre-commit          secret and format gate
│
├── docker-compose.yml         service + network topology
├── Makefile                   developer control plane
├── .env.template              every variable, placeholder values
└── ENV_SETUP.md               configuration reference
```

---

## Configuration

One `.env` at the repository root, consumed twice: by Compose for substitution,
and by the API container via `env_file`. Compose overrides the values that must
describe the internal network (`MONGO_URI`, `REDIS_HOST`, `PORT`), so you do not
set those for a containerized run.

`NEXT_PUBLIC_*` values are **build arguments**: inlined into the browser bundle
at build time and public by definition. Changing one needs `make build`, not
`make restart`. Never put a secret behind that prefix.

Every variable is documented in **[ENV_SETUP.md](ENV_SETUP.md)**, including which
file reads it and whether the stack starts without it.

---

## CI/CD

`.github/workflows/erp-deployment-pipeline.yml` runs on every push:

| Job | What it does |
| --- | --- |
| **lint** | ESLint across `server` and `client` (matrix) |
| **test** | Backend Jest suites: JWT secret validation and the RBAC permission gate |
| **secret-scan** | Fails on committed env/key files or credential-shaped strings |
| **build** | Builds both images, **starts the full stack**, waits for every healthcheck, smoke-tests through the proxy, and asserts the datastore ports are not reachable from the host |

The `build` job is the gate that matters: an image that builds but exits on boot
is a broken deploy, so the pipeline runs the stack rather than trusting the
build.

Locally, `.husky/pre-commit` blocks any commit that stages an `.env`, a
deployment env file or raw key material, scans staged content for AWS keys,
private key blocks, Stripe secrets and database URIs with inline passwords, then
formats staged files with Prettier.

---

## Security posture

Implemented:

- Datastores on an `internal` Docker network with no host port mapping
- Helmet security headers; rate limiting on `/api/auth` at the edge
- bcrypt password hashing; short-lived access tokens with refresh rotation
- Four-stage RBAC with a numeric data-access hierarchy (see the design doc)
- JWT secrets validated at startup, with **no fallback default**
- Signed, short-TTL CDN URLs for stored documents
- Containers run as a non-root user; images carry no dev dependencies
- Secrets blocked at three layers: `.gitignore`, pre-commit hook, CI scan

Known gaps are listed honestly in
[docs/SYSTEM_DESIGN.md §9](docs/SYSTEM_DESIGN.md#9-known-limitations):
per-query tenant filtering rather than a global guard, `strict: false`
TypeScript, unit tests covering only auth and RBAC, and in-process cron that
would duplicate across replicas.

---

## Further reading

| Document | Contents |
| --- | --- |
| [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) | Modular monolith, tenancy, RBAC, Docker networking, data layer, limitations |
| [ENV_SETUP.md](ENV_SETUP.md) | Every environment variable, with defaults and failure modes |

---

## 🔐 Governance & NDA Compliance

This repository represents a sanitized, standalone snapshot of a production-grade enterprise application. 

To strictly comply with Non-Disclosure Agreements (NDA) and corporate security policies, the original Git history, proprietary business logic, client-specific configurations, and infrastructure-as-code (IaC) pipelines have been completely stripped from this public release. 

As a result, this repository is published as a single-commit snapshot for portfolio demonstration purposes. It highlights architectural decisions, component structure, state management, and API design patterns while protecting the intellectual property of the original stakeholders.
