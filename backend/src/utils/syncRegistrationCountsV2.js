const Event = require("../models/Event");
const EventRegistration = require("../models/EventRegistration");
const logger = require("./logger");

/**
 * Utility script to sync registeredCount in Event model with actual confirmed registrations
 * Run this whenever you suspect the counts are out of sync
 *
 * Usage:
 *   node src/utils/syncRegistrationCounts.js
 * or:
 *   npm run sync:counts
 */

async function syncRegistrationCounts() {
  try {
    console.log("[sync] Starting registration count synchronization...");

    const events = await Event.find({});
    console.log(`[sync] Found ${events.length} events`);

    let fixed = 0;
    let errors = 0;

    for (const event of events) {
      try {
        // Count only confirmed registrations (not pending, cancelled, or rejected)
        const actualCount = await EventRegistration.countDocuments({
          event: event._id,
          status: "confirmed",
        });

        const currentCount = event.registeredCount || 0;

        if (currentCount !== actualCount) {
          console.log(
            `[sync] Event "${event.title}": ${currentCount} → ${actualCount}`
          );
          event.registeredCount = actualCount;
          await event.save();
          fixed++;
        }
      } catch (err) {
        console.error(
          `[sync] Error processing event ${event._id}:`,
          err.message
        );
        errors++;
      }
    }

    console.log(`\n[sync] ✅ Synchronization complete!`);
    console.log(`[sync] Fixed: ${fixed} events`);
    console.log(`[sync] Errors: ${errors}`);
    console.log(`[sync] Total: ${events.length} events processed`);

    return { fixed, errors, total: events.length };
  } catch (error) {
    console.error("[sync] Fatal error:", error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  const mongoose = require("mongoose");
  require("dotenv").config();

  const mongoUri =
    process.env.MONGO_URI || "mongodb://localhost:27017/event-management";

  mongoose
    .connect(mongoUri)
    .then(async () => {
      console.log("[sync] Connected to MongoDB");
      await syncRegistrationCounts();
      await mongoose.connection.close();
      console.log("[sync] Database connection closed");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[sync] Connection error:", err);
      process.exit(1);
    });
}

module.exports = { syncRegistrationCounts };
