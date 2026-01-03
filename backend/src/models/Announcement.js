const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event ID is required"],
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },
    visibleTo: {
      type: String,
      enum: {
        values: ["all", "registered", "organizers", "specific_users"],
        message: "{VALUE} is not a valid visibility option",
      },
      default: "all",
    },
    priority: {
      type: String,
      enum: {
        values: ["low", "medium", "high", "urgent"],
        message: "{VALUE} is not a valid priority",
      },
      default: "medium",
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Created by is required"],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
announcementSchema.index({ eventId: 1 });
announcementSchema.index({ createdBy: 1 });
announcementSchema.index({ publishedAt: -1 });
announcementSchema.index({ priority: 1 });
announcementSchema.index({ expiresAt: 1 });

// Validate expiry date
announcementSchema.pre("save", function (next) {
  if (this.expiresAt && this.expiresAt <= this.publishedAt) {
    return next(new Error("Expiry date must be after published date"));
  }
  next();
});

module.exports = mongoose.model("Announcement", announcementSchema);
