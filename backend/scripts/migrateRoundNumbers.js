#!/usr/bin/env node

/**
 * MIGRATION SCRIPT: Add explicit round numbers to existing events
 *
 * This script updates all existing events that have rounds without explicit
 * 'number' fields, assigning them 1-based numbering.
 *
 * Usage:
 *   node backend/scripts/migrateRoundNumbers.js
 */

const mongoose = require("mongoose");
const Event = require("../src/models/Event");
const logger = require("../src/utils/logger");

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/competition_db",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );
    logger.info("Connected to MongoDB");
  } catch (error) {
    logger.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

/**
 * Migrate round numbers
 */
const migrateRoundNumbers = async () => {
  try {
    logger.info("[MIGRATION] Starting round number migration...");

    // Find all events with rounds that don't have explicit numbers
    const eventsWithoutNumbers = await Event.find({
      rounds: {
        $exists: true,
        $ne: [],
        $not: {
          $elemMatch: { number: { $exists: true } },
        },
      },
    });

    logger.info(
      `[MIGRATION] Found ${eventsWithoutNumbers.length} events that need migration`
    );

    if (eventsWithoutNumbers.length === 0) {
      logger.info(
        "[MIGRATION] No events need migration - all events already have round numbers"
      );
      return;
    }

    // Migrate each event
    let migratedCount = 0;
    let errorCount = 0;

    for (const event of eventsWithoutNumbers) {
      try {
        logger.info(
          `[MIGRATION] Processing event: "${event.title}" (ID: ${event._id})`
        );
        logger.info(`[MIGRATION] Current rounds count: ${event.rounds.length}`);

        // Add number field to each round (1-based)
        event.rounds.forEach((round, index) => {
          if (!round.number) {
            round.number = index + 1;
            logger.info(
              `[MIGRATION] Round ${index + 1}: "${
                round.name
              }" - number assigned`
            );
          }
        });

        // Save the updated event
        await event.save();
        logger.info(
          `[MIGRATION] ✓ Event "${event.title}" migrated successfully`
        );
        migratedCount++;
      } catch (error) {
        logger.error(
          `[MIGRATION] ✗ Failed to migrate event "${event.title}":`,
          error.message
        );
        errorCount++;
      }
    }

    logger.info(`\n[MIGRATION] Migration complete!`);
    logger.info(`[MIGRATION] Successfully migrated: ${migratedCount} events`);
    logger.info(`[MIGRATION] Errors: ${errorCount}`);

    // Verify migration
    const stillMissing = await Event.find({
      rounds: {
        $exists: true,
        $ne: [],
        $not: {
          $elemMatch: { number: { $exists: true } },
        },
      },
    });

    if (stillMissing.length === 0) {
      logger.info(
        "[MIGRATION] ✓ Verification passed - all events now have explicit round numbers"
      );
    } else {
      logger.error(
        `[MIGRATION] ✗ Verification failed - ${stillMissing.length} events still missing round numbers`
      );
      process.exit(1);
    }

    return { success: true, migratedCount, errorCount };
  } catch (error) {
    logger.error("[MIGRATION] Fatal error during migration:", error);
    process.exit(1);
  }
};

/**
 * Verify round consistency
 */
const verifyRoundConsistency = async () => {
  try {
    logger.info("[VERIFICATION] Checking round consistency...\n");

    const events = await Event.find({ rounds: { $exists: true, $ne: [] } });
    let issues = 0;

    for (const event of events) {
      logger.info(`Event: "${event.title}"`);
      logger.info(`  Total rounds: ${event.rounds.length}`);
      logger.info(`  Current round: ${event.currentRound}`);

      // Check each round
      for (let i = 0; i < event.rounds.length; i++) {
        const round = event.rounds[i];
        if (!round.number) {
          logger.warn(`  ✗ Round ${i} is missing 'number' field`);
          issues++;
        } else if (round.number !== i + 1) {
          logger.warn(
            `  ✗ Round at index ${i} has number ${round.number}, expected ${
              i + 1
            }`
          );
          issues++;
        } else {
          logger.info(
            `  ✓ Round ${round.number}: "${round.name}" (${round.status})`
          );
        }
      }
      logger.info("");
    }

    if (issues === 0) {
      logger.info("[VERIFICATION] ✓ All events are consistent!");
      return true;
    } else {
      logger.error(`[VERIFICATION] ✗ Found ${issues} inconsistencies`);
      return false;
    }
  } catch (error) {
    logger.error("[VERIFICATION] Error during verification:", error);
    return false;
  }
};

/**
 * Main execution
 */
const main = async () => {
  try {
    await connectDB();

    // Run migration
    await migrateRoundNumbers();

    // Verify consistency
    const isConsistent = await verifyRoundConsistency();

    if (!isConsistent) {
      logger.error("[MAIN] Verification failed - migration may be incomplete");
      process.exit(1);
    }

    logger.info("[MAIN] ✓ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    logger.error("[MAIN] Unexpected error:", error);
    process.exit(1);
  }
};

// Run migration
main();
