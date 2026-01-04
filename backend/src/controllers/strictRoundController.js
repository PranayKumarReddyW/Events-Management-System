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
 * - Round dates within event duration
 * - Sequential numbering (no gaps)
 * - Cannot exceed max rounds
 */
exports.createRound = asyncHandler(async (req, res, next) => {
  const { eventId } = req.params;

  logger.info(`[CREATE ROUND] Creating round for event ${eventId}`);

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

    // STEP 3: VALIDATE SCHEMA
    let roundData = validateWithSchema(req.body, createRoundSchema);
    logger.debug(`[CREATE ROUND] Schema validation passed`);

    // STEP 4: CHECK ROUND LIMIT
    if (event.roundsCount && event.rounds.length >= event.roundsCount) {
      const errors = {
        roundsCount: `Event has a maximum of ${event.roundsCount} rounds`,
      };
      logger.warn(`[CREATE ROUND] Maximum rounds exceeded`, { eventId });
      throw new AppError("Maximum rounds exceeded", 400, { errors });
    }
    logger.debug(`[CREATE ROUND] Round limit check passed`);

    // STEP 5: VALIDATE DATE CONSTRAINTS (within event duration)
    validateRoundDateConstraints(
      event.startDateTime,
      event.endDateTime,
      roundData.startDate,
      roundData.endDate
    );
    logger.debug(`[CREATE ROUND] Date constraints validated`);

    // STEP 6: CHECK FOR OVERLAPPING ROUNDS
    const overlappingRound = event.rounds.find((r) => {
      const rStart = new Date(r.startDate);
      const rEnd = new Date(r.endDate);
      const newStart = new Date(roundData.startDate);
      const newEnd = new Date(roundData.endDate);

      // Check overlap: (newStart < rEnd && newEnd > rStart)
      return newStart < rEnd && newEnd > rStart;
    });

    if (overlappingRound) {
      const errors = {
        startDate: `Round dates overlap with existing round "${overlappingRound.name}"`,
      };
      logger.warn(`[CREATE ROUND] Overlapping rounds detected`, {
        eventId,
        overlappingRound: overlappingRound.name,
      });
      throw new AppError("Round dates overlap with existing round", 400, {
        errors,
      });
    }
    logger.debug(`[CREATE ROUND] No overlapping rounds found`);

    // STEP 7: AUTO-ASSIGN ROUND NUMBER
    const nextRoundNumber = event.rounds.length + 1;
    roundData.number = nextRoundNumber;
    roundData.status = "upcoming";

    logger.debug(`[CREATE ROUND] Assigned round number: ${nextRoundNumber}`);

    // STEP 8: ADD ROUND TO EVENT
    event.rounds.push(roundData);

    // STEP 9: SAVE EVENT
    const savedEvent = await event.save();
    logger.info(`[CREATE ROUND] Round created successfully`, {
      eventId,
      roundNumber: nextRoundNumber,
      roundName: roundData.name,
    });

    // STEP 10: CLEAR CACHE
    const redis = getRedisClient();
    if (redis) {
      await redis.del(`event:${eventId}`);
    }

    // STEP 11: RETURN RESPONSE
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
    });

    throw new AppError("Failed to create round", 500);
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

    // STEP 4: VALIDATE SCHEMA
    let updateData = validateWithSchema(req.body, updateRoundSchema);
    logger.debug(`[UPDATE ROUND] Schema validation passed`);

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
        throw new AppError("Cannot revert round status", 400, { errors });
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
          {
            errors,
          }
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
          {
            errors,
          }
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
          throw new AppError("Only one round can be ongoing at a time", 400, {
            errors,
          });
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
            throw new AppError("Previous round must be completed first", 400, {
              errors,
            });
          }
        }
      }
    }

    logger.debug(`[UPDATE ROUND] Status transition validated`);

    // STEP 6: VALIDATE DATE CONSTRAINTS IF BEING UPDATED
    if (updateData.startDate || updateData.endDate) {
      validateRoundDateConstraints(
        event.startDateTime,
        event.endDateTime,
        updateData.startDate || round.startDate,
        updateData.endDate || round.endDate
      );
      logger.debug(`[UPDATE ROUND] Date constraints validated`);

      // Check for overlaps with other rounds
      const overlappingRound = event.rounds.find((r) => {
        if (r._id.toString() === roundId) return false; // Skip self

        const rStart = new Date(r.startDate);
        const rEnd = new Date(r.endDate);
        const newStart = new Date(updateData.startDate || round.startDate);
        const newEnd = new Date(updateData.endDate || round.endDate);

        return newStart < rEnd && newEnd > rStart;
      });

      if (overlappingRound) {
        const errors = {
          startDate: `Round dates overlap with existing round "${overlappingRound.name}"`,
        };
        logger.warn(`[UPDATE ROUND] Overlapping rounds detected`, {
          eventId,
          roundId,
          overlappingRound: overlappingRound._id,
        });
        throw new AppError("Round dates overlap with existing round", 400, {
          errors,
        });
      }

      logger.debug(`[UPDATE ROUND] No overlapping rounds found`);
    }

    // STEP 7: UPDATE ROUND
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined) {
        round[key] = updateData[key];
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
    });

    throw new AppError("Failed to update round", 500);
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
    let progressData = validateWithSchema(req.body, progressTeamsSchema);
    logger.debug(`[PROGRESS TEAMS] Schema validation passed`);

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
      throw new AppError("Round not found", 404, { errors });
    }

    // STEP 6: FIND TO ROUND
    const toRound = event.rounds.find(
      (r) => r.number === progressData.toRoundNumber
    );
    if (!toRound) {
      const errors = {
        toRoundNumber: `Round ${progressData.toRoundNumber} not found`,
      };
      throw new AppError("Round not found", 404, { errors });
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
    });

    throw new AppError("Failed to progress teams", 500);
  }
});

/**
 * DELETE ROUND
 * Only non-completed rounds can be deleted
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

    // Prevent deletion of completed rounds
    if (round.status === "completed" || round.status === "ongoing") {
      const errors = {
        status: `Cannot delete ${round.status} round "${round.name}"`,
      };
      logger.warn(`[DELETE ROUND] Cannot delete locked round`, {
        eventId,
        roundId,
        status: round.status,
      });
      throw new AppError("Cannot delete this round", 403, { errors });
    }

    // Remove round
    event.rounds.id(roundId).deleteOne();

    // Re-number remaining rounds
    event.rounds.forEach((r, index) => {
      r.number = index + 1;
    });

    await event.save();

    logger.info(`[DELETE ROUND] Round deleted successfully`, {
      eventId,
      roundId,
      roundName: round.name,
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
    });

    throw new AppError("Failed to delete round", 500);
  }
});

module.exports = exports;
