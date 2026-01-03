/**
 * Test script to verify round storage in backend
 * Run this from the backend directory: node src/utils/testRoundStorage.js
 */

const mongoose = require("mongoose");
const Event = require("../models/Event");
require("dotenv").config();

async function testRoundStorage() {
  try {
    console.log("=== Testing Round Storage ===\n");

    // Connect to database
    console.log("1. Connecting to database...");
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost:27017/event-management"
    );
    console.log("✅ Connected to database\n");

    // Find a test event (or use the first event)
    console.log("2. Finding an event...");
    let event = await Event.findOne().sort({ createdAt: -1 });

    if (!event) {
      console.log("❌ No events found in database");
      console.log("Please create an event first through the UI\n");
      process.exit(0);
    }

    console.log(`✅ Found event: ${event.title}`);
    console.log(`   Event ID: ${event._id}`);
    console.log(`   Current rounds count: ${event.rounds.length}\n`);

    // Add a test round
    console.log("3. Adding test round...");
    const testRound = {
      name: "Test Round " + Date.now(),
      description: "This is a test round to verify storage",
      status: "upcoming",
    };

    console.log("   Round data:", testRound);
    event.rounds.push(testRound);
    console.log(`   Rounds count after push: ${event.rounds.length}\n`);

    // Save the event
    console.log("4. Saving event to database...");
    const savedEvent = await event.save();
    console.log("✅ Event saved successfully");
    console.log(`   Rounds count after save: ${savedEvent.rounds.length}`);
    console.log(
      `   Last round:`,
      savedEvent.rounds[savedEvent.rounds.length - 1],
      "\n"
    );

    // Verify by fetching again
    console.log("5. Fetching event again to verify...");
    const verifyEvent = await Event.findById(event._id);
    console.log(`✅ Event fetched from database`);
    console.log(`   Rounds count: ${verifyEvent.rounds.length}`);

    if (verifyEvent.rounds.length > 0) {
      console.log("\n✅ SUCCESS! Rounds are being stored correctly!");
      console.log("\nAll rounds:");
      verifyEvent.rounds.forEach((round, index) => {
        console.log(`   ${index + 1}. ${round.name} (${round.status})`);
      });
    } else {
      console.log("\n❌ PROBLEM! Rounds not persisted to database");
    }

    console.log("\n=== Test Complete ===");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    console.error(error);
    process.exit(1);
  }
}

testRoundStorage();
