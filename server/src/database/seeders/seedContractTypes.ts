import dotenv from "dotenv";
import { connectToMongo } from "@/database/connection";
import { ContractType } from "@/database/models/contractType.model";

// Seed global contract types (no tenantId/userId required)
(async () => {
  dotenv.config();
  await connectToMongo();

  const defaults = [
    { title: "Employment", description: "Standard employment contracts" },
    { title: "Contractor", description: "Independent contractor agreements" },
    { title: "Internship", description: "Internship contracts" },
  ];

  for (const d of defaults) {
    const exists = await ContractType.findOne({
      title: d.title,
      isDeleted: false,
    });
    if (!exists) {
      await ContractType.create({ title: d.title, description: d.description });
      console.log(`Seeded contract type: ${d.title}`);
    } else {
      console.log(`Skipped existing contract type: ${d.title}`);
    }
  }

  console.log("Contract types seeding complete");
  process.exit(0);
})();
