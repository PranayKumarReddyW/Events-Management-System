/**
 * Utility script to sync registeredCount in Event model with actual registration count
 * Run this if you suspect the counts are out of sync
 *
 * Usage: node src/utils/syncRegistrationCounts.js
 */

const mongoose = require("mongoose");
const Event = require("../models/Event");
const EventRegistration = require("../models/EventRegistration");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

async function syncRegistrationCounts() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Get all events
    const events = await Event.find({});
    console.log(`Found ${events.length} events`);

    let updated = 0;
    let unchanged = 0;

    for (const event of events) {
      // Count actual registrations (only confirmed and pending)
      const actualCount = await EventRegistration.countDocuments({
        event: event._id,
        status: { $in: ["pending", "confirmed"] },
      });

      const currentCount = event.registeredCount || 0;

      if (actualCount !== currentCount) {
        event.registeredCount = actualCount;
        await event.save();
        console.log(
          `✓ Updated "${event.title}": ${currentCount} → ${actualCount}`
        );
        updated++;
      } else {
        unchanged++;
      }
    }

    console.log("\n📊 Summary:");
    console.log(`   • Total events: ${events.length}`);
    console.log(`   • Updated: ${updated}`);
    console.log(`   • Unchanged: ${unchanged}`);
    console.log("\n✅ Sync completed successfully!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error syncing registration counts:", error);
    process.exit(1);
  }
}

// Run the sync
syncRegistrationCounts();
