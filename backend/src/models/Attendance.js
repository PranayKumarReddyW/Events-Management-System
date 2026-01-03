const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
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

    checkInTime: {
      type: Date,
      required: [true, "Check-in time is required"],
      default: Date.now,
      index: true,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number,
      default: 0,
      min: [0, "Duration cannot be negative"],
    },

    checkInMethod: {
      type: String,
      enum: ["qr", "manual"],
      default: "manual",
      index: true,
    },
    location: {
      type: String,
      maxlength: [200, "Location cannot exceed 200 characters"],
    },
    deviceInfo: {
      type: mongoose.Schema.Types.Mixed,
    },
    notes: {
      type: String,
      maxlength: [2000, "Notes cannot exceed 2000 characters"],
    },

    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

attendanceSchema.index({ event: 1, user: 1, checkOutTime: 1 });

attendanceSchema.pre("save", function (next) {
  if (this.checkOutTime && this.checkOutTime <= this.checkInTime) {
    return next(new Error("Check-out time must be after check-in time"));
  }
  next();
});

module.exports = mongoose.model("Attendance", attendanceSchema);
