const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    token: {
      type: String,
      required: [true, "Token is required"],
      unique: true,
    },
    ip: {
      type: String,
      match: [
        /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[a-fA-F0-9:]+)$/,
        "Invalid IP address format",
      ],
    },
    device: {
      type: String,
      maxlength: [200, "Device cannot exceed 200 characters"],
    },
    browser: {
      type: String,
      maxlength: [100, "Browser cannot exceed 100 characters"],
    },
    location: {
      type: String,
      maxlength: [200, "Location cannot exceed 200 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiry date is required"],
      index: { expires: 0 }, // TTL index
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
sessionSchema.index({ userId: 1 });
sessionSchema.index({ token: 1 });
sessionSchema.index({ isActive: 1 });
sessionSchema.index({ expiresAt: 1 });

// Update last activity
sessionSchema.methods.updateActivity = function () {
  this.lastActivity = new Date();
  return this.save();
};

module.exports = mongoose.model("Session", sessionSchema);
