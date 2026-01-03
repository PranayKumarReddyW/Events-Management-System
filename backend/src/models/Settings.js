const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, "Key is required"],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [100, "Key cannot exceed 100 characters"],
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, "Value is required"],
    },
    category: {
      type: String,
      enum: {
        values: [
          "general",
          "email",
          "payment",
          "security",
          "feature",
          "ui",
          "notification",
          "other",
        ],
        message: "{VALUE} is not a valid category",
      },
      default: "general",
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
settingsSchema.index({ category: 1 });
settingsSchema.index({ isPublic: 1 });

module.exports = mongoose.model("Settings", settingsSchema);
