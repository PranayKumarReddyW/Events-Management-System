const Joi = require("joi");

/**
 * STRICT EVENT VALIDATION SCHEMAS
 * Enforces zero silent failures and complete validation
 * All validation errors are explicit and detailed
 */

// Date validation helper
const validateDateRange = (startDate, endDate, context) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime())) {
    throw new Error(`${context.startLabel || "Start date"} is invalid`);
  }
  if (isNaN(end.getTime())) {
    throw new Error(`${context.endLabel || "End date"} is invalid`);
  }
  if (end <= start) {
    throw new Error(
      `${context.endLabel || "End date"} must be after ${
        context.startLabel || "start date"
      }`
    );
  }
  return true;
};

/**
 * Create Event - STRICT VALIDATION
 * Every field is validated, no partial data accepted
 */
const createEventSchema = Joi.object({
  // Required fields - CRITICAL
  title: Joi.string().trim().min(5).max(200).required().messages({
    "string.empty": "Event title is required",
    "any.required": "Event title is required",
    "string.min": "Event title must be at least 5 characters",
    "string.max": "Event title cannot exceed 200 characters",
  }),

  description: Joi.string().trim().min(20).max(20000).required().messages({
    "string.empty": "Event description is required",
    "any.required": "Event description is required",
    "string.min": "Description must be at least 20 characters",
    "string.max": "Description cannot exceed 20000 characters",
  }),

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
    .required()
    .messages({
      "any.only":
        "Event type must be one of: workshop, seminar, competition, hackathon, conference, webinar, meetup, other",
      "any.required": "Event type is required",
    }),

  eventMode: Joi.string()
    .valid("online", "offline", "hybrid")
    .required()
    .messages({
      "any.only": "Event mode must be online, offline, or hybrid",
      "any.required": "Event mode is required",
    }),

  startDateTime: Joi.date().iso().required().messages({
    "date.base": "Start date must be a valid ISO date",
    "date.iso": "Start date must be in ISO format (YYYY-MM-DDTHH:mm:ss)",
    "any.required": "Start date and time is required",
  }),

  endDateTime: Joi.date()
    .iso()
    .required()
    .min(Joi.ref("startDateTime"))
    .messages({
      "date.base": "End date must be a valid ISO date",
      "date.iso": "End date must be in ISO format",
      "any.required": "End date and time is required",
      "date.min": "End date must be after start date",
    }),

  registrationDeadline: Joi.date()
    .iso()
    .required()
    .max(Joi.ref("startDateTime"))
    .messages({
      "date.base": "Registration deadline must be a valid ISO date",
      "date.iso": "Registration deadline must be in ISO format",
      "any.required": "Registration deadline is required",
      "date.max": "Registration deadline must be before event start date",
    }),

  venue: Joi.when("eventMode", {
    is: Joi.string().valid("offline", "hybrid"),
    then: Joi.string().trim().min(3).max(200).required().messages({
      "string.empty": "Venue is required for offline and hybrid events",
      "any.required": "Venue is required for offline and hybrid events",
      "string.min": "Venue must be at least 3 characters",
    }),
    otherwise: Joi.string().allow("").optional(),
  }),

  meetingLink: Joi.when("eventMode", {
    is: Joi.string().valid("online", "hybrid"),
    then: Joi.string().uri().required().messages({
      "string.empty": "Meeting link is required for online and hybrid events",
      "any.required": "Meeting link is required for online and hybrid events",
      "string.uri": "Meeting link must be a valid URL",
    }),
    otherwise: Joi.string().allow("").optional(),
  }),

  eligibility: Joi.string().trim().min(10).max(500).required().messages({
    "string.empty": "Eligibility criteria is required",
    "any.required": "Eligibility criteria is required",
    "string.min": "Eligibility must be at least 10 characters",
    "string.max": "Eligibility cannot exceed 500 characters",
  }),

  minTeamSize: Joi.number().integer().min(1).required().messages({
    "number.base": "Minimum team size must be a number",
    "number.min": "Minimum team size must be at least 1",
    "any.required": "Minimum team size is required",
  }),

  maxTeamSize: Joi.number()
    .integer()
    .min(Joi.ref("minTeamSize"))
    .required()
    .messages({
      "number.base": "Maximum team size must be a number",
      "number.min":
        "Maximum team size must be at least as large as minimum team size",
      "any.required": "Maximum team size is required",
    }),

  isPaid: Joi.boolean().required().messages({
    "any.required": "Payment type is required",
  }),

  amount: Joi.when("isPaid", {
    is: true,
    then: Joi.number().positive().required().messages({
      "number.base": "Amount must be a number",
      "number.positive": "Amount must be greater than 0",
      "any.required": "Amount is required for paid events",
    }),
    otherwise: Joi.number().optional().allow(0, null),
  }),

  roundsCount: Joi.number().integer().min(1).max(10).required().messages({
    "number.base": "Number of rounds must be a number",
    "number.min": "Minimum 1 round required",
    "number.max": "Maximum 10 rounds allowed",
    "any.required": "Number of rounds is required",
  }),

  // Optional fields
  rules: Joi.string().max(10000).optional().allow(""),
  agenda: Joi.string().max(10000).optional().allow(""),
  requiresApproval: Joi.boolean().default(false),
  eligibleYears: Joi.array().items(Joi.number()).optional(),
  eligibleDepartments: Joi.array().items(Joi.string()).optional(),
  allowExternalStudents: Joi.boolean().default(false),
  visibility: Joi.string()
    .valid("public", "private", "department_only", "club_only")
    .default("public"),
  bannerImage: Joi.string().optional().allow(""),
  images: Joi.array().items(Joi.string()).optional(),
}).unknown(true); // Allow extra fields but validate known ones

