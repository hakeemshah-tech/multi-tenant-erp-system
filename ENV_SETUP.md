# Environment Setup

Every environment variable the platform reads, where it is read, and whether the
stack starts without it.

> **Quick start:** `make init` copies `.env.template` to `.env` and generates the
> random secrets. You then fill in object storage and SMTP by hand.

---

## 1. How configuration is layered

There is a **single `.env` at the repository root**. It is consumed twice:

1. **Docker Compose** reads it for variable substitution (`${EDGE_PORT}`,
   `${REDIS_PASSWORD}`, …).
2. **The API container** receives it via `env_file`.

`docker-compose.yml` then _overrides_ the values that must describe the internal
network rather than your laptop: `MONGO_URI`, `REDIS_HOST`, `REDIS_PORT`,
`PORT`, `NODE_ENV`. You do not set those for a containerized run; a compose
override always wins over `env_file`.

The frontend is different. `NEXT_PUBLIC_*` values are **inlined into the browser
bundle at build time**, so they are passed as Docker _build arguments_, not
runtime environment. Changing one requires `make build`, not `make restart`.

> **A `NEXT_PUBLIC_*` variable is readable by anyone who opens the site.** Never
> put a secret behind that prefix.

---

## 2. Required to boot

The API exits on startup if any of these is missing or invalid.

| Variable                | Read by                                     | Notes                                                                                                                                                    |
| ----------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JWT_ACCESS_SECRET`     | `src/config/jwt.ts`                         | Min 32 chars. **No default**: a fallback here would let anyone reading the source forge tokens. Legacy name `JWT_ACCESS_TOKEN_SECRET` is still accepted. |
| `JWT_REFRESH_SECRET`    | `src/config/jwt.ts`                         | Min 32 chars. Legacy name `JWT_REFRESH_TOKEN_SECRET` also accepted.                                                                                      |
| `MONGO_URI`             | `src/database/connection.ts`                | Set by compose. Must address a **replica set** (see §4).                                                                                                 |
| `AWS_REGION`            | `src/common/utils/s3.ts`                    | Validated at import.                                                                                                                                     |
| `AWS_ACCESS_KEY_ID`     | `src/common/utils/s3.ts`                    | Validated at import.                                                                                                                                     |
| `AWS_SECRET_ACCESS_KEY` | `src/common/utils/s3.ts`                    | Validated at import.                                                                                                                                     |
| `S3_BUCKET`             | `src/common/utils/s3.ts`                    | Validated at import.                                                                                                                                     |
| `REDIS_PASSWORD`        | `src/config/redis.ts`, `docker-compose.yml` | Compose refuses to start without it. An unreachable Redis is logged and retried in the background, never fatal.                                          |

> **Running locally without a real S3 bucket?** Placeholder values satisfy the
> import-time check and the API will start. Uploads then fail when called, which
> is the intended trade-off for a demo run.

---

## 3. Runtime and networking

| Variable                | Default                  | Read by                       | Purpose                                                                                                              |
| ----------------------- | ------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`              | `production`             | both                          | Standard Node environment flag.                                                                                      |
| `PORT`                  | `5000`                   | `src/index.ts`                | API listen port inside the container.                                                                                |
| `EDGE_PORT`             | `8080`                   | `docker-compose.yml`          | Host port for the Nginx proxy. The only port published.                                                              |
| `IMAGE_TAG`             | `local`                  | `docker-compose.yml`          | Tag for locally built images.                                                                                        |
| `CORS_ORIGIN`           | `http://localhost:8080`  | `src/index.ts`                | **Comma-separated** allow-list of browser origins.                                                                   |
| `APP_URL`               | `http://localhost:8080`  | email templates               | Base URL used in outbound links.                                                                                     |
| `FRONTEND_URL`          | falls back to `APP_URL`  | `contractApproval.service.ts` | Base URL for contract approval links.                                                                                |
| `INTERNAL_API_BASE_URL` | `http://server:5000/api` | `client/middleware.ts`        | Set by compose. Next middleware runs server-side and reaches the API directly instead of looping back through Nginx. |

---

## 4. Datastores

| Variable         | Default                         | Notes                                                                    |
| ---------------- | ------------------------------- | ------------------------------------------------------------------------ |
| `MONGO_DB`       | `erp_platform`                  | Database name; compose builds the URI from it.                           |
| `MONGO_URI`      | set by compose                  | Outside Docker: `mongodb://localhost:27017/erp_platform?replicaSet=rs0`. |
| `REDIS_HOST`     | `redis` (compose) / `127.0.0.1` |                                                                          |
| `REDIS_PORT`     | `6379`                          |                                                                          |
| `REDIS_PASSWORD` | -                               | Required. Shared by the API and the Redis server's `--requirepass`.      |
| `REDIS_TLS`      | `false`                         | Set `true` for a managed Redis that terminates TLS.                      |

**The replica set is not optional.** The employee propagation flow uses
`session.withTransaction(...)`, and MongoDB serves multi-document transactions
only on a replica set. The compose file runs `mongod --replSet rs0` and
self-initiates it from the healthcheck, so a single node behaves correctly. A
standalone `mongod` will fail those writes at runtime, not at startup.

---

## 5. Authentication and the admin seed

| Variable             | Default                  | Notes                                                                                                                          |
| -------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `JWT_ACCESS_SECRET`  | -                        | Required. Access tokens expire in 1 day.                                                                                       |
| `JWT_REFRESH_SECRET` | -                        | Required. Refresh tokens expire in 7 days.                                                                                     |
| `ADMIN_EMAIL`        | `admin@example.com`      | Used by `npm run seed:admin`.                                                                                                  |
| `ADMIN_NAME`         | `Platform Administrator` |                                                                                                                                |
| `ADMIN_PASSWORD`     | -                        | **Required by the seeder**, min 12 chars. There is no default password; a well-known seeded credential is a standing backdoor. |

