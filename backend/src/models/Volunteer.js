const mongoose = require("mongoose");

const volunteerSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event ID is required"],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    role: {
      type: String,
      required: [true, "Role is required"],
      trim: true,
      maxlength: [100, "Role cannot exceed 100 characters"],
    },
    responsibilities: {
      type: String,
      maxlength: [1000, "Responsibilities cannot exceed 1000 characters"],
    },
    assignedArea: {
      type: String,
      maxlength: [200, "Assigned area cannot exceed 200 characters"],
    },
    status: {
      type: String,
      enum: {
        values: ["applied", "approved", "rejected", "active", "completed"],
        message: "{VALUE} is not a valid volunteer status",
      },
      default: "applied",
    },
    hoursServed: {
      type: Number,
      default: 0,
      min: [0, "Hours served cannot be negative"],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
volunteerSchema.index({ eventId: 1, userId: 1 }, { unique: true });
volunteerSchema.index({ eventId: 1 });
volunteerSchema.index({ userId: 1 });
volunteerSchema.index({ status: 1 });

module.exports = mongoose.model("Volunteer", volunteerSchema);
