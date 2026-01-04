const mongoose = require("mongoose");

const eventRegistrationSchema = new mongoose.Schema(
  {
    registrationNumber: {
      type: String,
      unique: true,
      sparse: true,
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
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
      index: true,
    },

    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      relationship: { type: String, trim: true },
    },
    specialRequirements: {
      type: String,
      maxlength: [2000, "Special requirements cannot exceed 2000 characters"],
    },
    participantInfo: {
      type: mongoose.Schema.Types.Mixed,
    },

    registrationDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "confirmed", "waitlisted", "cancelled", "rejected"],
        message: "{VALUE} is not a valid registration status",
      },
      default: "pending",
      index: true,
    },
    notes: {
      type: String,
      maxlength: [2000, "Notes cannot exceed 2000 characters"],
    },

    paymentStatus: {
      type: String,
      enum: {
        values: [
          "pending",
          "paid",
          "failed",
          "refund_pending",
          "refunded",
          "not_required",
        ],
        message: "{VALUE} is not a valid payment status",
      },
      default: "not_required",
      index: true,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },

    checkInTime: {
      type: Date,
      default: null,
      index: true,
    },
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      maxlength: [500, "Cancellation reason cannot exceed 500 characters"],
    },

    certificate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Certificate",
      default: null,
    },

    // Round management for multi-round events
    currentRound: {
      type: Number,
      default: 0, // 0 = initial registration, 1 = round 1, etc.
    },
    eliminatedInRound: {
      type: Number,
      default: null, // null = not eliminated, number = round they were eliminated in
    },
    advancedToRounds: {
      type: [Number],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index for faster queries
eventRegistrationSchema.index({ event: 1, status: 1 });
eventRegistrationSchema.index({ user: 1, registrationDate: -1 });
eventRegistrationSchema.index({ team: 1, status: 1 });

// CRITICAL: Partial unique index - prevents duplicate ACTIVE registrations
// Allows users to register again if they previously cancelled/rejected
// This is the database-level enforcement of "one active registration per user per event"
eventRegistrationSchema.index(
  { event: 1, user: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["pending", "confirmed", "waitlisted"] },
    },
    name: "unique_active_registration",
  }
);

eventRegistrationSchema.pre("save", async function (next) {
  if (this.isNew && !this.registrationNumber) {
    const year = new Date().getFullYear();
    // Generate unique registration number using timestamp + random suffix
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    this.registrationNumber = `REG-${year}-${timestamp}${random}`;
  }
  next();
});

module.exports = mongoose.model("EventRegistration", eventRegistrationSchema);
