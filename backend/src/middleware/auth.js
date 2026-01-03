const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Session = require("../models/Session");
const { getRedisClient } = require("../config/redis");

// Verify JWT token
exports.authenticate = async (req, res, next) => {
  try {
    let token;

    // Check for token in header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if session is valid
    const session = await Session.findOne({
      token,
      userId: decoded.id,
      isActive: true,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired session",
      });
    }

    // Check Redis cache for user
    const redis = getRedisClient();
    let user;

    if (redis) {
      const cachedUser = await redis.get(`user:${decoded.id}`);
      if (cachedUser) {
        user = JSON.parse(cachedUser);
      }
    }

    // If not in cache, fetch from DB
    if (!user) {
      user = await User.findById(decoded.id).select("-password");

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      // Cache user data
      if (redis) {
        await redis.setex(`user:${user._id}`, 3600, JSON.stringify(user));
      }
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account has been deactivated",
      });
    }

    // Attach user and session to request
    req.user = user;
    req.session = session;
    req.token = token;

    // Update session activity
    await session.updateActivity();

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Authentication failed",
      error: error.message,
    });
  }
};

// Check user roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userRole = String(req.user.role || "").toLowerCase();
    const allowed = roles.map((r) => String(r).toLowerCase());

    // Backwards-compatible aliases used across the codebase
    const aliasMap = new Map([
      ["superadmin", "super_admin"],
      ["super_admin", "superadmin"],
    ]);
    const allowedSet = new Set(allowed);
    for (const r of allowed) {
      const alias = aliasMap.get(r);
      if (alias) allowedSet.add(alias);
    }

    if (!allowedSet.has(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
      });
    }

    next();
  };
};

// Backwards-compatible alias used in several routes
exports.protect = exports.authenticate;

// Check specific permissions
exports.checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const RolePermission = require("../models/RolePermission");
      const rolePermissions = await RolePermission.findOne({
        role: req.user.role,
        isActive: true,
      });

      if (
        !rolePermissions ||
        !rolePermissions.permissions.includes(permission)
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Insufficient permissions.",
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Permission check failed",
        error: error.message,
      });
    }
  };
};

// Optional authentication (doesn't fail if no token)
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");

      if (user && user.isActive) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};
