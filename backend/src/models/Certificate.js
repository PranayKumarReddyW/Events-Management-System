const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema(
  {
    certificateNumber: {
      type: String,
      unique: true,
      index: true,
    },
    verificationCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

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

    type: {
      type: String,
      enum: ["participation", "winner"],
      default: "participation",
      index: true,
    },
    position: {
      type: Number,
      default: null,
      min: [1, "Position must be >= 1"],
    },
    filePath: {
      type: String,
      required: [true, "File path is required"],
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Issued by is required"],
    },
    issuedDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastUpdated: {
      type: Date,
      default: null,
    },
    downloadCount: {
      type: Number,
      default: 0,
      min: [0, "Download count cannot be negative"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

certificateSchema.index({ event: 1, user: 1, type: 1 }, { unique: false });

certificateSchema.pre("save", async function (next) {
  if (this.isNew && !this.certificateNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments();
    this.certificateNumber = `CERT-${year}-${String(count + 1).padStart(
      6,
      "0"
    )}`;
  }
  next();
});

certificateSchema.pre("save", function (next) {
  if (this.isNew && !this.verificationCode) {
    this.verificationCode = require("crypto")
      .randomBytes(16)
      .toString("hex")
      .toUpperCase();
  }
  next();
});

module.exports = mongoose.model("Certificate", certificateSchema);
