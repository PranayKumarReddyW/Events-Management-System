const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      index: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event is required"],
      index: true,
    },
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventRegistration",
      required: [true, "Registration is required"],
      index: true,
    },

    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    currency: {
      type: String,
      default: "INR",
    },

    paymentGateway: {
      type: String,
      enum: ["stripe", "razorpay"],
      required: [true, "Payment gateway is required"],
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["online"],
      default: "online",
    },
    orderId: {
      type: String,
      index: true,
    },
    transactionId: {
      type: String,
      sparse: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
      index: true,
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
    },
    paidAt: {
      type: Date,
    },

    refundAmount: {
      type: Number,
      default: 0,
      min: [0, "Refund amount cannot be negative"],
    },
    refundedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

paymentSchema.index({ event: 1, user: 1 });

// Virtual field to populate refund associated with this payment
paymentSchema.virtual("refund", {
  ref: "Refund",
  localField: "_id",
  foreignField: "payment",
  justOne: true,
});

paymentSchema.pre("save", function (next) {
  if (
    this.isModified("status") &&
    this.status === "completed" &&
    !this.paidAt
  ) {
    this.paidAt = new Date();
  }
  next();
});

module.exports = mongoose.model("Payment", paymentSchema);
