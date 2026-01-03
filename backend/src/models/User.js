const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[0-9]{10}$/, "Please provide a valid 10-digit phone number"],
    },
    role: {
      type: String,
      enum: {
        values: [
          "student",
          "department_organizer",
          "faculty",
          "admin",
          "super_admin",
        ],
        message: "{VALUE} is not a valid role",
      },
      default: "student",
    },
    profilePicture: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      maxlength: [500, "Bio cannot exceed 500 characters"],
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },
    // Some controllers/selects refer to a string department name
    department: {
      type: String,
      trim: true,
    },
    branch: {
      type: String,
      trim: true,
    },
    yearOfStudy: {
      type: Number,
      min: [1, "Year of study must be at least 1"],
      max: [5, "Year of study cannot exceed 5"],
    },
    isOutsideCollege: {
      type: Boolean,
      default: false,
    },
    rollNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true },
      in_app: { type: Boolean, default: true },
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    resetPasswordToken: String,
    resetPasswordExpiry: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
userSchema.index({ departmentId: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(
    this.password,
    parseInt(process.env.BCRYPT_ROUNDS) || 12
  );
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Hide sensitive data
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpiry;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
