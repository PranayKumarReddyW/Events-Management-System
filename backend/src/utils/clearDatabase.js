const mongoose = require("mongoose");

// Import all models
const User = require("../models/User");
const Event = require("../models/Event");
const EventRegistration = require("../models/EventRegistration");
const Team = require("../models/Team");
const Payment = require("../models/Payment");
const Certificate = require("../models/Certificate");
const Feedback = require("../models/Feedback");
const Notification = require("../models/Notification");
const Announcement = require("../models/Announcement");
const Session = require("../models/Session");
const AuditLog = require("../models/AuditLog");
require("dotenv").config();

/**
 * Clear all collections in the database
 */
async function clearDatabase() {
  try {
    console.log("🗑️  Starting database cleanup...", process.env);

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    // Drop all collections
    const collections = [
      { name: "Users", model: User },
      { name: "Events", model: Event },
      { name: "EventRegistrations", model: EventRegistration },
      { name: "Teams", model: Team },
      { name: "Payments", model: Payment },
      { name: "Certificates", model: Certificate },
      { name: "Feedback", model: Feedback },
      { name: "Notifications", model: Notification },
      { name: "Announcements", model: Announcement },
      { name: "Sessions", model: Session },
      { name: "AuditLogs", model: AuditLog },
    ];

    for (const { name, model } of collections) {
      try {
        const count = await model.countDocuments();
        if (count > 0) {
          await model.deleteMany({});
          console.log(`✅ Cleared ${name}: ${count} documents deleted`);
        } else {
          console.log(`⏭️  Skipped ${name}: already empty`);
        }
      } catch (error) {
        console.log(`⚠️  Failed to clear ${name}: ${error.message}`);
      }
    }

    console.log("\n✨ Database cleanup completed successfully!");
    console.log("\n🌱 Ready to seed fresh data...");
  } catch (error) {
    console.error("❌ Error clearing database:", error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log("👋 Disconnected from MongoDB");
  }
}

// Run if called directly
if (require.main === module) {
  clearDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

module.exports = { clearDatabase };
