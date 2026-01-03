const mongoose = require("mongoose");

const eventSponsorSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event ID is required"],
    },
    name: {
      type: String,
      required: [true, "Sponsor name is required"],
      trim: true,
      maxlength: [200, "Name cannot exceed 200 characters"],
    },
    logo: {
      type: String,
    },
    website: {
      type: String,
      match: [/^https?:\/\/.+/, "Please provide a valid URL"],
    },
    sponsorshipTier: {
      type: String,
      enum: {
        values: [
          "platinum",
          "gold",
          "silver",
          "bronze",
          "partner",
          "associate",
        ],
        message: "{VALUE} is not a valid sponsorship tier",
      },
      required: [true, "Sponsorship tier is required"],
    },
    amount: {
      type: Number,
      min: [0, "Amount cannot be negative"],
    },
    description: {
      type: String,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
eventSponsorSchema.index({ eventId: 1 });
eventSponsorSchema.index({ sponsorshipTier: 1 });

module.exports = mongoose.model("EventSponsor", eventSponsorSchema);
