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
 */
exports.addRound = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { name, description, startDate, endDate, maxParticipants } = req.body;

  logger.info(`[ADD ROUND] Request to add round to event ${eventId}`);
  logger.info(`[ADD ROUND] Request body:`, req.body);
  logger.info(`[ADD ROUND] User:`, req.user._id, req.user.role);

  const event = await Event.findById(eventId);
  if (!event) {
    logger.error(`[ADD ROUND] Event not found: ${eventId}`);
    throw new AppError("Event not found", 404);
  }

  logger.info(`[ADD ROUND] Found event: ${event.title}`);
  logger.info(`[ADD ROUND] Current rounds count: ${event.rounds.length}`);

  // Check if user is organizer
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

  // CRITICAL: Auto-assign round number based on existing rounds
  const nextRoundNumber = event.rounds.length + 1;

  const newRound = {
    number: nextRoundNumber, // Auto-assign 1-based round number
    name,
    description,
    startDate,
    endDate,
    maxParticipants,
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

  event.rounds.pull(roundId);
  await event.save();

  // Clear Redis cache for this event
  const redis = getRedisClient();
  if (redis) {
    await redis.del(`event:${eventId}`);
    logger.info(`[DELETE ROUND] Redis cache cleared for event ${eventId}`);
  }

  res.json({
    success: true,
    message: "Round deleted successfully",
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
