import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

export const connectToMongo = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error("❌ Missing env var: MONGO_URI");
    process.exit(1);
  }

  // The URI carries credentials, so only the host is ever logged.
  const safeTarget = (() => {
    try {
      return new URL(uri).host;
    } catch {
      return "(unparseable MONGO_URI)";
    }
  })();

  console.log(`Connecting to MongoDB at ${safeTarget}...`);

  try {
    await mongoose.connect(uri);
    console.log("✅ MongoDB connected");

    // Run migrations after connection
    try {
      const { migrateContractApprovalCollection } =
        await import("@/app/contracts/contractApproval.service");
      await migrateContractApprovalCollection();
    } catch (migrationError) {
      console.warn("⚠️ Migration warning (non-critical):", migrationError);
    }
  } catch (err) {
    // Not fatal, for the same reason as Redis: the HTTP server is already
    // listening, so exiting here produces a crash-looping container that never
    // passes its healthcheck instead of a running one that reports the problem.
    // Mongoose keeps retrying in the background and recovers on its own.
    console.error(
      "❌ MongoDB unreachable at startup; continuing and retrying in the background:",
      err
    );
  }
};

/** Mongoose connection states: 1 = connected. Used by the health endpoint. */
export const isMongoConnected = () => mongoose.connection.readyState === 1;
