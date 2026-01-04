const Event = require("../models/Event");
const EventRegistration = require("../models/EventRegistration");
const Team = require("../models/Team");
const Notification = require("../models/Notification");
const { asyncHandler } = require("../middleware/errorHandler");
const AppError = require("../middleware/errorHandler").AppError;
const logger = require("../utils/logger");
const { getRedisClient } = require("../config/redis");
const { withTransaction } = require("../utils/transaction");

/**
 * @desc    Add round to event
 * @route   POST /api/v1/events/:eventId/rounds
 * @access  Private (Organizer+)
 * REQUIREMENTS:
 * - roundName is REQUIRED
 * - roundStartDate is REQUIRED
 * - roundEndDate is REQUIRED
 * - NO auto-assignment of dates, NO silent defaults
 * - Strict validation with event boundaries and sequencing
 */
exports.addRound = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const {
    name,
    roundName,
    description,
    roundDescription,
    startDate,
    roundStartDate,
    endDate,
    roundEndDate,
    maxParticipants,
    roundMaxParticipants,
  } = req.body;

  logger.info(`[ADD ROUND] Request to add round to event ${eventId}`);
  logger.info(`[ADD ROUND] Request body:`, req.body);
  logger.info(`[ADD ROUND] User:`, req.user._id, req.user.role);

  // STEP 1: Validate required fields (STRICT - no auto-assignment)
  const finalName = roundName || name;
  const finalStartDate = roundStartDate || startDate;
  const finalEndDate = roundEndDate || endDate;

  const errors = {};
  if (!finalName || finalName.trim().length === 0) {
    errors.roundName = "Round name is required";
  }
  if (!finalStartDate) {
    errors.roundStartDate = "Round start date is required";
  }
  if (!finalEndDate) {
    errors.roundEndDate = "Round end date is required";
  }

  if (Object.keys(errors).length > 0) {
    logger.warn(`[ADD ROUND] Missing required fields`, { errors });
    throw new AppError("Missing required fields", 400, errors);
  }

  // STEP 2: Find event
  const event = await Event.findById(eventId);
  if (!event) {
    logger.error(`[ADD ROUND] Event not found: ${eventId}`);
    throw new AppError("Event not found", 404);
  }

  logger.info(`[ADD ROUND] Found event: ${event.title}`);
  logger.info(`[ADD ROUND] Current rounds count: ${event.rounds.length}`);

  // STEP 3: Check authorization
  if (
    event.organizerId.toString() !== req.user._id.toString() &&
    req.user.role !== "admin" &&
    req.user.role !== "super_admin"
  ) {
    logger.error(
      `[ADD ROUND] Unauthorized user ${req.user._id} trying to modify event ${eventId}`
    );
    throw new AppError("Not authorized to modify this event", 403);
  }

  // STEP 4: Validate dates (STRICT)
  const eventStart = new Date(event.startDateTime);
  const eventEnd = new Date(event.endDateTime);
  const roundStart = new Date(finalStartDate);
  const roundEnd = new Date(finalEndDate);

  const validationErrors = {};

  // Validate date formats
  if (isNaN(roundStart.getTime())) {
    validationErrors.roundStartDate =
      "Round start date must be a valid ISO date";
  }
  if (isNaN(roundEnd.getTime())) {
    validationErrors.roundEndDate = "Round end date must be a valid ISO date";
  }

  if (Object.keys(validationErrors).length > 0) {
    logger.warn(`[ADD ROUND] Invalid date format`, validationErrors);
    throw new AppError("Invalid date format", 400, validationErrors);
  }

  // Check event boundaries
  if (roundStart < eventStart) {
    validationErrors.roundStartDate = `Round start time cannot be before the event start time. Event runs from ${eventStart.toISOString()} to ${eventEnd.toISOString()}`;
  }

  if (roundEnd > eventEnd) {
    validationErrors.roundEndDate = `Round end time cannot exceed the event end time. Event ends at ${eventEnd.toISOString()}`;
  }

  // Check round end is after round start
  if (roundEnd <= roundStart) {
    validationErrors.roundEndDate =
      "Round end time must be after round start time";
  }

  if (Object.keys(validationErrors).length > 0) {
    logger.warn(`[ADD ROUND] Date validation failed`, validationErrors);
    throw new AppError("Date validation failed", 400, validationErrors);
  }

  // STEP 5: Check sequential rules
  if (event.rounds.length > 0) {
    const previousRound = event.rounds[event.rounds.length - 1];
    const prevRoundEnd = new Date(previousRound.endDate);

    if (roundStart <= prevRoundEnd) {
      validationErrors.roundStartDate = `Round ${
        event.rounds.length + 1
      } must start after Round ${
        event.rounds.length
      } ends at ${prevRoundEnd.toISOString()}`;
      logger.warn(`[ADD ROUND] Sequential rule violation`, validationErrors);
      throw new AppError("Invalid round timing", 400, validationErrors);
    }
  }

  // STEP 6: Check for overlapping rounds
  const overlappingRound = event.rounds.find((r) => {
    const rStart = new Date(r.startDate);
    const rEnd = new Date(r.endDate);
    return roundStart < rEnd && roundEnd > rStart;
  });

  if (overlappingRound) {
    validationErrors.roundStartDate =
      "This round overlaps with an existing round. Please adjust the timing.";
    logger.warn(`[ADD ROUND] Overlapping rounds detected`, {
      eventId,
      overlappingRound: overlappingRound.name,
    });
    throw new AppError(
      "Round dates overlap with existing round",
      400,
      validationErrors
    );
  }

  // STEP 7: Create round with auto-assigned number
  const nextRoundNumber = event.rounds.length + 1;

  const newRound = {
    number: nextRoundNumber,
    name: finalName,
    description: roundDescription || description || "",
    startDate: roundStart,
    endDate: roundEnd,
    maxParticipants: roundMaxParticipants || maxParticipants,
    status: "upcoming",
  };

  logger.info(`[ADD ROUND] Adding new round:`, newRound);
  event.rounds.push(newRound);
  logger.info(`[ADD ROUND] Rounds count after push: ${event.rounds.length}`);

  const savedEvent = await event.save();
  logger.info(`[ADD ROUND] Event saved successfully`);
  logger.info(
    `[ADD ROUND] Saved event rounds count: ${savedEvent.rounds.length}`
  );
  logger.info(
    `[ADD ROUND] Last round:`,
    savedEvent.rounds[savedEvent.rounds.length - 1]
  );

  // Clear Redis cache for this event
  const redis = getRedisClient();
  if (redis) {
    await redis.del(`event:${eventId}`);
    logger.info(`[ADD ROUND] Redis cache cleared for event ${eventId}`);
  }

  res.status(201).json({
    success: true,
    data: { event: savedEvent },
    message: "Round added successfully",
  });
});

