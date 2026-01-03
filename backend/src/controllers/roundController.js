const Event = require("../models/Event");
const EventRegistration = require("../models/EventRegistration");
const Notification = require("../models/Notification");
const { asyncHandler } = require("../middleware/errorHandler");
const AppError = require("../middleware/errorHandler").AppError;
const logger = require("../utils/logger");
const { getRedisClient } = require("../config/redis");

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

  const newRound = {
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
  const { participantIds } = req.body; // Array of registration IDs to advance

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

  const nextRound = parseInt(roundNumber);

  // Advance selected participants
  const advancePromises = participantIds.map(async (regId) => {
    const registration = await EventRegistration.findById(regId);
    if (registration && registration.event.toString() === eventId) {
      registration.currentRound = nextRound;
      if (!registration.advancedToRounds.includes(nextRound)) {
        registration.advancedToRounds.push(nextRound);
      }
      await registration.save();

      // Send notification to participant
      await Notification.create({
        recipients: [registration.user],
        title: "Advanced to Next Round",
        message: `Congratulations! You have been advanced to Round ${nextRound} of ${event.title}`,
        type: "event_update",
        relatedEvent: event._id,
        channels: ["in_app", "email"],
      });
    }
  });

  await Promise.all(advancePromises);

  // Get all registrations for this event that weren't advanced
  const allRegistrations = await EventRegistration.find({
    event: eventId,
    status: "confirmed",
    currentRound: nextRound - 1,
  });

  const notAdvanced = allRegistrations.filter(
    (reg) => !participantIds.includes(reg._id.toString())
  );

  // Mark non-advanced participants as eliminated
  const eliminatePromises = notAdvanced.map(async (registration) => {
    registration.eliminatedInRound = nextRound - 1;
    await registration.save();

    // Send notification
    await Notification.create({
      recipients: [registration.user],
      title: "Round Results",
      message: `Thank you for participating in ${event.title}. You did not advance to Round ${nextRound}.`,
      type: "event_update",
      relatedEvent: event._id,
      channels: ["in_app", "email"],
    });
  });

  await Promise.all(eliminatePromises);

  // Update event's current round
  event.currentRound = nextRound;
  await event.save();

  res.json({
    success: true,
    data: {
      advancedCount: participantIds.length,
      eliminatedCount: notAdvanced.length,
      currentRound: nextRound,
    },
    message: `${participantIds.length} participants advanced to Round ${nextRound}`,
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
 * @desc    Get round statistics
 * @route   GET /api/v1/events/:eventId/rounds/stats
 * @access  Private (Organizer+)
 */
exports.getRoundStats = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

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
    throw new AppError("Not authorized to view statistics", 403);
  }

  const stats = [];

  // Initial registrations
  const initialCount = await EventRegistration.countDocuments({
    event: eventId,
    status: "confirmed",
  });

  stats.push({
    round: 0,
    name: "Initial Registrations",
    participantCount: initialCount,
  });

  // Get stats for each round
  for (let i = 1; i <= event.currentRound; i++) {
    const roundCount = await EventRegistration.countDocuments({
      event: eventId,
      currentRound: i,
      eliminatedInRound: null,
      status: "confirmed",
    });

    const roundInfo = event.rounds[i - 1];
    stats.push({
      round: i,
      name: roundInfo?.name || `Round ${i}`,
      participantCount: roundCount,
    });
  }

  res.json({
    success: true,
    data: {
      currentRound: event.currentRound,
      totalRounds: event.rounds.length,
      stats,
    },
  });
});
