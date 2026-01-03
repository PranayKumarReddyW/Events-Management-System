const mongoose = require("mongoose");

const refundSchema = new mongoose.Schema(
  {
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: [true, "Payment is required"],
      index: true,
    },
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventRegistration",
      required: [true, "Registration is required"],
      index: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event is required"],
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      index: true,
    },

    amount: {
      type: Number,
      required: [true, "Refund amount is required"],
      min: [0, "Refund amount cannot be negative"],
    },
    originalAmount: {
      type: Number,
      required: [true, "Original amount is required"],
      min: [0, "Original amount cannot be negative"],
    },
    refundPercentage: {
      type: Number,
      required: [true, "Refund percentage is required"],
      min: [0, "Refund percentage cannot be negative"],
      max: [100, "Refund percentage cannot exceed 100"],
    },

    reason: {
      type: String,
      required: [true, "Reason is required"],
      maxlength: [2000, "Reason cannot exceed 2000 characters"],
    },
    status: {
      type: String,
      enum: ["pending", "rejected", "completed", "failed"],
      default: "pending",
      index: true,
    },

    requestedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      maxlength: [2000, "Rejection reason cannot exceed 2000 characters"],
    },

    refundTransactionId: {
      type: String,
      default: null,
      index: true,
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
    },
    notes: {
      type: String,
      maxlength: [4000, "Notes cannot exceed 4000 characters"],
    },
  },
  {
    timestamps: true,
  }
);

refundSchema.index({ payment: 1, status: 1 });

refundSchema.pre("save", function (next) {
  if (
    this.isModified("status") &&
    this.status === "completed" &&
    !this.processedAt
  ) {
    this.processedAt = new Date();
  }
  next();
});

module.exports = mongoose.model("Refund", refundSchema);
