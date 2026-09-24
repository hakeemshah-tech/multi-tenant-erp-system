import cron from "node-cron";
import { DocumentStatusService } from "../services/documentStatus.service";
import { documentExpiryService } from "../services/documentExpiry.service";

const documentStatusService = new DocumentStatusService();

/**
 * Enhanced Document Expiry Job Manager
 * Handles both pre-expiry notifications and expiry processing
 */
export class DocumentExpiryJobManager {
  private isRunning = false;

  /**
   * Start all document expiry related jobs
   */
  startAllJobs() {
    this.startPreExpiryJob();
    this.startExpiryJob();
    this.startRetryFailedNotificationsJob();
    console.log("📅 All document expiry jobs scheduled successfully");
  }

  /**
   * Pre-expiry notifications (3 days before expiry)
   * Runs every day at 9:00 AM UTC
   */
  private startPreExpiryJob() {
    cron.schedule(
      "0 9 * * *", // 9:00 AM daily
      async () => {
        if (this.isRunning) {
          console.log("⏭️ Pre-expiry job already running, skipping...");
          return;
        }

        this.isRunning = true;
        const startTime = new Date();

        try {
          console.log("🔄 Starting pre-expiry notification job...");

          const results =
            await documentExpiryService.processPreExpiryNotifications({
              batchSize: 1000,
              maxConcurrency: 5,
            });

          const duration = new Date().getTime() - startTime.getTime();
          console.log(`✅ Pre-expiry job completed in ${duration}ms:`, results);
        } catch (error) {
          console.error("❌ Error in pre-expiry job:", error);
        } finally {
          this.isRunning = false;
        }
      },
      {
        scheduled: true,
        timezone: "UTC",
      }
    );

    console.log(
      "📅 Pre-expiry notification job scheduled to run daily at 9:00 AM UTC"
    );
  }

  /**
   * Expiry processing (mark as expired and send notifications)
   * Runs every day at 2:00 AM UTC
   */
  private startExpiryJob() {
    cron.schedule(
      "0 2 * * *", // 2:00 AM daily
      async () => {
        if (this.isRunning) {
          console.log("⏭️ Expiry job already running, skipping...");
          return;
        }

        this.isRunning = true;
        const startTime = new Date();

        try {
          console.log("🔄 Starting document expiry job...");

          // First, mark expired documents using the existing service
          const modifiedCount =
            await documentStatusService.markExpiredDocuments();
          console.log(`📋 Marked ${modifiedCount} documents as expired`);

          // Then, send expiry notifications
          const results = await documentExpiryService.processExpiredDocuments({
            batchSize: 1000,
            maxConcurrency: 5,
          });

          const duration = new Date().getTime() - startTime.getTime();
          console.log(`✅ Expiry job completed in ${duration}ms:`, results);
        } catch (error) {
          console.error("❌ Error in expiry job:", error);
        } finally {
          this.isRunning = false;
        }
      },
      {
        scheduled: true,
        timezone: "UTC",
      }
    );

    console.log("📅 Document expiry job scheduled to run daily at 2:00 AM UTC");
  }

  /**
   * Retry failed notifications
   * Runs every 6 hours
   */
  private startRetryFailedNotificationsJob() {
    cron.schedule(
      "0 */6 * * *", // Every 6 hours
      async () => {
        try {
          console.log("🔄 Starting retry failed notifications job...");

          // This would retry failed email notifications
          // Implementation depends on your retry strategy
          console.log("✅ Retry failed notifications job completed");
        } catch (error) {
          console.error("❌ Error in retry failed notifications job:", error);
        }
      },
      {
        scheduled: true,
        timezone: "UTC",
      }
    );

    console.log(
      "📅 Retry failed notifications job scheduled to run every 6 hours"
    );
  }

  /**
   * Manual function to process pre-expiry notifications (for testing)
   */
  async processPreExpiryNotificationsManually(
    options: {
      batchSize?: number;
      maxConcurrency?: number;
    } = {}
  ) {
    try {
      console.log("🔄 Manually processing pre-expiry notifications...");
      const results =
        await documentExpiryService.processPreExpiryNotifications(options);
      console.log(`✅ Manually processed pre-expiry notifications:`, results);
      return results;
    } catch (error) {
      console.error(
        "❌ Error manually processing pre-expiry notifications:",
        error
      );
      throw error;
    }
  }

  /**
   * Manual function to process expired documents (for testing)
   */
  async processExpiredDocumentsManually(
    options: {
      batchSize?: number;
      maxConcurrency?: number;
    } = {}
  ) {
    try {
      console.log("🔄 Manually processing expired documents...");
      const results =
        await documentExpiryService.processExpiredDocuments(options);
      console.log(`✅ Manually processed expired documents:`, results);
      return results;
    } catch (error) {
      console.error("❌ Error manually processing expired documents:", error);
      throw error;
    }
  }

  /**
   * Manual function to mark expired documents (legacy compatibility)
   */
  async markExpiredDocumentsManually() {
    try {
      console.log("🔄 Manually marking expired documents...");
      const modifiedCount = await documentStatusService.markExpiredDocuments();
      console.log(`✅ Manually marked ${modifiedCount} documents as expired.`);
      return modifiedCount;
    } catch (error) {
      console.error("❌ Error manually marking expired documents:", error);
      throw error;
    }
  }
}

// Create singleton instance
const documentExpiryJobManager = new DocumentExpiryJobManager();

// Export the manager and legacy functions for backward compatibility
export { documentExpiryJobManager };

/**
 * Legacy function - use documentExpiryJobManager.startAllJobs() instead
 * @deprecated Use documentExpiryJobManager.startAllJobs() instead
 */
export const startDocumentExpiryJob = () => {
  console.warn(
    "⚠️ startDocumentExpiryJob is deprecated. Use documentExpiryJobManager.startAllJobs() instead."
  );
  documentExpiryJobManager.startAllJobs();
};

/**
 * Legacy function - use documentExpiryJobManager.markExpiredDocumentsManually() instead
 * @deprecated Use documentExpiryJobManager.markExpiredDocumentsManually() instead
 */
export const markExpiredDocumentsManually = () => {
  console.warn(
    "⚠️ markExpiredDocumentsManually is deprecated. Use documentExpiryJobManager.markExpiredDocumentsManually() instead."
  );
  return documentExpiryJobManager.markExpiredDocumentsManually();
};