/**
 * @desc    Update round
 * @route   PUT /api/v1/events/:eventId/rounds/:roundId
 * @access  Private (Organizer+)
 */
exports.updateRound = asyncHandler(async (req, res) => {
  const { eventId, roundId } = req.params;
  const updates = req.body;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check authorization
  if (
    event.organizerId.toString() !== req.user._id.toString() &&
    req.user.role !== "admin" &&
    req.user.role !== "super_admin"
  ) {
    throw new AppError("Not authorized to modify this event", 403);
  }

  const round = event.rounds.id(roundId);
  if (!round) {
    throw new AppError("Round not found", 404);
  }

  // CRITICAL: Validate round status transitions
  if (updates.status && updates.status !== round.status) {
    const newStatus = updates.status;
    const currentStatus = round.status;
    const now = new Date();
    const roundStartDate = new Date(updates.startDate || round.startDate);
    const roundEndDate = new Date(updates.endDate || round.endDate);

    // Date-based validation
    if (newStatus === "ongoing" && now < roundStartDate) {
      throw new AppError(
        `Cannot set round to ONGOING before its start date. Start: ${roundStartDate.toISOString()}, Now: ${now.toISOString()}`,
        400
      );
    }

    if (newStatus === "completed" && now < roundEndDate) {
      throw new AppError(
        `Cannot set round to COMPLETED before its end date. End: ${roundEndDate.toISOString()}, Now: ${now.toISOString()}`,
        400
      );
    }

    // Status hierarchy: upcoming(1) → ongoing(2) → completed(3)
    const statusHierarchy = { upcoming: 1, ongoing: 2, completed: 3 };
    if (
      statusHierarchy[newStatus] &&
      statusHierarchy[currentStatus] &&
      statusHierarchy[newStatus] < statusHierarchy[currentStatus]
    ) {
      throw new AppError(
        `Cannot revert round status from ${currentStatus} to ${newStatus}. Status can only progress forward.`,
        400
      );
    }

    // ONE ONGOING ROUND: Check if another round is already ongoing
    if (newStatus === "ongoing") {
      const otherOngoingRound = event.rounds.find(
        (r) => r._id.toString() !== roundId && r.status === "ongoing"
      );
      if (otherOngoingRound) {
        throw new AppError(
          `Cannot set this round to ONGOING. Round "${otherOngoingRound.name}" is already ongoing. Only one round can be ongoing at a time.`,
          400
        );
      }

      // SEQUENTIAL PROGRESSION: Check if previous round is completed
      const roundIndex = event.rounds.findIndex(
        (r) => r._id.toString() === roundId
      );
      if (roundIndex > 0) {
        const previousRound = event.rounds[roundIndex - 1];
        if (previousRound.status !== "completed") {
          throw new AppError(
            `Cannot start this round. Previous round "${previousRound.name}" must be completed first. Current status: ${previousRound.status}`,
            400
          );
        }
      }
    }
  }

  // Update round fields
  Object.keys(updates).forEach((key) => {
    if (updates[key] !== undefined) {
      round[key] = updates[key];
    }
  });

  await event.save();

  // Clear Redis cache for this event
  const redis = getRedisClient();
  if (redis) {
    await redis.del(`event:${eventId}`);
    logger.info(`[UPDATE ROUND] Redis cache cleared for event ${eventId}`);
  }

  res.json({
    success: true,
    data: { event },
  });
});

