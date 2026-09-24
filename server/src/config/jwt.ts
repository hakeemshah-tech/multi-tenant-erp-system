export interface JwtConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiresIn: string | number;
  refreshTokenExpiresIn: string | number;
}

/**
 * Reads a signing secret from the environment and refuses to fall back to a
 * default. A hardcoded fallback here would let anyone who has read the source
 * mint valid tokens, so an unset secret is a startup failure rather than a
 * silent downgrade.
 *
 * Both `JWT_ACCESS_SECRET` and the older `JWT_ACCESS_TOKEN_SECRET` spelling are
 * accepted so existing deployments keep booting; `JWT_ACCESS_SECRET` is the
 * documented name.
 */
function requireSecret(primary: string, legacy: string): string {
  const value = process.env[primary] ?? process.env[legacy];

  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing env var: ${primary}. Generate one with \`openssl rand -hex 32\`.`
    );
  }

  if (value.length < 32) {
    throw new Error(
      `${primary} must be at least 32 characters. Generate one with \`openssl rand -hex 32\`.`
    );
  }

  return value;
}

export const jwtConfig: JwtConfig = {
  accessTokenSecret: requireSecret(
    "JWT_ACCESS_SECRET",
    "JWT_ACCESS_TOKEN_SECRET"
  ),
  refreshTokenSecret: requireSecret(
    "JWT_REFRESH_SECRET",
    "JWT_REFRESH_TOKEN_SECRET"
  ),
  accessTokenExpiresIn: "1d",
  refreshTokenExpiresIn: "7d",
};
