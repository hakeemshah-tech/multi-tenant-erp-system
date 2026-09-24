/**
 * Regression cover for the module-level throw in `common/utils/cloudfront.ts`.
 *
 * The module used to validate CLOUDFRONT_* at the top level and throw
 * `CloudFront signing env vars missing` while being required. Those variables
 * are blank by default in local and CI runs, so the first file to import this
 * module would have crashed the process during boot, reproducing the same
 * `container erp-server is unhealthy` failure the audit sink caused.
 *
 * The contract pinned here: importing is always safe, and the assertion fires
 * only when a URL is actually signed.
 */
describe("cloudfront signing", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  const clearConfig = () => {
    delete process.env.CLOUDFRONT_DOMAIN;
    delete process.env.CLOUDFRONT_KEY_PAIR_ID;
    delete process.env.CLOUDFRONT_PRIVATE_KEY_BASE64;
    delete process.env.CLOUDFRONT_PRIVATE_KEY;
  };

  const loadModule = () =>
    require("@/common/utils/cloudfront") as typeof import("@/common/utils/cloudfront");

  it("imports without throwing when nothing is configured", () => {
    clearConfig();

    expect(() => loadModule()).not.toThrow();
  });

  it("reports itself unconfigured when values are absent", () => {
    clearConfig();

    expect(loadModule().isCloudFrontConfigured()).toBe(false);
  });

  it("reports itself unconfigured when values are blank strings", () => {
    // This is the exact shape .env.template ships and CI generates.
    process.env.CLOUDFRONT_DOMAIN = "";
    process.env.CLOUDFRONT_KEY_PAIR_ID = "";
    process.env.CLOUDFRONT_PRIVATE_KEY_BASE64 = "";

    expect(() => loadModule()).not.toThrow();
    expect(loadModule().isCloudFrontConfigured()).toBe(false);
  });

  it("throws only when a URL is actually signed, naming what is missing", () => {
    clearConfig();

    const { signCloudFrontUrlForKey } = loadModule();

    expect(() => signCloudFrontUrlForKey("docs/example.pdf")).toThrow(
      /CloudFront signing is not configured; missing: .*CLOUDFRONT_DOMAIN/
    );
  });
});
