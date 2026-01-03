const mongoose = require("mongoose");
const slugify = require("slugify");

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
      unique: true,
      minlength: [3, "Title must be at least 3 characters"],
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Event description is required"],
      minlength: [10, "Description must be at least 10 characters"],
      maxlength: [20000, "Description cannot exceed 20000 characters"], // Increased for HTML content
    },
    rules: {
      type: String,
      maxlength: [10000, "Rules cannot exceed 10000 characters"], // Increased for HTML content
    },
    agenda: {
      type: String,
      maxlength: [10000, "Agenda cannot exceed 10000 characters"], // Increased for HTML content
    },
    schedule: [
      {
        title: {
          type: String,
          required: true,
          trim: true,
        },
        description: String,
        startTime: {
          type: Date,
          required: true,
        },
        endTime: {
          type: Date,
          required: true,
        },
        venue: String,
        speakers: [String],
      },
    ],
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    registrationDeadline: {
      type: Date,
      required: [true, "Registration deadline is required"],
    },
    startDateTime: {
      type: Date,
      required: [true, "Start date and time is required"],
    },
    endDateTime: {
      type: Date,
      required: [true, "End date and time is required"],
    },
    venue: {
      type: String,
      required: function () {
        return this.eventMode === "offline" || this.eventMode === "hybrid";
      },
      maxlength: [200, "Venue cannot exceed 200 characters"],
    },
    eventMode: {
      type: String,
      enum: {
        values: ["online", "offline", "hybrid"],
        message: "{VALUE} is not a valid event mode",
      },
      required: [true, "Event mode is required"],
    },
    meetingLink: {
      type: String,
      required: function () {
        return this.eventMode === "online" || this.eventMode === "hybrid";
      },
    },
    eventType: {
      type: String,
      enum: {
        values: [
          "workshop",
          "seminar",
          "competition",
          "hackathon",
          "conference",
          "webinar",
          "meetup",
          "other",
        ],
        message: "{VALUE} is not a valid event type",
      },
      required: [true, "Event type is required"],
    },
    minTeamSize: {
      type: Number,
      min: [1, "Minimum team size must be at least 1"],
      default: 1,
    },
    maxTeamSize: {
      type: Number,
      min: [1, "Maximum team size must be at least 1"],
      default: 1,
      validate: {
        validator: function (value) {
          return value >= this.minTeamSize;
        },
        message: "Max team size must be greater than or equal to min team size",
      },
    },
    images: [
      {
        type: String,
      },
    ],
    requiresApproval: {
      type: Boolean,
      default: false,
    },
    bannerImage: {
      type: String,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    amount: {
      type: Number,
      min: [0, "Amount cannot be negative"],
      required: function () {
        return this.isPaid === true;
      },
    },
    eligibility: {
      type: String,
      required: [true, "Eligibility criteria is required"],
      maxlength: [500, "Eligibility cannot exceed 500 characters"],
    },
    eligibleYears: {
      type: [Number],
      required: [true, "Eligible years are required"],
      validate: {
        validator: function (years) {
          return (
            years && years.length > 0 && years.every((y) => y >= 1 && y <= 5)
          );
        },
        message: "At least one valid year (1-5) must be selected",
      },
    },
    eligibleDepartments: {
      type: [String],
      required: [true, "Eligible departments are required"],
      validate: {
        validator: function (depts) {
          return depts && depts.length > 0;
        },
        message: "At least one department must be selected",
      },
    },
    allowExternalStudents: {
      type: Boolean,
      default: false,
      required: [true, "External students option is required"],
    },
    currency: {
      type: String,
      default: "INR",
    },
    maxParticipants: {
      type: Number,
      min: [1, "Maximum participants must be at least 1"],
    },
    registeredCount: {
      type: Number,
      default: 0,
      min: [0, "Registered count cannot be negative"],
    },
    category: {
      type: String,
      enum: [
        "technical",
        "non-technical",
        "cultural",
        "sports",
        "academic",
        "other",
      ],
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    rounds: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        description: String,
        startDate: Date,
        endDate: Date,
        maxParticipants: Number,
        status: {
          type: String,
          enum: ["upcoming", "active", "completed"],
          default: "upcoming",
        },
      },
    ],
    currentRound: {
      type: Number,
      default: 0, // 0 means no rounds started, 1 means first round, etc.
    },
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Organizer ID is required"],
    },
    organizers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },
    visibility: {
      type: String,
      enum: {
        values: ["public", "private", "department_only", "club_only"],
        message: "{VALUE} is not a valid visibility option",
      },
      default: "public",
    },
    status: {
      type: String,
      enum: {
        values: ["draft", "published", "ongoing", "completed", "cancelled"],
        message: "{VALUE} is not a valid status",
      },
      default: "draft",
    },
    registrationsOpen: {
      type: Boolean,
      default: true,
    },
    certificateProvided: {
      type: Boolean,
      default: false,
    },
    approvalStatus: {
      type: String,
      enum: {
        values: ["pending", "approved", "rejected"],
        message: "{VALUE} is not a valid approval status",
      },
      default: "pending",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
eventSchema.index({ slug: 1 });
eventSchema.index({ organizerId: 1 });
eventSchema.index({ clubId: 1 });
eventSchema.index({ departmentId: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ startDateTime: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ eventType: 1 });
eventSchema.index({ visibility: 1 });
eventSchema.index({ tags: 1 });

// Generate slug before saving
eventSchema.pre("save", async function (next) {
  if (this.isModified("title")) {
    this.slug = slugify(this.title, { lower: true, strict: true });

    // Ensure unique slug
    const slugRegEx = new RegExp(`^${this.slug}(-[0-9]*)?$`, "i");
    const eventsWithSlug = await this.constructor.find({ slug: slugRegEx });

    if (eventsWithSlug.length > 0) {
      this.slug = `${this.slug}-${eventsWithSlug.length}`;
    }
  }
  next();
});

// Validate dates
eventSchema.pre("save", function (next) {
  if (this.endDateTime <= this.startDateTime) {
    return next(new Error("End date must be after start date"));
  }
  if (this.registrationDeadline >= this.startDateTime) {
    return next(
      new Error("Registration deadline must be before event start date")
    );
  }
  next();
});

// Virtual for checking if registrations are full
eventSchema.virtual("isFull").get(function () {
  if (!this.maxParticipants) return false;
  return this.registeredCount >= this.maxParticipants;
});

// Virtual for checking if event is ongoing
eventSchema.virtual("isOngoing").get(function () {
  const now = new Date();
  return now >= this.startDateTime && now <= this.endDateTime;
});

module.exports = mongoose.model("Event", eventSchema);
