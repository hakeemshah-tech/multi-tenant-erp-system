import { Request, Response } from "express";
import * as adminLoginService from "./adminLogin.service";
import { z } from "zod";

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

/**
 * @desc Admin login endpoint
 * @route POST /auth/admin/login
 */
export const adminLogin = async (req: Request, res: Response) => {
  const parsed = adminLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Validation error",
      errors: parsed.error.errors,
    });
  }

  const result = await adminLoginService.adminLogin(parsed.data, req);

  return res.status(200).json({
    message: "Admin login successful",
    data: result,
  });
};
