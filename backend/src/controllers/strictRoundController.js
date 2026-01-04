/**
 * STRICT ROUND CONTROLLER
 * Production-grade implementation with complete round logic
 * Enforces:
 * - Date constraints (within event duration)
 * - Sequential progression (no skipping)
 * - No overlapping rounds
 * - Forward-only team progression
 */

const Event = require("../models/Event");
const Team = require("../models/Team");
const { AppError, asyncHandler } = require("../middleware/strictErrorHandler");
const logger = require("../utils/logger");
const { getRedisClient } = require("../config/redis");

const {
  createRoundSchema,
  updateRoundSchema,
  progressTeamsSchema,
} = require("../validations/strictEventValidation");

const {
  validateWithSchema,
  validateRoundDateConstraints,
  validateRoundProgression,
  isEventLocked,
} = require("../utils/validationUtils");

/**
 * CREATE ROUND - STRICT VALIDATION
 * Enforces:
 * - ALL required fields must be present (roundName, roundStartDate, roundEndDate, eventId)
 * - Round dates within event duration
 * - Sequential numbering (no gaps)
 * - No overlapping rounds
 * - Cannot exceed max rounds
 * - Clear, context-aware error messages with event timing
 */
exports.createRound = asyncHandler(async (req, res, next) => {
  const { eventId } = req.params;

  logger.info(`[CREATE ROUND] Creating round for event ${eventId}`);
  logger.debug(`[CREATE ROUND] Request body:`, {
    roundName: req.body.roundName,
    roundDescription: req.body.roundDescription,
    roundStartDate: req.body.roundStartDate,
    roundEndDate: req.body.roundEndDate,
    roundMaxParticipants: req.body.roundMaxParticipants,
    status: req.body.status,
  });
  logger.debug(`[CREATE ROUND] User:`, {
    userId: req.user._id,
    role: req.user.role,
  });

  try {
    // STEP 1: FIND EVENT
    const event = await Event.findById(eventId);
    if (!event) {
      logger.warn(`[CREATE ROUND] Event not found`, { eventId });
      throw new AppError("Event not found", 404);
    }
    logger.debug(`[CREATE ROUND] Event found: ${event.title}`);

    // STEP 2: CHECK AUTHORIZATION
    const isAuthorized =
      event.organizerId.toString() === req.user._id.toString() ||
      req.user.role === "admin" ||
      req.user.role === "super_admin";

    if (!isAuthorized) {
      logger.warn(`[CREATE ROUND] Unauthorized round creation attempt`, {
        eventId,
        userId: req.user._id,
      });
      throw new AppError("Not authorized to modify this event", 403);
    }

    // STEP 3: VALIDATE SCHEMA (STRICT - all required fields must be present)
    let roundData;
    try {
      roundData = validateWithSchema(req.body, createRoundSchema);
      logger.info(`[CREATE ROUND] Schema validation passed`);
      logger.debug(`[CREATE ROUND] Validated round data:`, roundData);
    } catch (validationError) {
      logger.warn(`[CREATE ROUND] Schema validation failed`, {
        message: validationError.message,
        statusCode: validationError.statusCode,
        errors: validationError.details,
      });
      throw validationError;
    }

    // STEP 4: CHECK ROUND LIMIT
    if (event.roundsCount && event.rounds.length >= event.roundsCount) {
      const errors = {
        roundsCount: `Event has a maximum of ${event.roundsCount} rounds`,
      };
      logger.warn(`[CREATE ROUND] Maximum rounds exceeded`, { eventId });
      throw new AppError("Maximum rounds exceeded", 400, errors);
    }
    logger.debug(`[CREATE ROUND] Round limit check passed`);

    // STEP 5: STRICT DATE VALIDATION (dates are now REQUIRED, not optional)
    logger.debug(`[CREATE ROUND] Validating REQUIRED round dates`, {
      roundStartDate: roundData.roundStartDate,
      roundEndDate: roundData.roundEndDate,
    });

    const eventStart = new Date(event.startDateTime);
    const eventEnd = new Date(event.endDateTime);
    const roundStart = new Date(roundData.roundStartDate);
    const roundEnd = new Date(roundData.roundEndDate);

    // STEP 5A: Validate date formats
    if (isNaN(roundStart.getTime())) {
      const errors = {
        roundStartDate: "Round start date must be a valid ISO date",
      };
      logger.warn(`[CREATE ROUND] Invalid round start date format`, {
        eventId,
      });
      throw new AppError("Invalid round start date", 400, errors);
    }

    if (isNaN(roundEnd.getTime())) {
      const errors = {
        roundEndDate: "Round end date must be a valid ISO date",
      };
      logger.warn(`[CREATE ROUND] Invalid round end date format`, { eventId });
      throw new AppError("Invalid round end date", 400, errors);
    }

    // STEP 5B: Check round start is NOT before event start
    if (roundStart < eventStart) {
      const errors = {
        roundStartDate: `Round start time cannot be before the event start time. Event runs from ${eventStart.toISOString()} to ${eventEnd.toISOString()}`,
      };
      logger.warn(`[CREATE ROUND] Round starts before event`, {
        eventId,
        roundStart,
        eventStart,
      });
      throw new AppError("Invalid round start date", 400, errors);
    }

    // STEP 5C: Check round end is NOT after event end
    if (roundEnd > eventEnd) {
      const errors = {
        roundEndDate: `Round end time cannot exceed the event end time. Event ends at ${eventEnd.toISOString()}`,
      };
      logger.warn(`[CREATE ROUND] Round ends after event`, {
        eventId,
        roundEnd,
        eventEnd,
      });
      throw new AppError("Invalid round end date", 400, errors);
    }

    // STEP 5D: Check round end is after round start
    if (roundEnd <= roundStart) {
      const errors = {
        roundEndDate: "Round end time must be after round start time",
      };
      logger.warn(`[CREATE ROUND] Round end not after round start`, {
        eventId,
        roundStart,
        roundEnd,
      });
      throw new AppError("Invalid round timing", 400, errors);
    }

    // STEP 5E: SEQUENTIAL RULES - subsequent rounds must start AFTER previous round ends
    if (event.rounds.length > 0) {
      const previousRound = event.rounds[event.rounds.length - 1];
      const prevRoundEnd = new Date(previousRound.endDate);

      // NEW ROUND START MUST BE STRICTLY AFTER PREVIOUS ROUND END
      if (roundStart <= prevRoundEnd) {
        const errors = {
          roundStartDate: `Round ${
            event.rounds.length + 1
          } must start after Round ${
            event.rounds.length
          } ends at ${prevRoundEnd.toISOString()}`,
        };
        logger.warn(
          `[CREATE ROUND] Sequential rule violation: new round starts before/at previous round end`,
          { eventId, previousRoundEnd: prevRoundEnd, roundStart }
        );
        throw new AppError("Invalid round timing", 400, errors);
      }

      logger.debug(`[CREATE ROUND] Sequential rule validation passed`);
    }

    // STEP 5F: Check for overlapping rounds with ANY existing round
    const overlappingRound = event.rounds.find((r) => {
      const rStart = new Date(r.startDate);
      const rEnd = new Date(r.endDate);

      // Overlap check: (roundStart < rEnd && roundEnd > rStart)
      const hasOverlap = roundStart < rEnd && roundEnd > rStart;

      if (hasOverlap) {
        logger.debug(`[CREATE ROUND] Potential overlap detected`, {
          newRound: {
            start: roundStart,
            end: roundEnd,
          },
          existingRound: {
            name: r.name,
            start: rStart,
            end: rEnd,
          },
        });
      }

      return hasOverlap;
    });

    if (overlappingRound) {
      const errors = {
        roundStartDate:
          "This round overlaps with an existing round. Please adjust the timing.",
      };
      logger.warn(`[CREATE ROUND] Overlapping rounds detected`, {
        eventId,
        overlappingRound: overlappingRound.name,
      });
      throw new AppError(
        "Round dates overlap with existing round",
        400,
        errors
      );
    }

    logger.info(`[CREATE ROUND] All date validations passed`, {
      roundStart: roundData.roundStartDate,
      roundEnd: roundData.roundEndDate,
    });

    // STEP 6: AUTO-ASSIGN ROUND NUMBER (based on existing rounds)
    const nextRoundNumber = event.rounds.length + 1;
    roundData.number = nextRoundNumber;
    roundData.status = roundData.status || "upcoming";

    // Map field names from request format to model format if needed
    if (!roundData.name && roundData.roundName) {
      roundData.name = roundData.roundName;
    }
    if (!roundData.startDate && roundData.roundStartDate) {
      roundData.startDate = roundData.roundStartDate;
    }
    if (!roundData.endDate && roundData.roundEndDate) {
      roundData.endDate = roundData.roundEndDate;
    }
    if (!roundData.maxParticipants && roundData.roundMaxParticipants) {
      roundData.maxParticipants = roundData.roundMaxParticipants;
    }
    if (!roundData.description && roundData.roundDescription) {
      roundData.description = roundData.roundDescription;
    }

    logger.debug(`[CREATE ROUND] Assigned round number: ${nextRoundNumber}`);
    logger.debug(`[CREATE ROUND] Round data before saving:`, roundData);

    // STEP 7: ADD ROUND TO EVENT
    event.rounds.push(roundData);
    logger.debug(
      `[CREATE ROUND] Round pushed to array. Total rounds: ${event.rounds.length}`
    );

    // STEP 8: SAVE EVENT
    const savedEvent = await event.save();
    logger.info(`[CREATE ROUND] Round created successfully`, {
      eventId,
      roundNumber: nextRoundNumber,
      roundName: roundData.name || roundData.roundName,
    });

    // STEP 9: CLEAR CACHE
    const redis = getRedisClient();
    if (redis) {
      await redis.del(`event:${eventId}`);
    }

    // STEP 10: RETURN RESPONSE
    res.status(201).json({
      success: true,
      message: "Round added successfully",
      data: {
        event: savedEvent,
        round: savedEvent.rounds[savedEvent.rounds.length - 1],
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    logger.error(`[CREATE ROUND] Unexpected error`, {
      message: error.message,
      eventId,
      stack: error.stack,
      errorName: error.name,
      body: req.body,
    });

    // Handle Mongoose validation errors
    if (error.name === "ValidationError") {
      const errors = {};
      Object.keys(error.errors).forEach((field) => {
        errors[field] = error.errors[field].message;
      });
      logger.error(`[CREATE ROUND] Validation errors:`, errors);
      throw new AppError("Round validation failed", 422, errors);
    }

    // Handle CastError (invalid ObjectId)
    if (error.name === "CastError") {
      throw new AppError("Invalid event ID format", 400);
    }

    // Return detailed error message
    throw new AppError(`Failed to create round: ${error.message}`, 500);
  }
});

/**
 * UPDATE ROUND - STRICT VALIDATION
 * Prevents date changes that break sequence
 */
exports.updateRound = asyncHandler(async (req, res, next) => {
  const { eventId, roundId } = req.params;

  logger.info(`[UPDATE ROUND] Updating round ${roundId} in event ${eventId}`);

  try {
    // STEP 1: FIND EVENT
    const event = await Event.findById(eventId);
    if (!event) {
      logger.warn(`[UPDATE ROUND] Event not found`, { eventId });
      throw new AppError("Event not found", 404);
    }
    logger.debug(`[UPDATE ROUND] Event found: ${event.title}`);

    // STEP 2: CHECK AUTHORIZATION
    const isAuthorized =
      event.organizerId.toString() === req.user._id.toString() ||
      req.user.role === "admin" ||
      req.user.role === "super_admin";

    if (!isAuthorized) {
      logger.warn(`[UPDATE ROUND] Unauthorized round update attempt`, {
        eventId,
        roundId,
        userId: req.user._id,
      });
      throw new AppError("Not authorized to modify this event", 403);
    }

    // STEP 3: FIND ROUND
    const round = event.rounds.id(roundId);
    if (!round) {
      logger.warn(`[UPDATE ROUND] Round not found`, { eventId, roundId });
      throw new AppError("Round not found", 404);
    }
    logger.debug(`[UPDATE ROUND] Round found: ${round.name}`);

    // STEP 3: VALIDATE SCHEMA
    let updateData;
    try {
      updateData = validateWithSchema(req.body, updateRoundSchema);
      logger.info(`[UPDATE ROUND] Schema validation passed`);
      logger.debug(`[UPDATE ROUND] Validated update data:`, updateData);
    } catch (validationError) {
      logger.warn(`[UPDATE ROUND] Schema validation failed`, {
        message: validationError.message,
        statusCode: validationError.statusCode,
        errors: validationError.details,
      });
      throw validationError;
    }

    // STEP 5: VALIDATE STATUS TRANSITIONS
    if (updateData.status && updateData.status !== round.status) {
      const newStatus = updateData.status;
      const currentStatus = round.status;
      const now = new Date();
      const roundStartDate = new Date(updateData.startDate || round.startDate);
      const roundEndDate = new Date(updateData.endDate || round.endDate);

      // Status hierarchy: upcoming(1) → ongoing(2) → completed(3)
      const statusHierarchy = { upcoming: 1, ongoing: 2, completed: 3 };

      // Cannot revert status backwards
      if (
        statusHierarchy[newStatus] &&
        statusHierarchy[currentStatus] &&
        statusHierarchy[newStatus] < statusHierarchy[currentStatus]
      ) {
        const errors = {
          status: `Cannot revert round status from ${currentStatus} to ${newStatus}. Status can only progress forward.`,
        };
        logger.warn(`[UPDATE ROUND] Status regression attempted`, {
          eventId,
          roundId,
          from: currentStatus,
          to: newStatus,
        });
        throw new AppError("Cannot revert round status", 400, errors);
      }

      // Check time-based constraints
      if (newStatus === "ongoing" && now < roundStartDate) {
        const errors = {
          status: `Cannot set round to ONGOING before its start date (${roundStartDate.toISOString()})`,
        };
        logger.warn(`[UPDATE ROUND] Premature ongoing status`, {
          eventId,
          roundId,
        });
        throw new AppError(
          "Cannot start round before its scheduled time",
          400,
          errors
        );
      }

      if (newStatus === "completed" && now < roundEndDate) {
        const errors = {
          status: `Cannot set round to COMPLETED before its end date (${roundEndDate.toISOString()})`,
        };
        logger.warn(`[UPDATE ROUND] Premature completed status`, {
          eventId,
          roundId,
        });
        throw new AppError(
          "Cannot complete round before its scheduled time",
          400,
          errors
        );
      }

      // Check sequential progression
      if (newStatus === "ongoing") {
        // Check no other round is ongoing
        const otherOngoingRound = event.rounds.find(
          (r) => r._id.toString() !== roundId && r.status === "ongoing"
        );
        if (otherOngoingRound) {
          const errors = {
            status: `Cannot set this round to ONGOING. Round "${otherOngoingRound.name}" is already ongoing. Only one round can be ongoing at a time.`,
          };
          logger.warn(`[UPDATE ROUND] Multiple ongoing rounds detected`, {
            eventId,
            roundId,
            existingRound: otherOngoingRound._id,
          });
          throw new AppError(
            "Only one round can be ongoing at a time",
            400,
            errors
          );
        }

        // Check previous round is completed
        const roundIndex = event.rounds.findIndex(
          (r) => r._id.toString() === roundId
        );
        if (roundIndex > 0) {
          const previousRound = event.rounds[roundIndex - 1];
          if (previousRound.status !== "completed") {
            const errors = {
              status: `Cannot start this round. Previous round "${previousRound.name}" must be completed first (currently: ${previousRound.status}).`,
            };
            logger.warn(`[UPDATE ROUND] Sequential constraint violated`, {
              eventId,
              roundId,
              previousRoundStatus: previousRound.status,
            });
            throw new AppError(
              "Previous round must be completed first",
              400,
              errors
            );
          }
        }
      }
    }

    logger.debug(`[UPDATE ROUND] Status transition validated`);

    // STEP 6: VALIDATE DATE CONSTRAINTS IF BEING UPDATED
    if (
      updateData.startDate ||
      updateData.endDate ||
      updateData.roundStartDate ||
      updateData.roundEndDate
    ) {
      const eventStart = new Date(event.startDateTime);
      const eventEnd = new Date(event.endDateTime);

      // Support both naming conventions
      const newStartDate =
        updateData.startDate || updateData.roundStartDate || round.startDate;
      const newEndDate =
        updateData.endDate || updateData.roundEndDate || round.endDate;

      const roundStart = new Date(newStartDate);
      const roundEnd = new Date(newEndDate);

      // Validate date formats
      if (isNaN(roundStart.getTime())) {
        const errors = {
          startDate: "Round start date must be a valid ISO date",
        };
        throw new AppError("Invalid round start date", 400, errors);
      }
      if (isNaN(roundEnd.getTime())) {
        const errors = {
          endDate: "Round end date must be a valid ISO date",
        };
        throw new AppError("Invalid round end date", 400, errors);
      }

      // Check event boundaries
      if (roundStart < eventStart) {
        const errors = {
          startDate: `Round start time cannot be before the event start time. Event runs from ${eventStart.toISOString()} to ${eventEnd.toISOString()}`,
        };
        throw new AppError("Invalid round start date", 400, errors);
      }

      if (roundEnd > eventEnd) {
        const errors = {
          endDate: `Round end time cannot exceed the event end time. Event ends at ${eventEnd.toISOString()}`,
        };
        throw new AppError("Invalid round end date", 400, errors);
      }

      if (roundEnd <= roundStart) {
        const errors = {
          endDate: "Round end time must be after round start time",
        };
        throw new AppError("Invalid round timing", 400, errors);
      }

      // Check sequential rules with previous round
      const roundIndex = event.rounds.findIndex(
        (r) => r._id.toString() === roundId
      );

      if (roundIndex > 0) {
        const previousRound = event.rounds[roundIndex - 1];
        if (previousRound.endDate) {
          const prevRoundEnd = new Date(previousRound.endDate);
          if (roundStart <= prevRoundEnd) {
            const errors = {
              startDate: `Round ${
                roundIndex + 1
              } must start after Round ${roundIndex} ends at ${prevRoundEnd.toISOString()}`,
            };
            throw new AppError("Invalid round timing", 400, errors);
          }
        }
      }

      // Check sequential rules with next round
      if (roundIndex < event.rounds.length - 1) {
        const nextRound = event.rounds[roundIndex + 1];
        if (nextRound.startDate) {
          const nextRoundStart = new Date(nextRound.startDate);
          if (roundEnd >= nextRoundStart) {
            const errors = {
              endDate: `Round ${roundIndex + 1} must end before Round ${
                roundIndex + 2
              } starts at ${nextRoundStart.toISOString()}`,
            };
            throw new AppError("Invalid round timing", 400, errors);
          }
        }
      }

      // Check for overlaps with other rounds
      const overlappingRound = event.rounds.find((r) => {
        if (r._id.toString() === roundId) {
          return false; // Skip self
        }
        if (!r.startDate || !r.endDate) {
          return false;
        }

        const rStart = new Date(r.startDate);
        const rEnd = new Date(r.endDate);

        // Check overlap: (roundStart < rEnd && roundEnd > rStart)
        return roundStart < rEnd && roundEnd > rStart;
      });

      if (overlappingRound) {
        const errors = {
          startDate:
            "This round overlaps with an existing round. Please adjust the timing.",
        };
        throw new AppError(
          "Round dates overlap with existing round",
          400,
          errors
        );
      }

      logger.debug(`[UPDATE ROUND] Date constraints validated`);
    }

    // STEP 7: UPDATE ROUND (support both naming conventions)
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined) {
        // Map new field names to old field names for backward compatibility
        if (key === "roundName") {
          round.name = updateData[key];
        } else if (key === "roundDescription") {
          round.description = updateData[key];
        } else if (key === "roundStartDate") {
          round.startDate = updateData[key];
        } else if (key === "roundEndDate") {
          round.endDate = updateData[key];
        } else if (key === "roundMaxParticipants") {
          round.maxParticipants = updateData[key];
        } else {
          round[key] = updateData[key];
        }
      }
    });

    // STEP 8: SAVE EVENT
    const savedEvent = await event.save();
    logger.info(`[UPDATE ROUND] Round updated successfully`, {
      eventId,
      roundId,
      roundName: round.name,
      newStatus: updateData.status,
    });

    // STEP 9: CLEAR CACHE
    const redis = getRedisClient();
    if (redis) {
      await redis.del(`event:${eventId}`);
    }

    // STEP 10: RETURN RESPONSE
    res.status(200).json({
      success: true,
      message: "Round updated successfully",
      data: {
        event: savedEvent,
        round,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    logger.error(`[UPDATE ROUND] Unexpected error`, {
      message: error.message,
      eventId,
      roundId,
      stack: error.stack,
      errorName: error.name,
      body: req.body,
    });

    // Handle Mongoose validation errors
    if (error.name === "ValidationError") {
      const errors = {};
      Object.keys(error.errors).forEach((field) => {
        errors[field] = error.errors[field].message;
      });
      logger.error(`[UPDATE ROUND] Validation errors:`, errors);
      throw new AppError("Round validation failed", 422, errors);
    }

    // Return detailed error message
    throw new AppError(`Failed to update round: ${error.message}`, 500);
  }
});

/**
 * PROGRESS TEAMS TO NEXT ROUND
 * Strict validation for team progression
 * - Only forward progression allowed
 * - Cannot exceed total rounds
 * - Current round must be completed
 */
exports.progressTeams = asyncHandler(async (req, res, next) => {
  const { eventId, roundId } = req.params;

  logger.info(`[PROGRESS TEAMS] Progressing teams from round ${roundId}`);

  try {
    // STEP 1: VALIDATE SCHEMA
    let progressData;
    try {
      progressData = validateWithSchema(req.body, progressTeamsSchema);
      logger.info(`[PROGRESS TEAMS] Schema validation passed`);
      logger.debug(`[PROGRESS TEAMS] Validated progress data:`, progressData);
    } catch (validationError) {
      logger.warn(`[PROGRESS TEAMS] Schema validation failed`, {
        message: validationError.message,
        statusCode: validationError.statusCode,
        errors: validationError.details,
      });
      throw validationError;
    }

    // STEP 2: FIND EVENT
    const event = await Event.findById(eventId);
    if (!event) {
      logger.warn(`[PROGRESS TEAMS] Event not found`, { eventId });
      throw new AppError("Event not found", 404);
    }
    logger.debug(`[PROGRESS TEAMS] Event found: ${event.title}`);

    // STEP 3: CHECK AUTHORIZATION
    const isAuthorized =
      event.organizerId.toString() === req.user._id.toString() ||
      req.user.role === "admin" ||
      req.user.role === "super_admin";

    if (!isAuthorized) {
      logger.warn(`[PROGRESS TEAMS] Unauthorized progression attempt`, {
        eventId,
        userId: req.user._id,
      });
      throw new AppError("Not authorized to modify this event", 403);
    }

    // STEP 4: VALIDATE ROUND NUMBERS
    validateRoundProgression(
      progressData.fromRoundNumber,
      progressData.toRoundNumber,
      event.roundsCount
    );
    logger.debug(`[PROGRESS TEAMS] Round progression validated`);

    // STEP 5: FIND FROM ROUND
    const fromRound = event.rounds.find(
      (r) => r.number === progressData.fromRoundNumber
    );
    if (!fromRound) {
      const errors = {
        fromRoundNumber: `Round ${progressData.fromRoundNumber} not found`,
      };
      throw new AppError("Round not found", 404, errors);
    }

    // STEP 6: FIND TO ROUND
    const toRound = event.rounds.find(
      (r) => r.number === progressData.toRoundNumber
    );
    if (!toRound) {
      const errors = {
        toRoundNumber: `Round ${progressData.toRoundNumber} not found`,
      };
      throw new AppError("Round not found", 404, errors);
    }

    logger.debug(
      `[PROGRESS TEAMS] Rounds found: ${fromRound.name} → ${toRound.name}`
    );

    // STEP 7: CHECK FROM ROUND IS COMPLETED
    if (fromRound.status !== "completed") {
      const errors = {
        status: `Cannot move teams: current round "${fromRound.name}" status is "${fromRound.status}", must be "completed"`,
      };
      logger.warn(`[PROGRESS TEAMS] Round not completed`, {
        eventId,
        roundId,
        status: fromRound.status,
      });
      throw new AppError(
        "Cannot move teams: current round not completed",
        400,
        {
          errors,
        }
      );
    }

    logger.debug(`[PROGRESS TEAMS] From round is completed`);

    // STEP 8: UPDATE TEAM ROUND ASSIGNMENTS
    const teams = await Team.updateMany(
      { _id: { $in: progressData.teamIds } },
      { currentRound: progressData.toRoundNumber },
      { new: true }
    );

    logger.info(`[PROGRESS TEAMS] Teams progressed successfully`, {
      eventId,
      fromRound: progressData.fromRoundNumber,
      toRound: progressData.toRoundNumber,
      teamsCount: progressData.teamIds.length,
      eliminatedTeams: progressData.eliminateTeams,
    });

    // STEP 9: CLEAR CACHE
    const redis = getRedisClient();
    if (redis) {
      await redis.del(`event:${eventId}`);
    }

    // STEP 10: RETURN RESPONSE
    res.status(200).json({
      success: true,
      message: `${progressData.teamIds.length} teams progressed to round ${progressData.toRoundNumber}`,
      data: {
        teamsUpdated: progressData.teamIds.length,
        fromRound: progressData.fromRoundNumber,
        toRound: progressData.toRoundNumber,
        eliminated: progressData.eliminateTeams,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    logger.error(`[PROGRESS TEAMS] Unexpected error`, {
      message: error.message,
      eventId,
      stack: error.stack,
      errorName: error.name,
      body: req.body,
    });

    // Handle Mongoose validation errors
    if (error.name === "ValidationError") {
      const errors = {};
      Object.keys(error.errors).forEach((field) => {
        errors[field] = error.errors[field].message;
      });
      logger.error(`[PROGRESS TEAMS] Validation errors:`, errors);
      throw new AppError("Team progression validation failed", 422, errors);
    }

    // Return detailed error message
    throw new AppError(`Failed to progress teams: ${error.message}`, 500);
  }
});

/**
 * DELETE ROUND - STRICT REVERSE-ORDER ENFORCEMENT
 * Rounds must be deleted in reverse order ONLY (last round first)
 * Cannot delete earlier rounds while later rounds exist
 */
exports.deleteRound = asyncHandler(async (req, res, next) => {
  const { eventId, roundId } = req.params;

  logger.info(`[DELETE ROUND] Deleting round ${roundId} from event ${eventId}`);

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      logger.warn(`[DELETE ROUND] Event not found`, { eventId });
      throw new AppError("Event not found", 404);
    }

    // Check authorization
    const isAuthorized =
      event.organizerId.toString() === req.user._id.toString() ||
      req.user.role === "admin" ||
      req.user.role === "super_admin";

    if (!isAuthorized) {
      logger.warn(`[DELETE ROUND] Unauthorized deletion attempt`, {
        eventId,
        roundId,
        userId: req.user._id,
      });
      throw new AppError("Not authorized to modify this event", 403);
    }

    const round = event.rounds.id(roundId);
    if (!round) {
      logger.warn(`[DELETE ROUND] Round not found`, { eventId, roundId });
      throw new AppError("Round not found", 404);
    }

    const roundNumber = round.number;
    logger.info(`[DELETE ROUND] Found round number: ${roundNumber}`, {
      roundName: round.name,
    });

    // STRICT RULE: Prevent deletion of completed/ongoing rounds
    if (round.status === "completed" || round.status === "ongoing") {
      const errors = {
        status: `Cannot delete ${round.status} round "${round.name}"`,
      };
      logger.warn(`[DELETE ROUND] Cannot delete locked round`, {
        eventId,
        roundId,
        status: round.status,
      });
      throw new AppError("Cannot delete this round", 403, errors);
    }

    // STRICT RULE: Can ONLY delete the LAST (most recently created) round
    // Get the highest round number
    const maxRoundNumber = Math.max(
      ...event.rounds.map((r) => r.number || 0),
      0
    );

    if (roundNumber !== maxRoundNumber) {
      // User is trying to delete an earlier round while later rounds exist
      const laterRounds = event.rounds.filter((r) => r.number > roundNumber);
      const laterRoundNames = laterRounds.map((r) => r.name).join(", ");

      const errors = {
        roundNumber: `Cannot delete Round ${roundNumber} while later rounds exist. Please delete Round ${maxRoundNumber} ("${laterRoundNames}") first.`,
      };
      logger.warn(`[DELETE ROUND] Attempt to delete non-last round`, {
        eventId,
        roundNumber,
        maxRoundNumber,
        laterRounds: laterRoundNames,
      });
      throw new AppError("Cannot delete this round", 400, errors);
    }

    logger.info(
      `[DELETE ROUND] Deletion validation passed - this is the last round`
    );

    // Remove round
    event.rounds.id(roundId).deleteOne();

    // Re-number remaining rounds to be sequential
    event.rounds.forEach((r, index) => {
      r.number = index + 1;
    });

    await event.save();

    logger.info(`[DELETE ROUND] Round deleted successfully`, {
      eventId,
      roundId,
      roundNumber,
      roundName: round.name,
      remainingRounds: event.rounds.length,
    });

    // Clear cache
    const redis = getRedisClient();
    if (redis) {
      await redis.del(`event:${eventId}`);
    }

    res.status(200).json({
      success: true,
      message: "Round deleted successfully",
      data: { event },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    logger.error(`[DELETE ROUND] Unexpected error`, {
      message: error.message,
      eventId,
      roundId,
      stack: error.stack,
      errorName: error.name,
    });

    // Handle Mongoose validation errors
    if (error.name === "ValidationError") {
      const errors = {};
      Object.keys(error.errors).forEach((field) => {
        errors[field] = error.errors[field].message;
      });
      logger.error(`[DELETE ROUND] Validation errors:`, errors);
      throw new AppError("Round validation failed", 422, errors);
    }

    // Return detailed error message
    throw new AppError(`Failed to delete round: ${error.message}`, 500);
  }
});

module.exports = exports;
