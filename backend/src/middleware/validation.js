const { validationResult } = require("express-validator");
const Joi = require("joi");

// Express Validator error handler
exports.handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((err) => ({
        field: err.param,
        message: err.msg,
        value: err.value,
      })),
    });
  }

  next();
};

// Joi validation middleware factory
exports.validateSchema = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      // Create more user-friendly error messages
      const errors = error.details.map((detail) => {
        let message = detail.message;
        // Remove Joi-specific wording for better UX
        message = message.replace(/"/g, "");

        return {
          field: detail.path.join("."),
          message: message,
          type: detail.type,
        };
      });

      // Use first error message as main message for better UX
      const mainMessage = errors[0]?.message || "Validation failed";

      return res.status(400).json({
        success: false,
        message: mainMessage,
        errors: errors,
      });
    }

    req.validatedData = value;
    next();
  };
};

// Backwards-compatible alias used in several routes
exports.validate = exports.validateSchema;

// Common validation schemas
exports.schemas = {
  // User schemas
  userRegister: Joi.object({
    fullName: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    phone: Joi.string()
      .pattern(/^[0-9]{10}$/)
      .optional()
      .allow("", null),
    role: Joi.string()
      .valid(
        "student",
        "department_organizer",
        "faculty",
        "admin",
        "super_admin"
      )
      .optional(),
    departmentId: Joi.string().hex().length(24).optional().allow("", null),
    yearOfStudy: Joi.number().min(1).max(5).optional().allow(null),
    rollNumber: Joi.string().optional().allow("", null),
  }),

  userLogin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  // Event schemas
  eventCreate: Joi.object({
    title: Joi.string().min(3).max(200).required(),
    description: Joi.string().min(10).max(5000).required(),
    rules: Joi.string().max(2000).optional(),
    registrationDeadline: Joi.date().required(),
    startDateTime: Joi.date().required(),
    endDateTime: Joi.date().required(),
    venue: Joi.string().max(200).optional(),
    eventMode: Joi.string().valid("online", "offline", "hybrid").required(),
    meetingLink: Joi.string().uri().optional(),
    eventType: Joi.string()
      .valid(
        "workshop",
        "seminar",
        "competition",
        "hackathon",
        "conference",
        "webinar",
        "meetup",
        "other"
      )
      .required(),
    minTeamSize: Joi.number().min(1).default(1),
    maxTeamSize: Joi.number().min(1).default(1),
    isPaid: Joi.boolean().default(false),
    amount: Joi.number()
      .min(0)
      .when("isPaid", { is: true, then: Joi.required() }),
    eligibility: Joi.string().max(500).optional(),
    maxParticipants: Joi.number().min(1).optional(),
    category: Joi.string()
      .valid(
        "technical",
        "non-technical",
        "cultural",
        "sports",
        "academic",
        "other"
      )
      .optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    agenda: Joi.string().max(3000).optional(),
    clubId: Joi.string().hex().length(24).optional(),
    departmentId: Joi.string().hex().length(24).optional(),
    visibility: Joi.string()
      .valid("public", "private", "department_only", "club_only")
      .default("public"),
    certificateProvided: Joi.boolean().default(false),
  }),

  // Registration schemas
  eventRegister: Joi.object({
    registrationType: Joi.string().valid("individual", "team").required(),
    teamId: Joi.string()
      .hex()
      .length(24)
      .when("registrationType", { is: "team", then: Joi.required() }),
    emergencyContact: Joi.object({
      name: Joi.string().max(100).optional(),
      phone: Joi.string().max(30).optional(),
      relationship: Joi.string().max(50).optional(),
    }).optional(),
    specialRequirements: Joi.string().max(2000).optional(),
    participantInfo: Joi.object().unknown(true).optional(),
  }),

  // Team schemas
  teamCreate: Joi.object({
    eventId: Joi.string().hex().length(24).required(),
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().max(2000).optional(),
    maxSize: Joi.number().min(1).optional(),
  }),

  // Payment schemas
  paymentInitiate: Joi.object({
    eventId: Joi.string().hex().length(24).required(),
    registrationId: Joi.string().hex().length(24).required(),
    paymentGateway: Joi.string().valid("razorpay", "stripe").required(),
  }),

  // Feedback schemas
  feedbackCreate: Joi.object({
    eventId: Joi.string().hex().length(24).required(),
    overallRating: Joi.number().min(1).max(5).required(),
    contentQuality: Joi.number().min(1).max(5).optional(),
    organizationRating: Joi.number().min(1).max(5).optional(),
    venueRating: Joi.number().min(1).max(5).optional(),
    speakerRating: Joi.number().min(1).max(5).optional(),
    comment: Joi.string().max(2000).optional(),
    suggestions: Joi.string().max(2000).optional(),
    wouldRecommend: Joi.boolean().optional(),
    anonymous: Joi.boolean().default(false),
    // Backwards-compatible alias
    isAnonymous: Joi.boolean().optional(),
  }),

  // Certificate schemas
  certificateGenerate: Joi.object({
    eventId: Joi.string().hex().length(24).required(),
    userId: Joi.string().hex().length(24).required(),
    registrationId: Joi.string().hex().length(24).required(),
    type: Joi.string().valid("participation", "winner").required(),
    position: Joi.number().min(1).optional(),
  }),

  // Notification schemas
  notificationCreate: Joi.object({
    recipients: Joi.alternatives()
      .try(
        Joi.string().valid("all"),
        Joi.array().items(Joi.string().hex().length(24)).min(1),
        Joi.string().hex().length(24)
      )
      .required(),
    title: Joi.string().min(1).max(200).required(),
    message: Joi.string().min(1).max(2000).required(),
    type: Joi.string().min(1).max(50).required(),
    relatedEvent: Joi.string().hex().length(24).optional(),
    channels: Joi.array()
      .items(Joi.string().valid("in_app", "email", "sms", "push"))
      .min(1)
      .optional(),
    priority: Joi.string().valid("low", "normal", "high").optional(),
    scheduledFor: Joi.date().optional(),
  }),

  // Aliases used by route files
  registration: Joi.object({
    eventId: Joi.string().hex().length(24).required(),
    teamId: Joi.string().hex().length(24).optional(),
    emergencyContact: Joi.object({
      name: Joi.string().max(100).optional(),
      phone: Joi.string().max(30).optional(),
      relationship: Joi.string().max(50).optional(),
    }).optional(),
    specialRequirements: Joi.string().max(2000).optional(),
    participantInfo: Joi.object().unknown(true).optional(),
  }),
  team: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    eventId: Joi.string().hex().length(24).required(),
    description: Joi.string().max(2000).optional(),
  }),
  payment: Joi.object({
    registrationId: Joi.string().hex().length(24).required(),
    paymentMethod: Joi.string().valid("stripe", "razorpay").optional(),
  }),
  feedback: Joi.object({
    eventId: Joi.string().hex().length(24).required(),
    overallRating: Joi.number().min(1).max(5).required(),
    contentQuality: Joi.number().min(1).max(5).optional(),
    organizationRating: Joi.number().min(1).max(5).optional(),
    venueRating: Joi.number().min(1).max(5).optional(),
    speakerRating: Joi.number().min(1).max(5).optional(),
    comment: Joi.string().max(2000).optional(),
    suggestions: Joi.string().max(2000).optional(),
    wouldRecommend: Joi.boolean().optional(),
    anonymous: Joi.boolean().default(false),
    // Backwards-compatible alias
    isAnonymous: Joi.boolean().optional(),
  }),
  notification: Joi.object({
    recipients: Joi.alternatives()
      .try(
        Joi.string().valid("all"),
        Joi.array().items(Joi.string().hex().length(24)).min(1),
        Joi.string().hex().length(24)
      )
      .required(),
    title: Joi.string().min(1).max(200).required(),
    message: Joi.string().min(1).max(2000).required(),
    type: Joi.string().min(1).max(50).required(),
    relatedEvent: Joi.string().hex().length(24).optional(),
    channels: Joi.array()
      .items(Joi.string().valid("in_app", "email", "sms", "push"))
      .min(1)
      .optional(),
    priority: Joi.string().valid("low", "normal", "high").optional(),
    scheduledFor: Joi.date().optional(),
  }),
};

// Sanitize input
exports.sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj !== "object" || obj === null) return obj;

    for (let key in obj) {
      if (typeof obj[key] === "string") {
        // Remove script tags and potentially harmful content
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .trim();
      } else if (typeof obj[key] === "object") {
        sanitize(obj[key]);
      }
    }
    return obj;
  };

  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);

  next();
};
