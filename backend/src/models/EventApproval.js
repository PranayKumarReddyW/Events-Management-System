const mongoose = require("mongoose");

const eventApprovalSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event ID is required"],
      unique: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Submitted by is required"],
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "approved", "rejected", "revision_requested"],
        message: "{VALUE} is not a valid approval status",
      },
      default: "pending",
    },
    remarks: {
      type: String,
      maxlength: [1000, "Remarks cannot exceed 1000 characters"],
    },
    approvalLevel: {
      type: Number,
      default: 1,
      min: [1, "Approval level must be at least 1"],
    },
    requiredApprovals: {
      type: Number,
      default: 1,
      min: [1, "Required approvals must be at least 1"],
    },
    currentApprovals: {
      type: Number,
      default: 0,
      min: [0, "Current approvals cannot be negative"],
    },
    approvedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
eventApprovalSchema.index({ submittedBy: 1 });
eventApprovalSchema.index({ approvedBy: 1 });
eventApprovalSchema.index({ status: 1 });

// Set approvedAt/rejectedAt when status changes
eventApprovalSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    if (this.status === "approved" && !this.approvedAt) {
      this.approvedAt = new Date();
    } else if (this.status === "rejected" && !this.rejectedAt) {
      this.rejectedAt = new Date();
    }
  }
  next();
});

module.exports = mongoose.model("EventApproval", eventApprovalSchema);
