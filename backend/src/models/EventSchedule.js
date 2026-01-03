const mongoose = require("mongoose");

const eventScheduleSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event ID is required"],
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    startTime: {
      type: Date,
      required: [true, "Start time is required"],
    },
    endTime: {
      type: Date,
      required: [true, "End time is required"],
    },
    venue: {
      type: String,
      maxlength: [200, "Venue cannot exceed 200 characters"],
    },
    speakers: [
      {
        type: String,
        trim: true,
      },
    ],
    order: {
      type: Number,
      default: 0,
      min: [0, "Order cannot be negative"],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
eventScheduleSchema.index({ eventId: 1, order: 1 });
eventScheduleSchema.index({ eventId: 1 });
eventScheduleSchema.index({ startTime: 1 });

// Validate time range
eventScheduleSchema.pre("save", function (next) {
  if (this.endTime <= this.startTime) {
    return next(new Error("End time must be after start time"));
  }
  next();
});

module.exports = mongoose.model("EventSchedule", eventScheduleSchema);
