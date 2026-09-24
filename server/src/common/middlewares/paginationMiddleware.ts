// src/common/middlewares/paginationMiddleware.ts

import { Request, Response, NextFunction } from "express";

export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
}

export interface WithPagination extends Request {
  pagination?: PaginationOptions;
}

export const paginationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const paginationDisabled =
    req.query.pagination === "false" || (!req.query.page && !req.query.limit);

  if (paginationDisabled) {
    return next(); // Don’t attach pagination
  }

  let page = parseInt(req.query.page as string) || 1;
  let limit = parseInt(req.query.limit as string) || 20;

  page = page < 1 ? 1 : page;
  limit = limit > 100 ? 100 : limit;

  const skip = (page - 1) * limit;

  (req as WithPagination).pagination = { page, limit, skip };

  next();
};
