/**
 * Database Migration: Update EventRegistration Unique Index
 *
 * Purpose: Convert standard unique index to partial unique index
 * This allows users to register again after cancelling while preventing
 * duplicate ACTIVE registrations.
 *
 * IMPORTANT: Run this BEFORE deploying updated application code
 */

require("dotenv").config();
const mongoose = require("mongoose");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/event-management";

async function migrateRegistrationIndex() {
  try {
    console.log("[MIGRATION] Starting EventRegistration index migration...");
    console.log(`[MIGRATION] Connecting to: ${MONGODB_URI}`);

    await mongoose.connect(MONGODB_URI);
    console.log("[MIGRATION] Connected to MongoDB");

    const db = mongoose.connection.db;
    const collection = db.collection("eventregistrations");

    // Step 1: Check existing indexes
    console.log("\n[MIGRATION] Step 1: Checking existing indexes...");
    const existingIndexes = await collection.indexes();
    console.log(
      "[MIGRATION] Current indexes:",
      JSON.stringify(existingIndexes, null, 2)
    );

    // Step 2: Drop old unique index if it exists
    console.log("\n[MIGRATION] Step 2: Dropping old unique index...");
    try {
      await collection.dropIndex("event_1_user_1");
      console.log("[MIGRATION] ✓ Dropped old index: event_1_user_1");
    } catch (error) {
      if (error.code === 27) {
        console.log(
          "[MIGRATION] ℹ Old index does not exist (already migrated?)"
        );
      } else {
        throw error;
      }
    }

    // Step 3: Create new partial unique index
    console.log("\n[MIGRATION] Step 3: Creating new partial unique index...");
    await collection.createIndex(
      { event: 1, user: 1 },
      {
        unique: true,
        partialFilterExpression: {
          status: { $in: ["pending", "confirmed", "waitlisted"] },
        },
        name: "unique_active_registration",
        background: true, // Non-blocking index creation
      }
    );
    console.log(
      "[MIGRATION] ✓ Created new partial unique index: unique_active_registration"
    );

    // Step 4: Verify new indexes
    console.log("\n[MIGRATION] Step 4: Verifying new index...");
    const newIndexes = await collection.indexes();
    const partialIndex = newIndexes.find(
      (idx) => idx.name === "unique_active_registration"
    );

    if (partialIndex) {
      console.log("[MIGRATION] ✓ Verification successful!");
      console.log(
        "[MIGRATION] New index details:",
        JSON.stringify(partialIndex, null, 2)
      );
    } else {
      throw new Error("Partial index was not created successfully");
    }

    // Step 5: Test the new index behavior
    console.log("\n[MIGRATION] Step 5: Testing new index behavior...");

    // Count total registrations
    const totalRegs = await collection.countDocuments();
    console.log(`[MIGRATION] Total registrations in DB: ${totalRegs}`);

    // Check for potential duplicates (same user + event with active statuses)
    const duplicates = await collection
      .aggregate([
        {
          $match: {
            status: { $in: ["pending", "confirmed", "waitlisted"] },
          },
        },
        {
          $group: {
            _id: { event: "$event", user: "$user" },
            count: { $sum: 1 },
          },
        },
        {
          $match: { count: { $gt: 1 } },
        },
      ])
      .toArray();

    if (duplicates.length > 0) {
      console.log(
        `\n[MIGRATION] ⚠ WARNING: Found ${duplicates.length} duplicate active registrations!`
      );
      console.log(
        "[MIGRATION] These must be manually resolved before the system will work correctly:"
      );
      console.log(JSON.stringify(duplicates, null, 2));
      console.log("\n[MIGRATION] Run this query to see full details:");
      console.log(`
        db.eventregistrations.find({
          status: { $in: ['pending', 'confirmed', 'waitlisted'] }
        }).sort({ event: 1, user: 1 })
      `);
    } else {
      console.log("[MIGRATION] ✓ No duplicate active registrations found");
    }

    console.log(
      "\n[MIGRATION] ═══════════════════════════════════════════════════"
    );
    console.log("[MIGRATION] ✓ Migration completed successfully!");
    console.log(
      "[MIGRATION] ═══════════════════════════════════════════════════"
    );
    console.log("[MIGRATION] Summary:");
    console.log("[MIGRATION]   - Old index removed: event_1_user_1");
    console.log(
      "[MIGRATION]   - New index created: unique_active_registration"
    );
    console.log(
      "[MIGRATION]   - Index type: Partial Unique (only active statuses)"
    );
    console.log(
      "[MIGRATION]   - Status filter: pending, confirmed, waitlisted"
    );
    console.log("[MIGRATION]");
    console.log("[MIGRATION] What changed:");
    console.log(
      "[MIGRATION]   BEFORE: Users could NOT register again after cancelling"
    );
    console.log(
      "[MIGRATION]   AFTER:  Users CAN register again after cancelling"
    );
    console.log(
      "[MIGRATION]   ALWAYS: Only ONE active registration per user per event"
    );
    console.log(
      "[MIGRATION] ═══════════════════════════════════════════════════"
    );

    await mongoose.connection.close();
    console.log("[MIGRATION] Database connection closed");

    process.exit(0);
  } catch (error) {
    console.error("\n[MIGRATION] ✗ Migration failed!");
    console.error("[MIGRATION] Error:", error.message);
    console.error("[MIGRATION] Stack:", error.stack);

    try {
      await mongoose.connection.close();
    } catch (closeError) {
      // Ignore close errors
    }

    process.exit(1);
  }
}

// Run migration
console.log("═══════════════════════════════════════════════════════════════");
console.log("EventRegistration Index Migration");
console.log("═══════════════════════════════════════════════════════════════");
console.log(
  "Purpose: Update unique index to allow re-registration after cancel"
);
console.log("Impact: Database-level enforcement of business rules");
console.log("Duration: ~1-5 seconds depending on collection size");
console.log("Safety: Non-blocking background index creation");
console.log(
  "═══════════════════════════════════════════════════════════════\n"
);

migrateRegistrationIndex();
