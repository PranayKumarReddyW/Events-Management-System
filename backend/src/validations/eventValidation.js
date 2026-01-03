const Joi = require("joi");

/**
 * Validation schemas for event-related operations
 */

const eventValidation = {
  // Create event
  createEvent: Joi.object({
    title: Joi.string().min(3).max(200).required().messages({
      "string.min": "Event title must be at least 3 characters",
      "string.max": "Event title cannot exceed 200 characters",
      "any.required": "Event title is required",
    }),
    description: Joi.string().min(10).max(5000).required().messages({
      "string.min": "Description must be at least 10 characters",
      "string.max": "Description cannot exceed 5000 characters",
      "any.required": "Event description is required",
    }),
    eventType: Joi.string()
      .valid("individual", "team", "hybrid")
      .required()
      .messages({
        "any.only": "Event type must be individual, team, or hybrid",
        "any.required": "Event type is required",
      }),
    category: Joi.string()
      .valid(
        "technical",
        "cultural",
        "sports",
        "workshop",
        "seminar",
        "competition",
        "social",
        "other"
      )
      .required()
      .messages({
        "any.only": "Invalid event category",
        "any.required": "Event category is required",
      }),
    startDate: Joi.date().iso().greater("now").required().messages({
      "date.base": "Start date must be a valid date",
      "date.greater": "Start date must be in the future",
      "any.required": "Start date is required",
    }),
    endDate: Joi.date()
      .iso()
      .greater(Joi.ref("startDate"))
      .required()
      .messages({
        "date.base": "End date must be a valid date",
        "date.greater": "End date must be after start date",
        "any.required": "End date is required",
      }),
    venue: Joi.string().min(2).max(200).required().messages({
      "string.min": "Venue must be at least 2 characters",
      "string.max": "Venue cannot exceed 200 characters",
      "any.required": "Venue is required",
    }),
    maxParticipants: Joi.number()
      .integer()
      .min(1)
      .max(10000)
      .required()
      .messages({
        "number.base": "Max participants must be a number",
        "number.min": "Max participants must be at least 1",
        "number.max": "Max participants cannot exceed 10000",
        "any.required": "Max participants is required",
      }),
    minTeamSize: Joi.number()
      .integer()
      .min(1)
      .max(50)
      .optional()
      .when("eventType", {
        is: Joi.string().valid("team", "hybrid"),
        then: Joi.required(),
      }),
    maxTeamSize: Joi.number()
      .integer()
      .min(Joi.ref("minTeamSize"))
      .max(50)
      .optional()
      .when("eventType", {
        is: Joi.string().valid("team", "hybrid"),
        then: Joi.required(),
      }),
    registrationStartDate: Joi.date().iso().optional(),
    registrationEndDate: Joi.date()
      .iso()
      .greater(Joi.ref("registrationStartDate"))
      .less(Joi.ref("startDate"))
      .optional(),
    registrationFee: Joi.number().min(0).max(100000).default(0),
    requiresPayment: Joi.boolean().default(false),
    clubId: Joi.string().hex().length(24).optional(),
    department: Joi.string().hex().length(24).optional(),
    tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
    bannerImage: Joi.string().uri().optional().allow(""),
    rulesAndRegulations: Joi.string().max(5000).optional().allow(""),
    prizes: Joi.array()
      .items(
        Joi.object({
          position: Joi.number().integer().min(1).required(),
          prize: Joi.string().max(200).required(),
          amount: Joi.number().min(0).optional(),
        })
      )
      .max(20)
      .optional(),
    contactInfo: Joi.object({
      name: Joi.string().max(100).optional(),
      email: Joi.string().email().optional(),
      phone: Joi.string()
        .pattern(/^[0-9]{10}$/)
        .optional(),
    }).optional(),
  }),

  // Update event
  updateEvent: Joi.object({
    title: Joi.string().min(3).max(200).optional(),
    description: Joi.string().min(10).max(5000).optional(),
    startDate: Joi.date().iso().greater("now").optional(),
    endDate: Joi.date().iso().greater(Joi.ref("startDate")).optional(),
    venue: Joi.string().min(2).max(200).optional(),
    maxParticipants: Joi.number().integer().min(1).max(10000).optional(),
    minTeamSize: Joi.number().integer().min(1).max(50).optional(),
    maxTeamSize: Joi.number()
      .integer()
      .min(Joi.ref("minTeamSize"))
      .max(50)
      .optional(),
    registrationStartDate: Joi.date().iso().optional(),
    registrationEndDate: Joi.date().iso().optional(),
    registrationFee: Joi.number().min(0).max(100000).optional(),
    bannerImage: Joi.string().uri().optional().allow(""),
    rulesAndRegulations: Joi.string().max(5000).optional().allow(""),
    tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
    prizes: Joi.array()
      .items(
        Joi.object({
          position: Joi.number().integer().min(1).required(),
          prize: Joi.string().max(200).required(),
          amount: Joi.number().min(0).optional(),
        })
      )
      .max(20)
      .optional(),
    contactInfo: Joi.object({
      name: Joi.string().max(100).optional(),
      email: Joi.string().email().optional(),
      phone: Joi.string()
        .pattern(/^[0-9]{10}$/)
        .optional(),
    }).optional(),
  }).min(1), // At least one field must be updated

  // Query parameters for getting events
  getEvents: Joi.object({
    status: Joi.string()
      .valid("draft", "pending_approval", "published", "cancelled", "completed")
      .optional(),
    eventType: Joi.string().valid("individual", "team", "hybrid").optional(),
    category: Joi.string()
      .valid(
        "technical",
        "cultural",
        "sports",
        "workshop",
        "seminar",
        "competition",
        "social",
        "other"
      )
      .optional(),
    search: Joi.string().max(200).optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    department: Joi.string().hex().length(24).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string()
      .valid(
        "startDate",
        "-startDate",
        "createdAt",
        "-createdAt",
        "title",
        "-title"
      )
      .default("-createdAt"),
  }),

  // Approve/Reject event
  processApproval: Joi.object({
    status: Joi.string().valid("approved", "rejected").required().messages({
      "any.only": "Status must be either approved or rejected",
      "any.required": "Status is required",
    }),
    remarks: Joi.string().max(1000).optional().allow(""),
  }),

  // Event ID parameter
  eventId: Joi.object({
    eventId: Joi.string().hex().length(24).required().messages({
      "string.hex": "Invalid event ID format",
      "string.length": "Invalid event ID format",
      "any.required": "Event ID is required",
    }),
  }),
};

module.exports = eventValidation;
