/**
 * Regression cover for the CI failure where `erp-server` never became healthy.
 *
 * `src/index.ts` calls `ensureAuditTable()` during boot. The ClickHouse audit
 * sink is optional and no `clickhouse` service exists in docker-compose.yml, so
 * with `CLICKHOUSE_URL` unset the client fell back to localhost:8123 and the
 * call rejected. Nothing handled that rejection, and Node 20 terminates the
 * process on an unhandled rejection, so the container crash-looped and compose
 * reported `dependency failed to start: container erp-server is unhealthy`.
 *
 * The contract these tests pin down: with no sink configured, the audit paths
 * are no-ops that resolve, never rejections.
 */
describe("audit sink configuration", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  const loadModule = () =>
    require("@/audit/clickhouse") as typeof import("@/audit/clickhouse");

  it("reports the sink as unconfigured when CLICKHOUSE_URL is absent", () => {
    delete process.env.CLICKHOUSE_URL;

    expect(loadModule().isAuditConfigured).toBe(false);
  });

  it("reports the sink as configured when CLICKHOUSE_URL is present", () => {
    process.env.CLICKHOUSE_URL = "http://clickhouse.internal:8123";

    expect(loadModule().isAuditConfigured).toBe(true);
  });

  it("resolves instead of rejecting when no sink is configured", async () => {
    delete process.env.CLICKHOUSE_URL;

    // The assertion is the absence of a rejection: this is exactly what killed
    // the process on boot, since the call site does not await it.
    await expect(loadModule().ensureAuditTable()).resolves.toBeUndefined();
  });

  it("does not attempt a network call when no sink is configured", async () => {
    delete process.env.CLICKHOUSE_URL;

    const mod = loadModule();
    const command = jest.spyOn(mod.ch, "command");

    await mod.ensureAuditTable();

    expect(command).not.toHaveBeenCalled();
  });
});
