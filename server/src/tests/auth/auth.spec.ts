import jwt from "jsonwebtoken";

/**
 * Regression cover for the token-signing configuration.
 *
 * An earlier revision read `JWT_ACCESS_TOKEN_SECRET` while deployments set
 * `JWT_ACCESS_SECRET`, so the module silently fell back to the literal
 * "access-secret" and every environment signed tokens with a value published in
 * the source tree. These tests fail if a fallback is ever reintroduced.
 */
describe("jwt configuration", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  const loadConfig = () =>
    // Imported lazily so each case sees the env it just set.
    require("@/config/jwt") as typeof import("@/config/jwt");

  it("reads secrets from the environment", () => {
    process.env.JWT_ACCESS_SECRET = "a".repeat(40);
    process.env.JWT_REFRESH_SECRET = "b".repeat(40);

    const { jwtConfig } = loadConfig();

    expect(jwtConfig.accessTokenSecret).toBe("a".repeat(40));
    expect(jwtConfig.refreshTokenSecret).toBe("b".repeat(40));
  });

  it("accepts the legacy *_TOKEN_SECRET spelling", () => {
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    process.env.JWT_ACCESS_TOKEN_SECRET = "c".repeat(40);
    process.env.JWT_REFRESH_TOKEN_SECRET = "d".repeat(40);

    const { jwtConfig } = loadConfig();

    expect(jwtConfig.accessTokenSecret).toBe("c".repeat(40));
  });

  it("refuses to start when a secret is missing", () => {
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_ACCESS_TOKEN_SECRET;
    process.env.JWT_REFRESH_SECRET = "b".repeat(40);

    expect(loadConfig).toThrow(/JWT_ACCESS_SECRET/);
  });

  it("rejects a secret short enough to brute force", () => {
    process.env.JWT_ACCESS_SECRET = "short";
    process.env.JWT_REFRESH_SECRET = "b".repeat(40);

    expect(loadConfig).toThrow(/at least 32 characters/);
  });

  it("never falls back to a hardcoded secret", () => {
    process.env.JWT_ACCESS_SECRET = "a".repeat(40);
    process.env.JWT_REFRESH_SECRET = "b".repeat(40);

    const { jwtConfig } = loadConfig();

    expect(jwtConfig.accessTokenSecret).not.toBe("access-secret");
    expect(jwtConfig.refreshTokenSecret).not.toBe("refresh-secret");
  });
});

describe("token round trip", () => {
  it("issues a token that verifies with the configured secret and not another", () => {
    process.env.JWT_ACCESS_SECRET = "e".repeat(40);
    process.env.JWT_REFRESH_SECRET = "f".repeat(40);
    jest.resetModules();

    const { jwtConfig } =
      require("@/config/jwt") as typeof import("@/config/jwt");

    const token = jwt.sign(
      { sub: "user-1" },
      jwtConfig.accessTokenSecret as string,
      {
        expiresIn: "5m",
      }
    );

    const decoded = jwt.verify(
      token,
      jwtConfig.accessTokenSecret as string
    ) as {
      sub: string;
    };
    expect(decoded.sub).toBe("user-1");

    expect(() => jwt.verify(token, "access-secret")).toThrow();
  });
});
