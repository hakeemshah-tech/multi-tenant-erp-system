import { Request, Response } from "express";
import { asyncHandler } from "../../common/middlewares/asyncHandler";
import { documentExpiryJobManager } from "../../jobs/documentExpiryJob";

/**
 * Manual endpoint to test pre-expiry notifications
 */
export const testPreExpiryNotificationsController = asyncHandler(
  async (req: Request, res: Response) => {
    const { batchSize = 100, maxConcurrency = 3 } = req.body;

    try {
      const results =
        await documentExpiryJobManager.processPreExpiryNotificationsManually({
          batchSize,
          maxConcurrency,
        });

      res.status(200).json({
        success: true,
        message: "Pre-expiry notifications processed successfully",
        data: results,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to process pre-expiry notifications",
        error: error.message,
      });
    }
  }
);

/**
 * Manual endpoint to test expired document processing
 */
export const testExpiredDocumentsController = asyncHandler(
  async (req: Request, res: Response) => {
    const { batchSize = 100, maxConcurrency = 3 } = req.body;

    try {
      const results =
        await documentExpiryJobManager.processExpiredDocumentsManually({
          batchSize,
          maxConcurrency,
        });

      res.status(200).json({
        success: true,
        message: "Expired documents processed successfully",
        data: results,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to process expired documents",
        error: error.message,
      });
    }
  }
);

/**
 * Manual endpoint to test legacy expiry marking
 */
export const testMarkExpiredDocumentsController = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const modifiedCount =
        await documentExpiryJobManager.markExpiredDocumentsManually();

      res.status(200).json({
        success: true,
        message: "Documents marked as expired successfully",
        data: { modifiedCount },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to mark documents as expired",
        error: error.message,
      });
    }
  }
);
