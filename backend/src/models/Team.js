const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const teamSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Team name is required"],
      trim: true,
      minlength: [2, "Team name must be at least 2 characters"],
      maxlength: [100, "Team name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    leader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Team leader is required"],
      index: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    maxSize: {
      type: Number,
      required: [true, "Max team size is required"],
      min: [1, "Max team size must be at least 1"],
    },
    status: {
      type: String,
      enum: {
        values: ["active", "locked", "disbanded"],
        message: "{VALUE} is not a valid team status",
      },
      default: "active",
      index: true,
    },
    inviteCode: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
      default: () => uuidv4().substring(0, 6).toUpperCase(),
      index: true,
      validate: {
        validator: function (v) {
          return !v || /^[A-Z0-9]{6}$/.test(v);
        },
        message:
          "Invite code must be exactly 6 uppercase alphanumeric characters",
      },
    },
    round: {
      type: Number,
      default: 1, // Teams start at round 1
      min: [1, "Round must be at least 1"],
    },
    eliminated: {
      type: Boolean,
      default: false,
      index: true,
    },
    score: {
      type: Number,
      default: 0,
    },
    rank: {
      type: Number,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

teamSchema.index({ event: 1, leader: 1 });

teamSchema.pre("save", function (next) {
  // Generate invite code if not present
  if (!this.inviteCode) {
    this.inviteCode = uuidv4().substring(0, 6).toUpperCase();
  }

  // Ensure leader is always in members array (at the start)
  if (!this.members.map(String).includes(String(this.leader))) {
    this.members.unshift(this.leader);
  }

  // Validate team size (members array includes leader)
  if (this.members.length > this.maxSize) {
    return next(
      new Error(
        `Team cannot have more than ${this.maxSize} members (including leader)`
      )
    );
  }

  next();
});

teamSchema.virtual("currentSize").get(function () {
  // Members array includes leader, so this is the total team size
  return this.members.length;
});

teamSchema.virtual("isFull").get(function () {
  return this.members.length >= this.maxSize;
});

module.exports = mongoose.model("Team", teamSchema);
