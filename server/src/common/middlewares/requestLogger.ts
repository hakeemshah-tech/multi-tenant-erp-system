import { logger } from "@/config/logger";
import { Request, Response, NextFunction } from "express";

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { method, originalUrl, ip } = req;
  const userAgent = req.get("user-agent") || "Unknown";

  logger.info(`${method} ${originalUrl} - IP: ${ip} - UA: ${userAgent}`);

  next();
};
