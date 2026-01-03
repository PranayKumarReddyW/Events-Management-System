const Joi = require("joi");

/**
 * Validation schemas for authentication and user operations
 */

const authValidation = {
  // Register new user
  register: Joi.object({
    fullName: Joi.string().min(2).max(100).required().messages({
      "string.min": "Full name must be at least 2 characters",
      "string.max": "Full name cannot exceed 100 characters",
      "any.required": "Full name is required",
    }),
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/
      )
      .required()
      .messages({
        "string.min": "Password must be at least 8 characters",
        "string.max": "Password cannot exceed 128 characters",
        "string.pattern.base":
          "Password must contain uppercase, lowercase, number, and special character",
        "any.required": "Password is required",
      }),
    rollNumber: Joi.string()
      .pattern(/^[A-Z0-9]{6,15}$/)
      .optional()
      .messages({
        "string.pattern.base": "Invalid roll number format",
      }),
    department: Joi.string().hex().length(24).optional(),
    phone: Joi.string()
      .pattern(/^[0-9]{10}$/)
      .optional()
      .messages({
        "string.pattern.base": "Phone number must be 10 digits",
      }),
    role: Joi.string()
      .valid("student", "faculty", "department_organizer", "admin")
      .default("student"),
  }),

  // Login
  login: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
    password: Joi.string().required().messages({
      "any.required": "Password is required",
    }),
  }),

  // Update profile
  updateProfile: Joi.object({
    fullName: Joi.string().min(2).max(100).optional(),
    phone: Joi.string()
      .pattern(/^[0-9]{10}$/)
      .optional(),
    department: Joi.string().hex().length(24).optional(),
    bio: Joi.string().max(500).optional().allow(""),
    profilePicture: Joi.string().uri().optional().allow(""),
  }).min(1),

  // Change password
  changePassword: Joi.object({
    currentPassword: Joi.string().required().messages({
      "any.required": "Current password is required",
    }),
    newPassword: Joi.string()
      .min(8)
      .max(128)
      .pattern(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/
      )
      .required()
      .messages({
        "string.min": "New password must be at least 8 characters",
        "string.max": "New password cannot exceed 128 characters",
        "string.pattern.base":
          "New password must contain uppercase, lowercase, number, and special character",
        "any.required": "New password is required",
      }),
  }),

  // Forgot password
  forgotPassword: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
  }),

  // Reset password
  resetPassword: Joi.object({
    token: Joi.string().required().messages({
      "any.required": "Reset token is required",
    }),
    newPassword: Joi.string()
      .min(8)
      .max(128)
      .pattern(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/
      )
      .required()
      .messages({
        "string.min": "Password must be at least 8 characters",
        "string.max": "Password cannot exceed 128 characters",
        "string.pattern.base":
          "Password must contain uppercase, lowercase, number, and special character",
        "any.required": "Password is required",
      }),
  }),

  // Verify email
  verifyEmail: Joi.object({
    token: Joi.string().required().messages({
      "any.required": "Verification token is required",
    }),
  }),
};

module.exports = authValidation;
