// File: src/index.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectToMongo, isMongoConnected } from "./database/connection";
import { setupSwagger } from "./config/swagger";
import { errorHandler } from "./common/middlewares/errorHandler";
import { connectRedis, isRedisConnected } from "./config/redis";
import cookieParser from "cookie-parser";
import router from "./core/routes";
import { requestLogger } from "./common/middlewares/requestLogger";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { ensureAuditTable } from "./audit/clickhouse";
import { documentExpiryJobManager } from "./jobs/documentExpiryJob";

dotenv.config();

/**
 * Node 20 terminates the process on an unhandled promise rejection. Several
 * subsystems here are started fire-and-forget, so a single optional dependency
 * being unreachable would otherwise take the whole API down and leave the
 * container in a restart loop that never passes its healthcheck.
 *
 * Rejections are logged loudly and the process keeps serving. An uncaught
 * exception is different: the process state is no longer trustworthy after one,
 * so it exits and lets the orchestrator restart it.
 */
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught exception, exiting:", error);
  process.exit(1);
});

const app = express();
const port = process.env.PORT || 5000;

app.use(helmet()); // Secure headers

// Rate Limiting (100 requests per 15 minutes per IP)
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // Limit each IP to 100 requests per windowMs
//   message: {
//     message: "Too many requests from this IP, please try again later.",
//   },
//   standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
//   legacyHeaders: false, // Disable the `X-RateLimit-*` headers
// });

// app.use(limiter);

{
}

// Allowed origins come from CORS_ORIGIN as a comma-separated list, so adding an
// environment does not require a code change.
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(requestLogger); // Logs every request

// Both of these retry in the background and never exit the process: a datastore
// that is briefly unreachable must not turn a running container into a crash
// loop. Their state is reported by /api/ready.
connectToMongo();
connectRedis();

// The audit sink is optional: a failure here must not stop the API from
// starting, so it is explicitly caught rather than left to bubble up.
ensureAuditTable().catch((error) => {
  console.error("⚠️ Audit table setup failed; continuing without it:", error);
});

// Start document expiry jobs
documentExpiryJobManager.startAllJobs();

/**
 * Liveness. Answers 200 whenever the process is up and the event loop is
 * turning, which is exactly what the container healthcheck and Nginx need to
 * know. It deliberately does not fail on a downed dependency: a cache blip must
 * not make Docker tear down a process that is serving requests correctly.
 */
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    dependencies: {
      mongo: isMongoConnected() ? "up" : "down",
      redis: isRedisConnected() ? "up" : "down",
    },
  });
});

/**
 * Readiness. Reports 503 until both datastores are actually usable, so it can
 * gate a load balancer or a deployment check. Kept separate from liveness on
 * purpose, and not used as the container healthcheck.
 */
app.get("/api/ready", (_req, res) => {
  const mongo = isMongoConnected();
  const redis = isRedisConnected();
  const ready = mongo && redis;

  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not-ready",
    dependencies: {
      mongo: mongo ? "up" : "down",
      redis: redis ? "up" : "down",
    },
  });
});

/**
 * Bind before mounting the application routes.
 *
 * Express happily accepts routes registered after `listen()`, and binding first
 * means the container answers its healthcheck within milliseconds of start. If
 * anything below then throws, it surfaces as a readable error in the logs
 * against a running container, rather than as a process that never bound and a
 * compose failure that says only `container erp-server is unhealthy`.
 */
const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

server.on("error", (error) => {
  console.error("❌ HTTP server error:", error);
});

try {
  app.use("/api", router); // 👈 routes go first
  setupSwagger(app); // 👈 then swagger
  app.use(errorHandler); // 👈 finally error handling middleware
  console.log("✅ Routes mounted; API is ready to serve.");
} catch (error) {
  // Liveness deliberately keeps passing so the container stays up and the stack
  // finishes starting; /api/ready and this log line carry the bad news.
  console.error(
    "❌ Failed to mount API routes. The process stays up so this error is " +
      "reachable, but /api/* will not serve:",
    error
  );
}

/**
 * Stop accepting connections on SIGTERM so `docker compose down` and rolling
 * restarts are clean rather than killed at the timeout.
 */
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down.`);
    server.close(() => process.exit(0));
    // Do not wait forever on lingering keep-alive connections.
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
