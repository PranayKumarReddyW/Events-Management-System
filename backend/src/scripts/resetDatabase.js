#!/usr/bin/env node
/**
 * Database Reset Script
 *
 * DANGER: This will DELETE ALL DATA in the database!
 * Use only in development environment
 *
 * Usage:
 *   node src/scripts/resetDatabase.js
 *   npm run db:reset
 */

require("dotenv").config();
const mongoose = require("mongoose");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function resetDatabase() {
  try {
    // Connect to MongoDB
    const mongoUri =
      process.env.MONGO_URI || "mongodb://localhost:27017/event-management";

    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    if (collections.length === 0) {
      console.log("ℹ️  Database is already empty");
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(
      `\n⚠️  WARNING: This will delete ${collections.length} collections:`
    );
    collections.forEach((coll) => console.log(`   - ${coll.name}`));
    console.log("");

    // Confirm deletion
    const answer = await new Promise((resolve) => {
      rl.question(
        "❓ Are you sure you want to delete ALL data? (yes/no): ",
        resolve
      );
    });

    if (answer.toLowerCase() !== "yes") {
      console.log("❌ Database reset cancelled");
      rl.close();
      await mongoose.connection.close();
      process.exit(0);
    }

    // Drop all collections
    console.log("\n🗑️  Dropping collections...");
    for (const collection of collections) {
      await db.dropCollection(collection.name);
      console.log(`   ✓ Dropped: ${collection.name}`);
    }

    console.log("\n✅ Database reset complete!");
    console.log("💡 Run seed script to populate with fresh data:");
    console.log("   npm run seed:mock\n");

    rl.close();
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error resetting database:", error);
    rl.close();
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Prevent accidental production use
if (process.env.NODE_ENV === "production") {
  console.error("❌ Cannot run database reset in production environment!");
  process.exit(1);
}

resetDatabase();
