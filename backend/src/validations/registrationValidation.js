const Joi = require("joi");

/**
 * Validation schemas for registration-related operations
 */

const registrationValidation = {
  // Register for event
  registerForEvent: Joi.object({
    eventId: Joi.string().hex().length(24).required().messages({
      "string.hex": "Invalid event ID format",
      "string.length": "Invalid event ID format",
      "any.required": "Event ID is required",
    }),
    teamId: Joi.string().hex().length(24).optional(),
    additionalInfo: Joi.object().optional(),
  }),

  // Update registration status
  updateStatus: Joi.object({
    status: Joi.string()
      .valid("pending", "confirmed", "cancelled", "checked_in", "waitlisted")
      .required()
      .messages({
        "any.only": "Invalid status",
        "any.required": "Status is required",
      }),
  }),

  // Query parameters for getting registrations
  getRegistrations: Joi.object({
    eventId: Joi.string().hex().length(24).optional(),
    userId: Joi.string().hex().length(24).optional(),
    teamId: Joi.string().hex().length(24).optional(),
    status: Joi.string()
      .valid("pending", "confirmed", "cancelled", "checked_in", "waitlisted")
      .optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(200).default(50),
    sort: Joi.string()
      .valid("registeredAt", "-registeredAt", "checkInTime", "-checkInTime")
      .default("-registeredAt"),
  }),

  // Registration ID parameter
  registrationId: Joi.object({
    registrationId: Joi.string().hex().length(24).required().messages({
      "string.hex": "Invalid registration ID format",
      "string.length": "Invalid registration ID format",
      "any.required": "Registration ID is required",
    }),
  }),

  // Bulk operations
  bulkUpdateStatus: Joi.object({
    registrationIds: Joi.array()
      .items(Joi.string().hex().length(24))
      .min(1)
      .max(100)
      .required()
      .messages({
        "array.min": "At least one registration ID is required",
        "array.max": "Cannot update more than 100 registrations at once",
        "any.required": "Registration IDs are required",
      }),
    status: Joi.string()
      .valid("confirmed", "cancelled", "checked_in", "waitlisted")
      .required(),
  }),

  // Check-in
  checkin: Joi.object({
    registrationId: Joi.string().hex().length(24).required(),
  }),

  // Self check-in with QR code
  selfCheckin: Joi.object({
    eventId: Joi.string().hex().length(24).required(),
    qrCode: Joi.string().required().messages({
      "any.required": "QR code is required",
    }),
  }),
};

module.exports = registrationValidation;
