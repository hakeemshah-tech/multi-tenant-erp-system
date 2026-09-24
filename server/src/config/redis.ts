import dotenv from "dotenv";

import Redis from "ioredis";
import { logger } from "./logger";

dotenv.config();

export const redisClient = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  tls: process.env.REDIS_TLS === "true" ? {} : undefined, // optional

  // Keep reconnecting indefinitely with a capped backoff. Without this the
  // client gives up and every later command fails for the life of the process.
  retryStrategy: (times) => Math.min(times * 200, 5000),
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,

  // Do not dial on construction.
  //
  // `token.service` imports this module, so anything importing the auth
  // middleware transitively constructs this client. With eager connect that
  // opened a socket and started an endless reconnect loop simply by importing a
  // module, which kept Jest workers alive and hung the test job. Connecting is
  // now an explicit act: `connectRedis()` at boot, or the first command issued.
  lazyConnect: true,
});

/** Tracks the last known state so the health endpoint can report it. */
let connected = false;

export const isRedisConnected = () => connected;

redisClient.on("ready", () => {
  connected = true;
  logger.info("🔗 Redis ready");
});

redisClient.on("end", () => {
  connected = false;
});

// Throttled so a sustained outage does not flood the log with one line per
// reconnect attempt, which is what buried the real error previously.
let lastErrorLoggedAt = 0;
redisClient.on("error", (err) => {
  connected = false;
  const now = Date.now();
  if (now - lastErrorLoggedAt > 10_000) {
    lastErrorLoggedAt = now;
    logger.error("❌ Redis connection error:", err);
  }
});

/**
 * Probes Redis once at startup, for a log line and nothing more.
 *
 * This deliberately does NOT exit the process on failure. The HTTP server is
 * already listening by the time a failure would surface, so exiting turned a
 * reachable-but-slow cache into a container that crash-looped and never passed
 * its healthcheck, taking down every dependent service with it. The client
 * reconnects on its own, so the correct behaviour is to log loudly, stay up and
 * recover when Redis returns.
 */
export const connectRedis = async () => {
  // The probe is bounded. `maxRetriesPerRequest: null` plus the offline queue
  // means a command issued while disconnected waits indefinitely rather than
  // rejecting, so an unbounded ping would hang here and never log an outcome.
  const timeout = new Promise<never>((_, reject) => {
    const timer = setTimeout(
      () => reject(new Error("ping timed out after 5000ms")),
      5000
    );
    timer.unref();
  });

  try {
    await Promise.race([redisClient.ping(), timeout]);
    connected = true;
    logger.info("✅ Redis connected");
  } catch (error) {
    connected = false;
    logger.error(
      "❌ Redis unreachable at startup; continuing and retrying in the background:",
      error instanceof Error ? error.message : error
    );
  }
};
