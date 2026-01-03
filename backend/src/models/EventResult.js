const mongoose = require("mongoose");

const eventResultSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event ID is required"],
    },
    position: {
      type: Number,
      required: [true, "Position is required"],
      min: [1, "Position must be at least 1"],
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    score: {
      type: Number,
      min: [0, "Score cannot be negative"],
    },
    remarks: {
      type: String,
      maxlength: [1000, "Remarks cannot exceed 1000 characters"],
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
eventResultSchema.index({ eventId: 1, position: 1 });
eventResultSchema.index({ eventId: 1 });
eventResultSchema.index({ teamId: 1 });
eventResultSchema.index({ userId: 1 });
eventResultSchema.index({ publishedAt: -1 });

// Validate that either teamId or userId is provided
eventResultSchema.pre("save", function (next) {
  if (!this.teamId && !this.userId) {
    return next(new Error("Either teamId or userId must be provided"));
  }
  if (this.teamId && this.userId) {
    return next(new Error("Cannot provide both teamId and userId"));
  }
  next();
});

module.exports = mongoose.model("EventResult", eventResultSchema);
