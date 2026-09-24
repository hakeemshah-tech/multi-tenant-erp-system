import mongoose from "mongoose";

/**
 * Jest global setup.
 *
 * Tests must never pick up a developer's real `.env`, so the few variables the
 * modules under test require are pinned here to obviously-fake values. Suites
 * that exercise env validation override these explicitly.
 */
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? "test-access-secret-0123456789abcdef0123";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? "test-refresh-secret-0123456789abcdef012";

/**
 * Make an unmocked database call fail instead of hang.
 *
 * Mongoose buffers model operations until a connection is available, and with
 * the default settings that wait has no deadline. A single unmocked query in a
 * suite with no MongoDB therefore stalls the whole run rather than failing a
 * test, and the job dies on a timeout with no summary and nothing for
 * `--detectOpenHandles` to report, because the run never finishes.
 *
 * `bufferCommands: false` turns that silent wait into an immediate
 * "Connection is not open" error naming the model, and the short server
 * selection timeout bounds any connection attempt that is made deliberately.
 *
 * No spec currently touches a model, so this changes nothing today. It is here
 * so that the first one which does fails loudly in seconds instead of
 * reintroducing an undiagnosable hang.
 */
mongoose.set("bufferCommands", false);
mongoose.set("bufferTimeoutMS", 2000);

/** Applied to any connection a test opens, deliberately or otherwise. */
mongoose.set("maxTimeMS", 2000);

export {};
