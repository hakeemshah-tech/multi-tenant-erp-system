import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { User } from "../models/user.model";
import { connectToMongo } from "../connection";
import mongoose from "mongoose";

/**
 * Seed platform admin user
 * Run this seeder to create the initial platform admin
 */
export const seedAdmin = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ isPlatformAdmin: true });
    if (existingAdmin) {
      console.log("✅ Platform admin already exists:", existingAdmin.email);
      return existingAdmin;
    }

    // Seed credentials are supplied by the operator. There is deliberately no
    // default password: a well-known seeded password is a standing backdoor on
    // any environment where the seeder is run and the account is not rotated.
    const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
    const adminFullName = process.env.ADMIN_NAME || "Platform Administrator";
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword || adminPassword.length < 12) {
      throw new Error(
        "ADMIN_PASSWORD must be set to at least 12 characters before seeding the platform admin."
      );
    }

    // Check if user with this email exists
    const existingUser = await User.findOne({ email: adminEmail });
    if (existingUser) {
      // Update existing user to be platform admin
      existingUser.isPlatformAdmin = true;
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      existingUser.passwordHash = passwordHash;
      await existingUser.save();
      console.log("✅ Updated existing user to platform admin:", adminEmail);
      return existingUser;
    }

    // Create new admin user
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const admin = await User.create({
      fullName: adminFullName,
      email: adminEmail,
      passwordHash,
      isPlatformAdmin: true,
      assignments: [],
      currentMode: "organization", // Admin uses organization mode
    });

    console.log("✅ Platform admin created successfully:");
    console.log("   Email:", adminEmail);
    console.log("   Password:", adminPassword);
    console.log("   ⚠️  Please change the password after first login!");

    return admin;
  } catch (error) {
    console.error("❌ Error seeding admin:", error);
    throw error;
  }
};

// Run seeder if called directly
if (require.main === module) {
  (async () => {
    try {
      dotenv.config();
      await connectToMongo();
      console.log("📦 Seeding platform admin...");
      await seedAdmin();
      await mongoose.connection.close();
      console.log("✅ Seeding completed");
      process.exit(0);
    } catch (error) {
      console.error("❌ Seeding failed:", error);
      process.exit(1);
    }
  })();
}
