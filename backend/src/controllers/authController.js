const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const Session = require("../models/Session");
const { AppError } = require("../middleware/errorHandler");
const { sendEmail } = require("../utils/email");
const logger = require("../utils/logger");
const { getRedisClient } = require("../config/redis");

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

// Register user
exports.register = async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      password,
      phone,
      role,
      departmentId,
      yearOfStudy,
      rollNumber,
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError("Email already registered", 400));
    }

    // Create user
    const user = await User.create({
      fullName,
      email,
      password,
      phone,
      role: role || "student",
      departmentId,
      yearOfStudy,
      rollNumber,
    });

    // Generate token
    const token = generateToken(user._id);

    // Create session
    const session = await Session.create({
      userId: user._id,
      token,
      ip: req.ip,
      device: req.headers["user-agent"],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Send welcome email
    if (process.env.ENABLE_EMAIL_NOTIFICATIONS === "true") {
      try {
        await sendEmail({
          to: user.email,
          subject: "Welcome to Event Management System",
          template: "welcome",
          data: { name: user.fullName },
        });
      } catch (emailError) {
        logger.error("Failed to send welcome email:", emailError);
      }
    }

    res.status(201).json({
      success: true,
      message: "Registration successful",
      data: {
        user,
        token,
        sessionId: session._id,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Login user
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return next(new AppError("Invalid credentials", 401));
    }

    // Check if user is active
    if (!user.isActive) {
      return next(new AppError("Account has been deactivated", 403));
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return next(new AppError("Invalid credentials", 401));
    }

    // Generate token
    const token = generateToken(user._id);

    // Create session
    const session = await Session.create({
      userId: user._id,
      token,
      ip: req.ip,
      device: req.headers["user-agent"],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Cache user data in Redis
    const redis = getRedisClient();
    if (redis) {
      await redis.setex(`user:${user._id}`, 3600, JSON.stringify(user));
    }

    // Remove password from response
    user.password = undefined;

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user,
        token,
        sessionId: session._id,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Logout user
exports.logout = async (req, res, next) => {
  try {
    // Deactivate session
    await Session.findOneAndUpdate({ token: req.token }, { isActive: false });

    // Remove user from Redis cache
    const redis = getRedisClient();
    if (redis) {
      await redis.del(`user:${req.user._id}`);
    }

    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    next(error);
  }
};

// Get current user
exports.getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate(
      "departmentId",
      "name code"
    );

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// Update profile
exports.updateProfile = async (req, res, next) => {
  try {
    const allowedUpdates = [
      "fullName",
      "phone",
      "bio",
      "profilePicture",
      "yearOfStudy",
      "notificationPreferences",
    ];
    const updates = {};

    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    // Update Redis cache
    const redis = getRedisClient();
    if (redis) {
      await redis.setex(`user:${user._id}`, 3600, JSON.stringify(user));
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// Change password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select("+password");

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return next(new AppError("Current password is incorrect", 401));
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Invalidate all sessions except current
    await Session.updateMany(
      { userId: user._id, token: { $ne: req.token } },
      { isActive: false }
    );

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Forgot password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists
      return res.status(200).json({
        success: true,
        message: "If the email exists, a password reset link has been sent",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpiry = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    if (process.env.ENABLE_EMAIL_NOTIFICATIONS === "true") {
      await sendEmail({
        to: user.email,
        subject: "Password Reset Request",
        template: "reset-password",
        data: {
          name: user.fullName,
          resetUrl,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: "Password reset link sent to email",
    });
  } catch (error) {
    next(error);
  }
};

// Reset password
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return next(new AppError("Invalid or expired reset token", 400));
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    // Invalidate all sessions
    await Session.updateMany({ userId: user._id }, { isActive: false });

    res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    next(error);
  }
};
