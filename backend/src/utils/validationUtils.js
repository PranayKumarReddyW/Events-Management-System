const { AppError } = require("../middleware/strictErrorHandler");
const logger = require("./logger");

/**
 * VALIDATION UTILITY FUNCTIONS
 * Production-grade validation with zero silent failures
 */

/**
 * Format validation errors from Joi into field-level messages
 * @param {Object} joiError - Joi validation error
 * @returns {Object} - Formatted errors object
 */
function formatValidationErrors(joiError) {
  const errors = {};

  if (!joiError || !joiError.details) {
    return errors;
  }

  joiError.details.forEach((detail) => {
    const field = detail.path.join(".");
    const message = detail.message.replace(/"/g, "");

    // Accumulate multiple errors per field
    if (errors[field]) {
      errors[field] = Array.isArray(errors[field])
        ? [...errors[field], message]
        : [errors[field], message];
    } else {
      errors[field] = message;
    }
  });

  return errors;
}

/**
 * Validate request body against schema
 * Throws AppError with field-level messages if validation fails
 * @param {Object} data - Data to validate
 * @param {Object} schema - Joi schema
 * @throws {AppError} - Validation error with details
 * @returns {Object} - Validated data
 */
function validateWithSchema(data, schema) {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: false,
    convert: true,
  });

  if (error) {
    const formattedErrors = formatValidationErrors(error);
    logger.warn(`[VALIDATION FAILED]`, {
      errors: formattedErrors,
      data,
    });

    throw new AppError("Validation failed", 422, formattedErrors);
  }

  return value;
}

/**
 * Validate event date constraints
 * Ensures startDateTime < endDateTime < registrationDeadline
 * @param {Date|string} startDateTime
 * @param {Date|string} endDateTime
 * @param {Date|string} registrationDeadline
 * @throws {AppError} - If validation fails
 */
function validateEventDateConstraints(
  startDateTime,
  endDateTime,
  registrationDeadline
) {
  const errors = {};

  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  const regDeadline = new Date(registrationDeadline);

  // Validate ISO dates
  if (isNaN(start.getTime())) {
    errors.startDateTime = "Start date must be a valid ISO date";
  }
  if (isNaN(end.getTime())) {
    errors.endDateTime = "End date must be a valid ISO date";
  }
  if (isNaN(regDeadline.getTime())) {
    errors.registrationDeadline =
      "Registration deadline must be a valid ISO date";
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError("Date validation failed", 422, { errors });
  }

  // Validate sequence
  if (end <= start) {
    errors.endDateTime = "End date must be after start date";
  }
  if (regDeadline >= start) {
    errors.registrationDeadline =
      "Registration deadline must be before event start date";
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError("Date constraint validation failed", 422, { errors });
  }
}

/**
 * Validate round date constraints within event
 * Ensures: event.start <= round.start < round.end <= event.end
 * @param {Date|string} eventStart
 * @param {Date|string} eventEnd
 * @param {Date|string} roundStart
 * @param {Date|string} roundEnd
 * @throws {AppError} - If validation fails
 */
function validateRoundDateConstraints(
  eventStart,
  eventEnd,
  roundStart,
  roundEnd
) {
  const errors = {};

  const eStart = new Date(eventStart);
  const eEnd = new Date(eventEnd);
  const rStart = new Date(roundStart);
  const rEnd = new Date(roundEnd);

  // Validate ISO dates
  if (isNaN(rStart.getTime())) {
    errors.startDate = "Round start date must be a valid ISO date";
  }
  if (isNaN(rEnd.getTime())) {
    errors.endDate = "Round end date must be a valid ISO date";
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError("Round date format validation failed", 422, { errors });
  }

  // Validate within event duration
  if (rStart < eStart) {
    errors.startDate = `Round start date must be within event duration (event starts at ${eStart.toISOString()})`;
  }
  if (rEnd > eEnd) {
    errors.endDate = `Round end date must be within event duration (event ends at ${eEnd.toISOString()})`;
  }
  if (rEnd <= rStart) {
    errors.endDate = "Round end date must be after round start date";
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError("Round date constraint validation failed", 422, {
      errors,
    });
  }
}

/**
 * Validate team size constraints
 * @param {number} minSize
 * @param {number} maxSize
 * @throws {AppError} - If validation fails
 */
