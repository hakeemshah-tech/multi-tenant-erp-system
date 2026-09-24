// src/common/middlewares/zodMiddleware.ts
import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export const validateBody =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        message: "Validation failed",
        errors: result.error.flatten().fieldErrors,
      });
      return; // <- Explicitly return after sending the response
    }

    req.body = result.data;
    next(); // continue to next middleware
  };
