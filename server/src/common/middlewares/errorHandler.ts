import { Request, Response, NextFunction } from "express";
import { logger } from "../../config/logger";
import { AppError } from "../utils/app-error";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode: number = err.statusCode || 500;
  const message: string = err.message || "Internal Server Error";

  if (!(err instanceof AppError)) {
    logger.error(`Unexpected Error: ${message}\n${err.stack}`);
  } else {
    logger.warn(`Handled Error: ${message}`);
  }

  res.status(statusCode).json({
    status: "error",
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
