const logger = require("../utils/logger");

/**
 * PRODUCTION-GRADE ERROR HANDLING
 * Ensures all errors are properly logged and returned
 * Zero silent failures
 */

class AppError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details; // Field-level error details
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Async handler wrapper
 * Prevents unhandled promise rejections
 * @param {Function} fn - Async controller function
 * @returns {Function} - Wrapped function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      logger.error(`[UNHANDLED ERROR IN ${fn.name}]`, {
        message: error.message,
        stack: error.stack,
        url: req.originalUrl,
        method: req.method,
      });
      next(error);
    });
  };
};

/**
 * Global error handling middleware
 * MUST be the last middleware in the app
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;

  // Log all errors
  if (err.statusCode === 500) {
    logger.error(`[CRITICAL ERROR]`, {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      userId: req.user?._id,
    });
  } else {
    logger.warn(`[CLIENT ERROR - ${err.statusCode}]`, {
      message: err.message,
      url: req.originalUrl,
      method: req.method,
      userId: req.user?._id,
      details: err.details,
    });
  }

  // Handle different error types
  if (err instanceof AppError && err.isOperational) {
    // Operational error - expected error
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details && { errors: err.details }),
    });
  }

  // Handle Mongoose validation errors
  if (err.name === "ValidationError") {
    const errors = {};
    Object.keys(err.errors).forEach((field) => {
      errors[field] = err.errors[field].message;
    });

    logger.warn(`[MONGOOSE VALIDATION ERROR]`, { errors });

    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  // Handle Mongoose duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const errors = {
      [field]: `${field} "${value}" already exists`,
    };

    logger.warn(`[DUPLICATE KEY ERROR]`, { errors, field });

    return res.status(409).json({
      success: false,
      message: `${field} already exists`,
      errors,
    });
  }

  // Handle JSON parsing errors
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    logger.warn(`[JSON PARSE ERROR]`, { message: err.message });

    return res.status(400).json({
      success: false,
      message: "Invalid JSON in request body",
      errors: { body: "Malformed JSON" },
    });
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    logger.warn(`[JWT ERROR]`, { message: err.message });

    return res.status(401).json({
      success: false,
      message: "Invalid authentication token",
    });
  }

  if (err.name === "TokenExpiredError") {
    logger.warn(`[TOKEN EXPIRED]`);

    return res.status(401).json({
      success: false,
      message: "Authentication token has expired",
    });
  }

  // Handle multer errors
  if (err.name === "MulterError") {
    logger.warn(`[MULTER ERROR]`, { code: err.code, message: err.message });

    let message = "File upload error";
    const errors = {};

    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File is too large";
      errors.file = "File size exceeds maximum limit";
    } else if (err.code === "LIMIT_FILE_COUNT") {
      message = "Too many files";
      errors.files = "Number of files exceeds maximum limit";
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      message = "Unexpected file field";
      errors.file = "File field not allowed";
    }

    return res.status(400).json({
      success: false,
      message,
      errors,
    });
  }

  // Unhandled error - log with full details
  logger.error(`[UNHANDLED ERROR]`, {
    name: err.name,
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    userId: req.user?._id,
  });

  // Don't expose internal error details to client
  res.status(500).json({
    success: false,
    message: "Internal server error",
    // In development, you might want to include error details
    ...(process.env.NODE_ENV === "development" && { error: err.message }),
  });
};

/**
 * 404 handler - should be used AFTER all routes
 */
const notFoundHandler = (req, res) => {
  logger.warn(`[404 NOT FOUND]`, {
    url: req.originalUrl,
    method: req.method,
    userId: req.user?._id,
  });

  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
};

module.exports = {
  AppError,
  asyncHandler,
  errorHandler,
  notFoundHandler,
};
