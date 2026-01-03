const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event is required"],
      index: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "SubmittedBy is required"],
      index: true,
    },
    overallRating: {
      type: Number,
      required: [true, "Overall rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
      index: true,
    },
    contentQuality: {
      type: Number,
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },
    organizationRating: {
      type: Number,
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },
    venueRating: {
      type: Number,
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },
    speakerRating: {
      type: Number,
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },
    comment: {
      type: String,
      maxlength: [2000, "Comment cannot exceed 2000 characters"],
    },
    suggestions: {
      type: String,
      maxlength: [2000, "Suggestions cannot exceed 2000 characters"],
    },
    wouldRecommend: {
      type: Boolean,
      default: false,
    },
    anonymous: {
      type: Boolean,
      default: false,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "approved", "rejected", "flagged"],
        message: "{VALUE} is not a valid status",
      },
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// One feedback per user per event
feedbackSchema.index({ event: 1, submittedBy: 1 }, { unique: true });

module.exports = mongoose.model("Feedback", feedbackSchema);