function validateTeamSizeConstraints(minSize, maxSize) {
  const errors = {};

  if (!Number.isInteger(minSize) || minSize < 1) {
    errors.minTeamSize = "Minimum team size must be an integer >= 1";
  }
  if (!Number.isInteger(maxSize) || maxSize < 1) {
    errors.maxTeamSize = "Maximum team size must be an integer >= 1";
  }
  if (maxSize < minSize) {
    errors.maxTeamSize =
      "Maximum team size must be greater than or equal to minimum team size";
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError("Team size validation failed", 422, { errors });
  }
}

/**
 * Validate payment constraints
 * If event is paid, amount must be > 0
 * @param {boolean} isPaid
 * @param {number} amount
 * @throws {AppError} - If validation fails
 */
function validatePaymentConstraints(isPaid, amount) {
  const errors = {};

  if (isPaid) {
    if (typeof amount !== "number" || amount <= 0) {
      errors.amount = "Amount must be a positive number for paid events";
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError("Payment validation failed", 422, { errors });
  }
}

/**
 * Validate round progression
 * - Cannot skip rounds
 * - Can only progress forward
 * - Cannot move teams beyond total rounds
 * @param {number} fromRound
 * @param {number} toRound
 * @param {number} totalRounds
 * @throws {AppError} - If validation fails
 */
function validateRoundProgression(fromRound, toRound, totalRounds) {
  const errors = {};

  if (fromRound < 1 || fromRound > totalRounds) {
    errors.fromRoundNumber = `From round must be between 1 and ${totalRounds}`;
  }
  if (toRound < 1 || toRound > totalRounds) {
    errors.toRoundNumber = `To round must be between 1 and ${totalRounds}`;
  }
  if (toRound <= fromRound) {
    errors.toRoundNumber = "To round must be after from round";
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError("Round progression validation failed", 422, { errors });
  }
}

/**
 * Check if event is locked (started or completed)
 * @param {string} eventStatus
 * @returns {boolean}
 */
function isEventLocked(eventStatus) {
  return (
    eventStatus === "ongoing" ||
    eventStatus === "completed" ||
    eventStatus === "cancelled"
  );
}

/**
 * Get list of locked fields for an event
 * @param {string} eventStatus
 * @returns {Array} - List of field names that cannot be edited
 */
function getLockedFields(eventStatus) {
  if (isEventLocked(eventStatus)) {
    return [
      "title",
      "eventType",
      "startDateTime",
      "endDateTime",
      "minTeamSize",
      "maxTeamSize",
      "isPaid",
      "amount",
      "roundsCount",
      "eligibility",
      "eligibleYears",
      "eligibleDepartments",
    ];
  }
  return [];
}

/**
 * Validate that locked fields are not being updated
 * @param {Array} lockedFields
 * @param {Object} updateData
 * @throws {AppError} - If locked field is being updated
 */
function validateLockedFields(lockedFields, updateData) {
  const attemptedUpdates = lockedFields.filter((field) =>
    Object.prototype.hasOwnProperty.call(updateData, field)
  );

  if (attemptedUpdates.length > 0) {
    const errors = {};
    attemptedUpdates.forEach((field) => {
      errors[field] = `Cannot update ${field} once event has started`;
    });

    throw new AppError("Cannot update locked fields", 403, { errors });
  }
}

/**
 * Validate required fields are present
 * @param {Object} data
 * @param {Array} requiredFields
 * @throws {AppError} - If any required field is missing
 */
function validateRequiredFields(data, requiredFields) {
  const errors = {};
  const missing = [];

  requiredFields.forEach((field) => {
    const value = data[field];
    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && !value.trim())
    ) {
      missing.push(field);
      errors[field] = `${field} is required`;
    }
  });

  if (missing.length > 0) {
    logger.warn(`[MISSING REQUIRED FIELDS]`, { missing, data });
    throw new AppError("Missing required fields", 422, { errors });
  }
}

module.exports = {
  formatValidationErrors,
  validateWithSchema,
  validateEventDateConstraints,
  validateRoundDateConstraints,
  validateTeamSizeConstraints,
  validatePaymentConstraints,
  validateRoundProgression,
  isEventLocked,
  getLockedFields,
  validateLockedFields,
  validateRequiredFields,
};