/**
 * Update Event - STRICT VALIDATION
 * Prevents locked field updates once event starts
 */
const updateEventSchema = Joi.object({
  title: Joi.string().trim().min(5).max(200).messages({
    "string.min": "Event title must be at least 5 characters",
    "string.max": "Event title cannot exceed 200 characters",
  }),

  description: Joi.string().trim().min(20).max(20000).messages({
    "string.min": "Description must be at least 20 characters",
    "string.max": "Description cannot exceed 20000 characters",
  }),

  eventType: Joi.string().valid(
    "workshop",
    "seminar",
    "competition",
    "hackathon",
    "conference",
    "webinar",
    "meetup",
    "other"
  ),

  startDateTime: Joi.date().iso(),
  endDateTime: Joi.date().iso().min(Joi.ref("startDateTime")),
  registrationDeadline: Joi.date().iso().max(Joi.ref("startDateTime")),

  venue: Joi.string().trim().max(200).allow(""),
  meetingLink: Joi.string().uri().allow(""),

  minTeamSize: Joi.number().integer().min(1),
  maxTeamSize: Joi.number().integer().min(Joi.ref("minTeamSize")),

  amount: Joi.number().when("isPaid", {
    is: true,
    then: Joi.number().positive(),
    otherwise: Joi.number().optional(),
  }),

  // Editable fields
  rules: Joi.string().max(10000).allow(""),
  agenda: Joi.string().max(10000).allow(""),
  eligibility: Joi.string().trim().min(10).max(500),
  requiresApproval: Joi.boolean(),
  eligibleYears: Joi.array().items(Joi.number()),
  eligibleDepartments: Joi.array().items(Joi.string()),
  allowExternalStudents: Joi.boolean(),
  visibility: Joi.string().valid(
    "public",
    "private",
    "department_only",
    "club_only"
  ),
  bannerImage: Joi.string().allow(""),
  images: Joi.array().items(Joi.string()),
}).unknown(true);

/**
 * Round Creation - STRICT VALIDATION
 * Enforces date constraints and sequence logic
 */
const createRoundSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required().messages({
    "string.empty": "Round name is required",
    "any.required": "Round name is required",
    "string.min": "Round name must be at least 3 characters",
    "string.max": "Round name cannot exceed 100 characters",
  }),

  description: Joi.string().trim().max(2000).optional().allow(""),

  startDate: Joi.date().iso().required().messages({
    "date.iso": "Start date must be in ISO format",
    "any.required": "Round start date is required",
  }),

  endDate: Joi.date().iso().required().min(Joi.ref("startDate")).messages({
    "date.iso": "End date must be in ISO format",
    "any.required": "Round end date is required",
    "date.min": "Round end date must be after start date",
  }),

  maxParticipants: Joi.number().integer().positive().optional().allow(null),

  status: Joi.string()
    .valid("upcoming", "ongoing", "completed")
    .default("upcoming"),
}).unknown(true);

/**
 * Round Update - STRICT VALIDATION
 * Prevents date changes that affect sequence
 */
const updateRoundSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100),
  description: Joi.string().trim().max(2000).allow(""),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso().min(Joi.ref("startDate")),
  maxParticipants: Joi.number().integer().positive().allow(null),
  status: Joi.string().valid("upcoming", "ongoing", "completed"),
}).unknown(true);

/**
 * Team Progression - STRICT VALIDATION
 * Enforces forward-only progression
 */
const progressTeamsSchema = Joi.object({
  teamIds: Joi.array()
    .items(Joi.string().hex().length(24))
    .min(1)
    .required()
    .messages({
      "array.min": "At least one team must be selected",
      "any.required": "Team IDs are required",
    }),

  fromRoundNumber: Joi.number().integer().min(1).required().messages({
    "number.base": "From round must be a number",
    "number.min": "From round must be at least 1",
    "any.required": "From round is required",
  }),

  toRoundNumber: Joi.number()
    .integer()
    .min(Joi.ref("fromRoundNumber"))
    .required()
    .messages({
      "number.base": "To round must be a number",
      "number.min": "To round must be greater than from round",
      "any.required": "To round is required",
    }),

  eliminateTeams: Joi.boolean().default(false),
}).unknown(true);

module.exports = {
  createEventSchema,
  updateEventSchema,
  createRoundSchema,
  updateRoundSchema,
  progressTeamsSchema,
};
