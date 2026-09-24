#!/usr/bin/env node

const { MongoClient } = require("mongodb");
const dotenv = require("dotenv");

dotenv.config();

// ⚠️ Replace with your full Atlas connection string
const uri = process.env.MONGO_URI;

if (!uri) {
  console.error("Missing env var: MONGO_URI");
  process.exit(1);
}

// The URI carries credentials, so log the host only.
try {
  console.log(`Target: ${new URL(uri).host}`);
} catch {
  console.log("Target: (unparseable MONGO_URI)");
}

async function dropAllCollections() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log(`Connected to MongoDB Atlas`);

    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();

    for (const { name: dbName } of dbs.databases) {
      if (["admin", "local", "config"].includes(dbName)) continue; // skip system DBs

      const db = client.db(dbName);
      const collections = await db.listCollections().toArray();

      if (collections.length === 0) {
        console.log(`⚠️  No collections in database: ${dbName}`);
        continue;
      }

      for (const coll of collections) {
        console.log(`Dropping collection: ${dbName}.${coll.name}`);
        await db.collection(coll.name).drop();
      }
    }

    console.log("✅ All collections dropped successfully from all databases.");
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await client.close();
  }
}

dropAllCollections();
