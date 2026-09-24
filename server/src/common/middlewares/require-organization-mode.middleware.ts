import { Request, Response, NextFunction } from "express";
import { AppError } from "@/common/utils/app-error";
import { WithUser } from "./authMiddleware";

export function requireOrganizationMode(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const user = (req as WithUser).user;
  if (!user) {
    return next(new AppError("Unauthenticated", 401));
  }

  // Allow both organization mode and nexus-profile mode
  // Nexus profiles can access organization features when they have an active assignment
  if (
    user.currentMode !== "organization" &&
    user.currentMode !== "nexus-profile"
  ) {
    return next(
      new AppError(
        "Forbidden: organisation or nexus-profile mode required",
        403
      )
    );
  }

  return next();
}
