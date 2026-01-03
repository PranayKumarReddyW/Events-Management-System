const mongoose = require("mongoose");

const analyticsSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: {
        values: [
          "event",
          "user",
          "registration",
          "payment",
          "club",
          "department",
          "system",
        ],
        message: "{VALUE} is not a valid entity type",
      },
      required: [true, "Entity type is required"],
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Entity ID is required"],
    },
    metric: {
      type: String,
      required: [true, "Metric is required"],
      trim: true,
      maxlength: [100, "Metric cannot exceed 100 characters"],
    },
    value: {
      type: Number,
      required: [true, "Value is required"],
    },
    period: {
      type: String,
      enum: {
        values: ["hourly", "daily", "weekly", "monthly", "yearly", "lifetime"],
        message: "{VALUE} is not a valid period",
      },
      required: [true, "Period is required"],
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
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
analyticsSchema.index({ entityType: 1, entityId: 1 });
analyticsSchema.index({ metric: 1 });
analyticsSchema.index({ date: -1 });
analyticsSchema.index({ period: 1 });
analyticsSchema.index({
  entityType: 1,
  entityId: 1,
  metric: 1,
  period: 1,
  date: 1,
});

module.exports = mongoose.model("Analytics", analyticsSchema);
