// src/app/test/test.routes.ts
import { Response, Router } from "express";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import {
  authenticate,
  AuthenticatedRequest,
} from "@/common/middlewares/authMiddleware";

const router = Router();

/**
 * @swagger
 * /protected/test:
 *   post:
 *     summary: Test protected route
 *     tags: [Test]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Access granted
 *         content:
 *           application/json:
 *             example:
 *               message: You are Authenticated
 */

router.post(
  "/test",
  authenticate,
  asyncHandler((req: AuthenticatedRequest, res: Response) => {
    res.status(200).json({
      message: "You are Authenticated",
      user: req.user,
    });
  })
);

export default router;
