/**
 * Suite-wide manual mock for ioredis.
 *
 * Jest applies a manual mock for a node_modules package automatically, so no
 * spec has to remember to call `jest.mock("ioredis")`. That matters because the
 * client is reached transitively rather than directly:
 *
 *   any spec -> checkPermission -> authMiddleware -> token.service -> config/redis
 *
 * A spec testing an authorization rule has no reason to know it is one import
 * away from a network client, and before this mock existed it could construct a
 * real one and start a reconnect loop. Unit tests open no sockets.
 *
 * Integration tests that want a real Redis belong in a separate project with
 * `unmock("ioredis")` and a service container.
 */

export type MockRedisClient = {
  ping: jest.Mock;
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
  expire: jest.Mock;
  quit: jest.Mock;
  disconnect: jest.Mock;
  on: jest.Mock;
  once: jest.Mock;
  status: string;
};

export const createMockRedisClient = (): MockRedisClient => ({
  ping: jest.fn().mockResolvedValue("PONG"),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue("OK"),
  del: jest.fn().mockResolvedValue(0),
  expire: jest.fn().mockResolvedValue(1),
  quit: jest.fn().mockResolvedValue("OK"),
  disconnect: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  status: "ready",
});

const Redis = jest.fn().mockImplementation(() => createMockRedisClient());

export default Redis;
