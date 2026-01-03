const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const Event = require("../models/Event");
require("dotenv").config();

/**
 * Migration script to convert file-path images to base64 stored in MongoDB
 * This will:
 * 1. Read all events with bannerImage paths
 * 2. Convert the image files to base64
 * 3. Store base64 directly in MongoDB
 * 4. Update the event documents
 */

async function migrateImagesToBase64() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Find all events with bannerImage
    const events = await Event.find({
      bannerImage: { $exists: true, $ne: null },
    });

    console.log(`Found ${events.length} events with images`);

    let converted = 0;
    let skipped = 0;
    let errors = 0;

    for (const event of events) {
      try {
        // Check if already base64
        if (event.bannerImage && event.bannerImage.startsWith("data:image")) {
          console.log(
            `⏭️  Event "${event.title}" already has base64 image, skipping`
          );
          skipped++;
          continue;
        }

        // Check if it's a file path
        if (event.bannerImage && event.bannerImage.startsWith("/uploads/")) {
          const imagePath = path.join(__dirname, "../../", event.bannerImage);

          // Check if file exists
          if (!fs.existsSync(imagePath)) {
            console.log(
              `⚠️  Image file not found for event "${event.title}": ${imagePath}`
            );
            errors++;
            continue;
          }

          // Read file and convert to base64
          const fileBuffer = fs.readFileSync(imagePath);
          const mimeType = getMimeType(imagePath);
          const base64Image = `data:${mimeType};base64,${fileBuffer.toString(
            "base64"
          )}`;

          // Update event with base64 image
          event.bannerImage = base64Image;
          await event.save();

          console.log(`✅ Converted image for event "${event.title}"`);
          converted++;
        } else {
          console.log(
            `⏭️  Event "${event.title}" has non-standard image format, skipping`
          );
          skipped++;
        }
      } catch (error) {
        console.error(
          `❌ Error processing event "${event.title}":`,
          error.message
        );
        errors++;
      }
    }

    console.log("\n📊 Migration Summary:");
    console.log(`✅ Converted: ${converted}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📝 Total: ${events.length}`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Disconnected from MongoDB");
  }
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };
  return mimeTypes[ext] || "image/jpeg";
}

// Run migration
migrateImagesToBase64();