/**
 * @desc    Delete round
 * @route   DELETE /api/v1/events/:eventId/rounds/:roundId
 * @access  Private (Organizer+)
 */
exports.deleteRound = asyncHandler(async (req, res) => {
  const { eventId, roundId } = req.params;

  logger.info(`[DELETE ROUND] Deleting round ${roundId} from event ${eventId}`);

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check authorization
  if (
    event.organizerId.toString() !== req.user._id.toString() &&
    req.user.role !== "admin" &&
    req.user.role !== "super_admin"
  ) {
    throw new AppError("Not authorized to modify this event", 403);
  }

  // Find the round to delete
  const round = event.rounds.id(roundId);
  if (!round) {
    throw new AppError("Round not found", 404);
  }

  const roundNumber = round.number;
  logger.info(`[DELETE ROUND] Found round number: ${roundNumber}`, {
    roundName: round.name,
  });

  // Prevent deletion of completed/ongoing rounds
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
  const maxRoundNumber = Math.max(...event.rounds.map((r) => r.number || 0), 0);

  if (roundNumber !== maxRoundNumber) {
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

  // Remove the round
  event.rounds.id(roundId).deleteOne();

  // Re-number remaining rounds
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

  // Clear Redis cache for this event
  const redis = getRedisClient();
  if (redis) {
    await redis.del(`event:${eventId}`);
    logger.info(`[DELETE ROUND] Redis cache cleared for event ${eventId}`);
  }

  res.json({
    success: true,
    message: "Round deleted successfully",
    data: { event },
  });
});

/**
 * @desc    Advance participants to next round
 * @route   POST /api/v1/events/:eventId/rounds/:roundNumber/advance
 * @access  Private (Organizer+)
 */
exports.advanceParticipants = asyncHandler(async (req, res) => {
  const { eventId, roundNumber } = req.params;
  const { participantIds, teamIds } = req.body; // Arrays of registration/team IDs to advance

  if (!participantIds || !Array.isArray(participantIds)) {
    throw new AppError("participantIds must be an array", 400);
  }

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check authorization
  if (
    event.organizerId.toString() !== req.user._id.toString() &&
    req.user.role !== "admin" &&
    req.user.role !== "super_admin"
  ) {
    throw new AppError("Not authorized to manage this event", 403);
  }

  const currentRoundNum = parseInt(roundNumber);
  const nextRoundNum = currentRoundNum + 1;

  logger.info(
    `[ADVANCE PARTICIPANTS] Advancing from round ${currentRoundNum} to round ${nextRoundNum}`
  );
  logger.info(
    `[ADVANCE PARTICIPANTS] Available rounds:`,
    event.rounds.map((r) => ({ number: r.number, name: r.name }))
  );

  // CRITICAL: Validate current round exists and is COMPLETED
  const currentRound = event.rounds.find((r) => r.number === currentRoundNum);
  if (!currentRound) {
    logger.error(
      `[ADVANCE PARTICIPANTS] Current round ${currentRoundNum} does not exist`
    );
    throw new AppError(
      `Round ${currentRoundNum} does not exist. Available rounds: ${event.rounds
        .map((r) => r.number)
        .join(", ")}`,
      400
    );
  }

  if (currentRound.status !== "completed") {
    logger.error(
      `[ADVANCE PARTICIPANTS] Current round ${currentRoundNum} status is ${currentRound.status}, not completed`
    );
    throw new AppError(
      `Cannot advance participants. Current round "${currentRound.name}" must be marked as COMPLETED first. Current status: ${currentRound.status}`,
      400
    );
  }

  // CRITICAL: Validate next round exists
  const nextRound = event.rounds.find((r) => r.number === nextRoundNum);
  if (!nextRound) {
    logger.error(
      `[ADVANCE PARTICIPANTS] Next round ${nextRoundNum} does not exist`
    );
    throw new AppError(
      `Round ${nextRoundNum} does not exist. Available rounds: ${event.rounds
        .map((r) => r.number)
        .join(", ")}`,
      400
    );
  }

  // TRANSACTION: Use atomic operations for round advancement
  const result = await withTransaction(async (session) => {
    const sessionOpt = session ? { session } : {};

    // Advance selected participants atomically
    const advanceResults = await Promise.all(
      participantIds.map(async (regId) => {
        const registration = await EventRegistration.findById(regId);
        if (registration && registration.event.toString() === eventId) {
          // Validate participant is in current round and not eliminated
          if (registration.eliminatedInRound !== null) {
            logger.warn(
              `Skipping registration ${regId} - already eliminated in round ${registration.eliminatedInRound}`
            );
            return null;
          }

          registration.currentRound = nextRoundNum; // Use nextRoundNum (number), not nextRound (object)
          if (!registration.advancedToRounds.includes(nextRoundNum)) {
            registration.advancedToRounds.push(nextRoundNum);
          }
          await registration.save(sessionOpt);

          return registration;
        }
        return null;
      })
    );

    const advancedRegistrations = advanceResults.filter((r) => r !== null);

    // CRITICAL: If team event, update teams' round field atomically
    if (teamIds && Array.isArray(teamIds) && teamIds.length > 0) {
      await Team.updateMany(
        {
          _id: { $in: teamIds },
          event: eventId,
          eliminated: false,
        },
        {
          $set: { round: nextRoundNum }, // Use nextRoundNum (number), not nextRound (object)
        },
        sessionOpt
      );
    }

    // Get all registrations for this event that weren't advanced
    const allRegistrations = await EventRegistration.find({
      event: eventId,
      status: "confirmed",
      currentRound: currentRoundNum,
      eliminatedInRound: null,
    });

    const notAdvanced = allRegistrations.filter(
      (reg) => !participantIds.includes(reg._id.toString())
    );

    // Mark non-advanced participants as eliminated atomically
    await Promise.all(
      notAdvanced.map(async (registration) => {
        registration.eliminatedInRound = currentRoundNum; // Mark elimination with round number
        await registration.save(sessionOpt);

        // CRITICAL: If team event, mark team as eliminated
        if (registration.team) {
          await Team.findByIdAndUpdate(
            registration.team,
            { $set: { eliminated: true } },
            sessionOpt
          );
        }
      })
    );

    return {
      advancedCount: advancedRegistrations.length,
      eliminatedCount: notAdvanced.length,
    };
  });

  // NOTIFICATIONS: Send outside transaction to avoid rollback issues
  const advancedRegistrations = await EventRegistration.find({
    _id: { $in: participantIds },
    event: eventId,
  }).populate("user", "_id");

  await Promise.all(
    advancedRegistrations.map(async (registration) => {
      try {
        await Notification.create({
          recipients: [registration.user],
          title: "Advanced to Next Round",
          message: `Congratulations! You have been advanced to Round ${nextRound} of ${event.title}`,
          type: "event_update",
          relatedEvent: event._id,
          channels: ["in_app", "email"],
        });
      } catch (error) {
        logger.error(
          `Failed to send notification to user ${registration.user._id}:`,
          error
        );
      }
    })
  );

  // Get eliminated registrations for notifications
  const eliminatedRegistrations = await EventRegistration.find({
    event: eventId,
    eliminatedInRound: currentRoundNum,
  }).populate("user", "_id");

  await Promise.all(
    eliminatedRegistrations.map(async (registration) => {
      try {
        await Notification.create({
          recipients: [registration.user],
          title: "Round Results",
          message: `Thank you for participating in ${event.title}. You did not advance to Round ${nextRoundNum}.`,
          type: "event_update",
          relatedEvent: event._id,
          channels: ["in_app", "email"],
        });
      } catch (error) {
        logger.error(
          `Failed to send elimination notification to user ${registration.user._id}:`,
          error
        );
      }
    })
  );

  // Update event's current round
  event.currentRound = nextRoundNum;
  await event.save();

  res.json({
    success: true,
    data: {
      advancedCount: result.advancedCount,
      eliminatedCount: result.eliminatedCount,
      currentRound: nextRoundNum,
    },
    message: `${result.advancedCount} participants advanced to Round ${nextRoundNum}`,
  });
});

/**
 * @desc    Get participants for specific round
 * @route   GET /api/v1/events/:eventId/rounds/:roundNumber/participants
 * @access  Private (Organizer+)
 */
exports.getRoundParticipants = asyncHandler(async (req, res) => {
  const { eventId, roundNumber } = req.params;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check authorization
  if (
    event.organizerId.toString() !== req.user._id.toString() &&
    req.user.role !== "admin" &&
    req.user.role !== "super_admin"
  ) {
    throw new AppError("Not authorized to view participants", 403);
  }

  const round = parseInt(roundNumber);

  const participants = await EventRegistration.find({
    event: eventId,
    currentRound: round,
    status: "confirmed",
    eliminatedInRound: null,
  })
    .populate("user", "fullName email phone")
    .populate("team", "name")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: {
      round: round,
      participants,
      count: participants.length,
    },
  });
});

