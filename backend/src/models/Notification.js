const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recipient is required"],
      index: true,
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
    type: {
      type: String,
      required: [true, "Type is required"],
      index: true,
    },
    relatedEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      default: null,
      index: true,
    },
    channels: {
      type: [String],
      default: ["in_app"],
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high"],
      default: "normal",
    },
    scheduledFor: {
      type: Date,
      default: Date.now,
      index: true,
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    deliveryStatus: {
      email: {
        type: String,
        enum: ["pending", "delivered", "failed"],
        default: "pending",
      },
      sms: {
        type: String,
        enum: ["pending", "delivered", "failed"],
        default: "pending",
      },
      push: {
        type: String,
        enum: ["pending", "delivered", "failed"],
        default: "pending",
      },
      in_app: {
        type: String,
        enum: ["pending", "delivered", "failed"],
        default: "pending",
      },
    },
    sentAt: {
      type: Date,
      default: null,
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ sentBy: 1, createdAt: -1 });

notificationSchema.pre("save", function (next) {
  if (this.isModified("isRead") && this.isRead && !this.readAt) {
    this.readAt = new Date();
  }
  next();
});

module.exports = mongoose.model("Notification", notificationSchema);
