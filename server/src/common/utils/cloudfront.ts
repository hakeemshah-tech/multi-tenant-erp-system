// common/utils/cloudfront.ts
import { getSignedUrl } from "@aws-sdk/cloudfront-signer";

/**
 * CloudFront URL signing is optional, so nothing here runs at import time.
 *
 * This module previously validated its environment at the top level and threw
 * `CloudFront signing env vars missing` while being required. Any file that
 * imported it would then take the whole process down during boot whenever the
 * CLOUDFRONT_* variables were blank, which is the default in local and CI runs.
 * The assertion now happens when a URL is actually signed, so a missing key
 * fails the one request that needs it instead of the entire service.
 */

const DEFAULT_EXPIRES_SECONDS = 10;

function readConfig() {
  const domain = process.env.CLOUDFRONT_DOMAIN;
  const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID;

  // Accept either a base64 blob or a raw PEM with escaped newlines.
  const pkBase64 = process.env.CLOUDFRONT_PRIVATE_KEY_BASE64;
  const pkRaw = process.env.CLOUDFRONT_PRIVATE_KEY;
  const privateKey = pkBase64
    ? Buffer.from(pkBase64, "base64").toString("utf8")
    : (pkRaw || "").replace(/\\n/g, "\n");

  return { domain, keyPairId, privateKey };
}

/** True when every value needed to sign a URL is present. */
export function isCloudFrontConfigured(): boolean {
  const { domain, keyPairId, privateKey } = readConfig();
  return Boolean(domain && keyPairId && privateKey);
}

function defaultExpiresSeconds(): number {
  const parsed = parseInt(
    process.env.URL_SIGNING_EXPIRES_SECONDS || String(DEFAULT_EXPIRES_SECONDS),
    10
  );
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_EXPIRES_SECONDS;
}

export function signCloudFrontUrlForKey(key: string, expiresSeconds?: number) {
  const { domain, keyPairId, privateKey } = readConfig();

  if (!domain || !keyPairId || !privateKey) {
    const missing = [
      !domain && "CLOUDFRONT_DOMAIN",
      !keyPairId && "CLOUDFRONT_KEY_PAIR_ID",
      !privateKey &&
        "CLOUDFRONT_PRIVATE_KEY_BASE64 (or CLOUDFRONT_PRIVATE_KEY)",
    ].filter(Boolean);

    throw new Error(
      `CloudFront signing is not configured; missing: ${missing.join(", ")}`
    );
  }

  const seconds = expiresSeconds ?? defaultExpiresSeconds();

  // The public URL that the client will hit:
  const url = `https://${domain}/${key}`;
  const expiresAt = new Date(Date.now() + Math.max(1, seconds) * 1000);

  return getSignedUrl({
    url,
    dateLessThan: expiresAt.toISOString(),
    keyPairId,
    privateKey,
  });
}