/**
 * @desc    Get round statistics (participant counts, elimination counts)
 * @route   GET /api/v1/events/:eventId/rounds/stats
 * @access  Private (Organizer+)
 */
exports.getRoundStats = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  logger.info(`[GET ROUND STATS] Fetching stats for event: ${eventId}`);

  const event = await Event.findById(eventId);
  if (!event) {
    logger.error(`[GET ROUND STATS] Event not found: ${eventId}`);
    throw new AppError("Event not found", 404);
  }

  // Check authorization
  if (
    event.organizerId.toString() !== req.user._id.toString() &&
    req.user.role !== "admin" &&
    req.user.role !== "super_admin"
  ) {
    logger.error(
      `[GET ROUND STATS] Unauthorized user ${req.user._id} trying to view stats for event ${eventId}`
    );
    throw new AppError("Not authorized to view event statistics", 403);
  }

  logger.info(
    `[GET ROUND STATS] Event has ${event.rounds.length} rounds`,
    event.rounds.map((r) => ({ number: r.number, name: r.name }))
  );

  // Build stats from explicit rounds array
  const stats = await Promise.all(
    event.rounds.map(async (round) => {
      const roundNumber = round.number; // Use explicit number (1-based)

      logger.info(
        `[GET ROUND STATS] Processing round ${roundNumber}: ${round.name}`
      );

      // Count participants in this round
      const participantCount = await EventRegistration.countDocuments({
        event: eventId,
        currentRound: roundNumber,
        eliminatedInRound: null,
      });

      // Count participants eliminated in this round
      const eliminatedCount = await EventRegistration.countDocuments({
        event: eventId,
        eliminatedInRound: roundNumber,
      });

      logger.info(
        `[GET ROUND STATS] Round ${roundNumber}: ${participantCount} participants, ${eliminatedCount} eliminated`
      );

      return {
        roundNumber,
        name: round.name,
        description: round.description,
        participantCount,
        eliminatedCount,
        status: round.status,
        startDate: round.startDate,
        endDate: round.endDate,
      };
    })
  );

  // Also include registration stats (Round 0)
  const registrationCount = await EventRegistration.countDocuments({
    event: eventId,
    status: "confirmed",
    currentRound: 0,
    eliminatedInRound: null,
  });

  logger.info(
    `[GET ROUND STATS] Registration (Round 0): ${registrationCount} participants`
  );

  const allStats = [
    {
      roundNumber: 0,
      name: "Registration",
      participantCount: registrationCount,
      eliminatedCount: 0,
      status: "active",
    },
    ...stats,
  ];

  logger.info(
    `[GET ROUND STATS] Returning ${allStats.length} round statistics`
  );

  res.json({
    success: true,
    data: allStats,
    totalRounds: event.rounds.length,
    currentRound: event.currentRound,
  });
});