Rotating `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` invalidates every issued
token and signs all users out. That is the correct response to a suspected leak.

---

## 6. Object storage and CDN

| Variable                        | Required   | Notes                                                                                                                                                                                                                              |
| ------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AWS_REGION`                    | yes        |                                                                                                                                                                                                                                    |
| `AWS_ACCESS_KEY_ID`             | yes        |                                                                                                                                                                                                                                    |
| `AWS_SECRET_ACCESS_KEY`         | yes        |                                                                                                                                                                                                                                    |
| `S3_BUCKET`                     | yes        | Bucket backing document and contract storage.                                                                                                                                                                                      |
| `UPLOAD_DIR`                    | no         | Local staging directory for uploads. Defaults to `<cwd>/uploads`; the image sets `/app/uploads`, matching the mounted volume and the service user's ownership. Never resolved from `__dirname`, which the bundled build collapses. |
| `CLOUDFRONT_DOMAIN`             | no         | Blank disables signed URLs; objects are served unsigned.                                                                                                                                                                           |
| `CLOUDFRONT_KEY_PAIR_ID`        | no         |                                                                                                                                                                                                                                    |
| `CLOUDFRONT_PRIVATE_KEY_BASE64` | no         | PEM private key with literal `\n` escapes instead of newlines. **Secret.**                                                                                                                                                         |
| `URL_SIGNING_EXPIRES_SECONDS`   | no (`300`) | Signed URL lifetime.                                                                                                                                                                                                               |

---

## 7. Email

| Variable      | Required     | Notes                                                                         |
| ------------- | ------------ | ----------------------------------------------------------------------------- |
| `SMTP_USER`   | for email    | Unset means email logs a warning and sending fails; the rest of the app runs. |
| `SMTP_PASS`   | for email    | Gmail requires an **App Password**, not the account password.                 |
| `SMTP_HOST`   | no           | Leave blank to use the Gmail preset. Set it to use any other provider.        |
| `SMTP_PORT`   | no (`587`)   | Only read when `SMTP_HOST` is set.                                            |
| `SMTP_SECURE` | no (`false`) | `true` for implicit TLS on port 465.                                          |

---

## 8. Optional integrations

| Variable                                                     | Notes                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `STRIPE_SECRET_KEY`                                          | Billing. The module is inactive when unset.                                                                                                                                                                                                                                                |
| `NEXT_PUBLIC_CDN_HOSTNAME`                                   | **Build arg.** Hostname added to the Next.js image allow-list.                                                                                                                                                                                                                             |
| `NEXT_PUBLIC_EXTRA_IMAGE_HOSTS`                              | **Build arg.** Comma-separated extra image hosts.                                                                                                                                                                                                                                          |
| `NEXT_PUBLIC_API_BASE_URL`                                   | **Build arg.** Defaults to `/api` so the browser stays same-origin.                                                                                                                                                                                                                        |
| `CLICKHOUSE_URL` / `CLICKHOUSE_USER` / `CLICKHOUSE_PASSWORD` | Audit log sink. `CLICKHOUSE_URL` is the on/off switch: leave it blank and every audit write becomes a no-op, so the API boots and serves normally with no sink. Set it and audit events are written. There is no `clickhouse` service in `docker-compose.yml`, so it stays off by default. |
| `AUDIT_DB` / `AUDIT_TABLE`                                   | Database and table the audit writer targets. Default `default.audit_events`. Only read when `CLICKHOUSE_URL` is set.                                                                                                                                                                       |

---

## 9. Verifying a configuration

```bash
make init          # writes .env with generated secrets
make up            # start everything
make health        # per-container health state
make logs-server   # watch the API come up
```

A healthy API logs `Connecting to MongoDB at mongo:27017`, `✅ MongoDB connected`
and `✅ Redis connected`. The URI is never logged in full, because it carries
credentials.

Common failures:

| Symptom                                                         | Cause                                                                                                                                                                                                                                  |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Missing env var: JWT_ACCESS_SECRET`                            | Secret unset or under 32 chars. Run `make init`.                                                                                                                                                                                       |
| `REDIS_PASSWORD is required` from compose                       | `.env` missing entirely. Run `make init`.                                                                                                                                                                                              |
| `Missing env var: S3_BUCKET`                                    | Object storage block not filled in.                                                                                                                                                                                                    |
| `/api/ready` returns 503                                        | A datastore is not connected. The body names which one. Liveness (`/api/health`) stays 200, so the container is up and the logs are readable.                                                                                          |
| Transaction errors on employee updates                          | MongoDB is not running as a replica set.                                                                                                                                                                                               |
| `dependency failed to start: container erp-server is unhealthy` | The API crash-looped before it could answer `/api/health`. Run `docker compose logs server` and read the **first** error, not the last. Optional subsystems can no longer cause this, so look for a missing required variable from §2. |

---

## 10. Handling secrets

- `.env` is ignored by `.gitignore` **and** blocked by `.husky/pre-commit`.
- Only `.env.template` is committed, and it contains placeholders only.
- Deployment env files (`env-dev`, `env-prod`) are ignored by name; that
  pattern previously shipped real credentials inside the repository tree.
- Rotate anything that has ever been committed, pasted into a ticket, or shared
  in chat. Removing a secret from the working tree does not invalidate it; only
  rotation does.
