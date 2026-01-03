const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      unique: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [200, "Name cannot exceed 200 characters"],
    },
    type: {
      type: String,
      enum: {
        values: ["university", "college", "institute", "school", "other"],
        message: "{VALUE} is not a valid organization type",
      },
      required: [true, "Organization type is required"],
    },
    logo: {
      type: String,
    },
    website: {
      type: String,
      match: [/^https?:\/\/.+/, "Please provide a valid URL"],
    },
    address: {
      type: String,
      maxlength: [500, "Address cannot exceed 500 characters"],
    },
    contactEmail: {
      type: String,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    contactPhone: {
      type: String,
      match: [/^[0-9]{10}$/, "Please provide a valid 10-digit phone number"],
    },
    establishedYear: {
      type: Number,
      min: [1800, "Year must be valid"],
      max: [new Date().getFullYear(), "Year cannot be in the future"],
    },
    description: {
      type: String,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
  },
  {
    timestamps: true,
  }
);

organizationSchema.index({ name: 1 });
organizationSchema.index({ type: 1 });

module.exports = mongoose.model("Organization", organizationSchema);
