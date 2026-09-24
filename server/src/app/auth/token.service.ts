import jwt from "jsonwebtoken";
import { jwtConfig } from "@/config/jwt";
import { redisClient } from "@/config/redis";

export const generateTokens = async (payload: any) => {
  const accessToken = jwt.sign(payload, jwtConfig.accessTokenSecret, {
    expiresIn: jwtConfig.accessTokenExpiresIn as number,
  });

  const refreshToken = jwt.sign(payload, jwtConfig.refreshTokenSecret, {
    expiresIn: jwtConfig.refreshTokenExpiresIn as number,
  });

  // Whitelist refresh token in Redis (key: token, value: userId)
  await redisClient.set(refreshToken, payload.userId, "EX", 7 * 24 * 60 * 60); // 7 days

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, jwtConfig.accessTokenSecret);
};

export const verifyRefreshToken = async (token: string) => {
  const decoded: any = jwt.verify(token, jwtConfig.refreshTokenSecret);

  const stored = await redisClient.get(token);
  if (!stored || stored !== decoded.userId)
    throw new Error("Invalid refresh token");

  return decoded;
};

export const revokeRefreshToken = async (token: string) => {
  await redisClient.del(token);
};
