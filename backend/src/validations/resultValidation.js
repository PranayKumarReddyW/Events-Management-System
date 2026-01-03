const Joi = require("joi");

/**
 * Validation schemas for result-related operations
 */

const resultValidation = {
  // Add results
  addResults: Joi.object({
    eventId: Joi.string().hex().length(24).required().messages({
      "string.hex": "Invalid event ID format",
      "string.length": "Invalid event ID format",
      "any.required": "Event ID is required",
    }),
    results: Joi.array()
      .items(
        Joi.object({
          position: Joi.number()
            .integer()
            .min(1)
            .max(1000)
            .required()
            .messages({
              "number.base": "Position must be a number",
              "number.min": "Position must be at least 1",
              "number.max": "Position cannot exceed 1000",
              "any.required": "Position is required",
            }),
          userId: Joi.string().hex().length(24).optional(),
          teamId: Joi.string().hex().length(24).optional(),
          score: Joi.number().min(0).optional(),
          remarks: Joi.string().max(500).optional().allow(""),
        }).custom((value, helpers) => {
          // At least one of userId or teamId must be present
          if (!value.userId && !value.teamId) {
            return helpers.error("object.missingUserOrTeam");
          }

          // Cannot have both userId and teamId
          if (value.userId && value.teamId) {
            return helpers.error("object.bothUserAndTeam");
          }

          return value;
        }, "User or Team validation")
      )
      .min(1)
      .max(1000)
      .required()
      .messages({
        "array.min": "At least one result is required",
        "array.max": "Cannot add more than 1000 results at once",
        "any.required": "Results array is required",
        "object.missingUserOrTeam": "Either userId or teamId must be provided",
        "object.bothUserAndTeam": "Cannot specify both userId and teamId",
      }),
  }),

  // Publish results
  publishResults: Joi.object({
    eventId: Joi.string().hex().length(24).required().messages({
      "string.hex": "Invalid event ID format",
      "string.length": "Invalid event ID format",
      "any.required": "Event ID is required",
    }),
  }),

  // Query parameters for getting results
  getResults: Joi.object({
    eventId: Joi.string().hex().length(24).required(),
    published: Joi.boolean().optional(),
  }),

  // Result ID parameter
  resultId: Joi.object({
    eventId: Joi.string().hex().length(24).required(),
    resultId: Joi.string().hex().length(24).required(),
  }),

  // Update single result
  updateResult: Joi.object({
    position: Joi.number().integer().min(1).max(1000).optional(),
    score: Joi.number().min(0).optional(),
    remarks: Joi.string().max(500).optional().allow(""),
  }).min(1), // At least one field must be updated
};

module.exports = resultValidation;
