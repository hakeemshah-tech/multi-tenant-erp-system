import { Router } from "express";
import * as branchAwardsController from "./branchAwards.controller";
import * as branchDetailsController from "@/app/branchDetails/branchDetails.controller";
import { validateBody } from "@/common/middlewares/zodMiddleware";
import { asyncHandler } from "@/common/middlewares/asyncHandler";
import { authenticate } from "@/common/middlewares/authMiddleware";
import {
  addBranchAwardSchema,
  updateBranchAwardSchema,
} from "./branchAwards.validation";
import { updateBranchDetailsSchema } from "@/app/branchDetails/branchDetails.validation";
import { checkPermission } from "@/common/middlewares/checkPermission";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: BranchAwards
 *   description: Branch Awards management endpoints
 */

/**
 * @swagger
 * /branches/{branchId}/awards:
 *   get:
 *     summary: Get all awards for a branch
 *     tags: [BranchAwards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
 *     responses:
 *       200:
 *         description: Branch awards fetched successfully
 */
router.get(
  "/:branchId/awards",
  authenticate,
  checkPermission({ section: "industry-awards", action: "read" }),
  asyncHandler(branchAwardsController.getBranchAwards)
);

/**
 * @swagger
 * /branches/{branchId}/awards:
 *   post:
 *     summary: Add an award to a branch
 *     tags: [BranchAwards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - awardId
 *               - awardEmployeeTypeIds
 *             properties:
 *               awardId:
 *                 type: string
 *               awardEmployeeTypeIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Award added to branch successfully
 */
router.post(
  "/:branchId/awards",
  authenticate,
  checkPermission({ section: "industry-awards", action: "write" }),
  validateBody(addBranchAwardSchema),
  asyncHandler(branchAwardsController.addBranchAward)
);

/**
 * @swagger
 * /branches/{branchId}/awards/{awardId}:
 *   put:
 *     summary: Update award employee types for a branch award
 *     tags: [BranchAwards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
 *       - in: path
 *         name: awardId
 *         required: true
 *         schema:
 *           type: string
 *         description: Award ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - awardEmployeeTypeIds
 *             properties:
 *               awardEmployeeTypeIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Branch award updated successfully
 */
router.put(
  "/:branchId/awards/:awardId",
  authenticate,
  checkPermission({ section: "industry-awards", action: "write" }),
  validateBody(updateBranchAwardSchema),
  asyncHandler(branchAwardsController.updateBranchAward)
);

/**
 * @swagger
 * /branches/{branchId}/awards/{awardId}:
 *   delete:
 *     summary: Remove an award from a branch
 *     tags: [BranchAwards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
 *       - in: path
 *         name: awardId
 *         required: true
 *         schema:
 *           type: string
 *         description: Award ID
 *     responses:
 *       200:
 *         description: Award removed from branch successfully
 */
router.delete(
  "/:branchId/awards/:awardId",
  authenticate,
  checkPermission({ section: "industry-awards", action: "delete" }),
  asyncHandler(branchAwardsController.removeBranchAward)
);

/**
 * @swagger
 * /branches/{branchId}/details:
 *   get:
 *     summary: Get branch details
 *     tags: [BranchDetails]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Branch details fetched successfully
 */
router.get(
  "/:branchId/details",
  authenticate,
  checkPermission({ section: "organisation-details", action: "read" }),
  asyncHandler(branchDetailsController.getBranchDetails)
);

/**
 * @swagger
 * /branches/{branchId}/details:
 *   put:
 *     summary: Update branch details
 *     tags: [BranchDetails]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Branch details updated successfully
 */
router.put(
  "/:branchId/details",
  authenticate,
  checkPermission({ section: "organisation-details", action: "write" }),
  validateBody(updateBranchDetailsSchema),
  asyncHandler(branchDetailsController.updateBranchDetails)
);

export default router;
