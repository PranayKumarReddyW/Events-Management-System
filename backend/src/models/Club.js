const mongoose = require("mongoose");

const clubSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Club name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [200, "Name cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Department ID is required"],
    },
    logo: {
      type: String,
    },
    presidentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    vicePresidentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    facultyAdvisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    memberCount: {
      type: Number,
      default: 0,
      min: [0, "Member count cannot be negative"],
    },
    establishedDate: {
      type: Date,
    },
    socialLinks: {
      type: mongoose.Schema.Types.Mixed,
      validate: {
        validator: function (v) {
          if (!v) return true;
          const validKeys = [
            "website",
            "instagram",
            "twitter",
            "facebook",
            "linkedin",
            "youtube",
          ];
          return Object.keys(v).every((key) => validKeys.includes(key));
        },
        message: "Invalid social link key",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index
clubSchema.index({ departmentId: 1, name: 1 }, { unique: true });
clubSchema.index({ departmentId: 1 });
clubSchema.index({ presidentId: 1 });
clubSchema.index({ isActive: 1 });

module.exports = mongoose.model("Club", clubSchema);
