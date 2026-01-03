const mongoose = require("mongoose");

const fileMediaSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, "URL is required"],
    },
    filename: {
      type: String,
      required: [true, "Filename is required"],
      trim: true,
    },
    type: {
      type: String,
      enum: {
        values: [
          "image",
          "video",
          "document",
          "audio",
          "certificate",
          "banner",
          "logo",
          "other",
        ],
        message: "{VALUE} is not a valid file type",
      },
      required: [true, "File type is required"],
    },
    mimeType: {
      type: String,
      required: [true, "MIME type is required"],
    },
    fileSize: {
      type: Number,
      required: [true, "File size is required"],
      min: [0, "File size cannot be negative"],
    },
    path: {
      type: String,
      required: [true, "Path is required"],
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Uploaded by is required"],
    },
    relatedEntityType: {
      type: String,
      enum: ["event", "user", "club", "certificate", "announcement", "other"],
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
fileMediaSchema.index({ uploadedBy: 1 });
fileMediaSchema.index({ type: 1 });
fileMediaSchema.index({ relatedEntityType: 1, relatedEntityId: 1 });
fileMediaSchema.index({ createdAt: -1 });

module.exports = mongoose.model("FileMedia", fileMediaSchema);
