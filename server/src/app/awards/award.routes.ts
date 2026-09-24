import { Router } from "express";
import * as awardController from "./award.controller";
import { validateBody } from "@/common/middlewares/zodMiddleware";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { requireAdmin } from "@/common/middlewares/adminMiddleware";
import { createAwardSchema, updateAwardSchema } from "./award.validation";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Awards
 *   description: Award management endpoints (Admin only)
 */

/**
 * @swagger
 * /admin/awards:
 *   post:
 *     summary: Create a new award
 *     tags: [Awards]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               icon:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Award created successfully
 */
router.post(
  "/",
  requireAdmin,
  validateBody(createAwardSchema),
  asyncHandler(awardController.createAward)
);

/**
 * @swagger
 * /admin/awards:
 *   get:
 *     summary: Get all awards
 *     tags: [Awards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Awards fetched successfully
 */
router.get("/", requireAdmin, asyncHandler(awardController.getAwards));

/**
 * @swagger
 * /admin/awards/{id}:
 *   get:
 *     summary: Get award by ID
 *     tags: [Awards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Award fetched successfully
 */
router.get("/:id", requireAdmin, asyncHandler(awardController.getAwardById));

/**
 * @swagger
 * /admin/awards/{id}:
 *   put:
 *     summary: Update award by ID
 *     tags: [Awards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               icon:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Award updated successfully
 */
router.put(
  "/:id",
  requireAdmin,
  validateBody(updateAwardSchema),
  asyncHandler(awardController.updateAward)
);

/**
 * @swagger
 * /admin/awards/{id}:
 *   delete:
 *     summary: Delete award by ID (soft delete)
 *     tags: [Awards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Award deleted successfully
 */
router.delete("/:id", requireAdmin, asyncHandler(awardController.deleteAward));

export default router;
