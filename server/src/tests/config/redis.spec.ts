/**
 * Regression cover for the CI failure `container erp-server is unhealthy`.
 *
 * `connectRedis()` used to call `process.exit(1)` when its startup ping failed.
 * Express is already listening by then, so the exit turned a container that was
 * serving `/api/health` correctly into a crash loop, and compose refused to
 * start every dependent service.
 *
 * ioredis is mocked here rather than pointed at a closed port. An earlier
 * version of this file connected to 127.0.0.1:6399 to force a refusal, which
 * worked but left a real client retrying on an exponential backoff for the
 * lifetime of the suite. That kept handles open, stalled the runner and timed
 * the CI job out at 15 minutes. A unit test has no business opening a socket:
 * the behaviour under test is what `connectRedis` does with a rejected ping,
 * not whether TCP works.
 */

// No `jest.mock("ioredis")` call is needed: the `^ioredis$` moduleNameMapper
// entry in jest.config.js points every import at the test double. This spec
// steers that double's behaviour and tears it down afterwards.
import type { MockRedisClient } from "../../../__mocks__/ioredis";

describe("redis startup probe", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Tear the client down after every test, not just at the end of the suite.
   *
   * `beforeEach` resets the module registry, so each test constructs its own
   * client; a suite-level teardown would only ever reach the last one. Against
   * the test double these calls are no-ops, but they are what makes the suite
   * safe if the client is ever a real one again: `quit()` closes the connection
   * gracefully, and `disconnect()` destroys the socket and cancels any pending
   * reconnect timer, which is the handle that previously kept Node alive.
   */
  afterEach(async () => {
    const registered = loadedClients.splice(0, loadedClients.length);

    for (const client of registered) {
      try {
        await client.quit?.();
      } catch {
        // A client that never connected rejects quit(); disconnect() still
        // needs to run, so the failure is deliberately ignored.
      }
      client.disconnect?.();
    }
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  /** Clients built during a test, torn down in afterEach. */
  const loadedClients: MockRedisClient[] = [];

  /** Loads the module under test and hands back its mocked client. */
  const load = () => {
    const RedisCtor = require("ioredis").default as jest.Mock;

    // Fail loudly rather than hang. If `ioredis` ever resolves to the real
    // package, the client below opens a socket and starts a reconnect loop that
    // keeps Node alive, and the job dies on a timeout with nothing to read. An
    // assertion here names the cause instead.
    if (!jest.isMockFunction(RedisCtor)) {
      throw new Error(
        "ioredis resolved to the real package, not the test double. Check the " +
          "'^ioredis$' moduleNameMapper entry in jest.config.js; a real client " +
          "will hang the suite."
      );
    }

    RedisCtor.mockClear();

    const mod = require("@/config/redis") as typeof import("@/config/redis");
    const client = RedisCtor.mock.results[0].value as MockRedisClient;

    loadedClients.push(client);

    return { mod, client, RedisCtor };
  };

  it("opens no real connection: the client is constructed through ioredis", () => {
    const { RedisCtor } = load();

    expect(RedisCtor).toHaveBeenCalledTimes(1);
  });

  it("resolves rather than exiting when the ping is refused", async () => {
    const { mod, client } = load();
    client.ping.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const exitSpy = jest
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);

    try {
      await expect(mod.connectRedis()).resolves.toBeUndefined();
      expect(exitSpy).not.toHaveBeenCalled();
      expect(mod.isRedisConnected()).toBe(false);
    } finally {
      exitSpy.mockRestore();
    }
  });

  it("marks the connection up when the ping succeeds", async () => {
    const { mod, client } = load();
    client.ping.mockResolvedValue("PONG");

    await mod.connectRedis();

    expect(mod.isRedisConnected()).toBe(true);
  });

  it("bounds the probe when the ping never settles", async () => {
    jest.useFakeTimers();

    const { mod, client } = load();
    // Mirrors `maxRetriesPerRequest: null` plus the offline queue, where a
    // command issued while disconnected waits forever instead of rejecting.
    client.ping.mockReturnValue(new Promise(() => {}));

    const exitSpy = jest
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);

    try {
      const pending = mod.connectRedis();
      await jest.advanceTimersByTimeAsync(5000);

      await expect(pending).resolves.toBeUndefined();
      expect(mod.isRedisConnected()).toBe(false);
      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
    }
  });

  it("registers reconnect handlers so an outage recovers on its own", () => {
    const { client } = load();

    const events = client.on.mock.calls.map(([event]) => event);
    expect(events).toEqual(expect.arrayContaining(["ready", "end", "error"]));
  });
});
