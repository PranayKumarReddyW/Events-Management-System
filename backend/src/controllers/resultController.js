const EventResult = require("../models/EventResult");
const Event = require("../models/Event");
const EventRegistration = require("../models/EventRegistration");
const User = require("../models/User");
const Team = require("../models/Team");
const Notification = require("../models/Notification");
const Certificate = require("../models/Certificate");
const { asyncHandler } = require("../middleware/errorHandler");
const AppError = require("../middleware/errorHandler").AppError;
const logger = require("../utils/logger");

/**
 * @desc    Add or update event results
 * @route   POST /api/v1/events/:eventId/results
 * @access  Private (Organizer+)
 */
exports.addResults = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { results } = req.body; // Array of { position, userId?, teamId?, score?, remarks? }

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check authorization
  if (
    event.organizerId.toString() !== req.user._id.toString() &&
    !["admin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to manage results for this event", 403);
  }

  if (!Array.isArray(results) || results.length === 0) {
    throw new AppError("Results array is required", 400);
  }

  // Validate and save results
  const savedResults = [];
  for (const result of results) {
    const { position, userId, teamId, score, remarks } = result;

    if (!position) {
      throw new AppError("Position is required for all results", 400);
    }

    if (!userId && !teamId) {
      throw new AppError(
        "Either userId or teamId is required for each result",
        400
      );
    }

    // RACE CONDITION FIX: Check if result already exists for this position
    const existingResult = await EventResult.findOne({
      eventId,
      position,
    });

    if (existingResult) {
      // SECURITY: Prevent updating published results
      if (existingResult.publishedAt && existingResult.publishedAt !== null) {
        throw new AppError(
          `Cannot update position ${position} - already published`,
          400
        );
      }
      // Update existing result
      existingResult.userId = userId || null;
      existingResult.teamId = teamId || null;
      existingResult.score = score;
      existingResult.remarks = remarks;
      existingResult.publishedAt = null;
      await existingResult.save();
      savedResults.push(existingResult);
    } else {
      // NULL CHECK: Create new result
      const newResult = await EventResult.create({
        eventId,
        position,
        userId: userId || null,
        teamId: teamId || null,
        score: score || null,
        remarks: remarks || null,
        publishedAt: null,
      });
      savedResults.push(newResult);
    }
  }

  logger.info(
    `[addResults] Added ${savedResults.length} results for event ${eventId}`
  );

  res.status(200).json({
    success: true,
    data: savedResults,
    message: "Results saved successfully",
  });
});

/**
 * @desc    Get event results
 * @route   GET /api/v1/events/:eventId/results
 * @access  Public (if published) / Private (organizer+)
 */
exports.getResults = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check if user can view unpublished results
  const canViewUnpublished =
    req.user &&
    req.user._id &&
    (event.organizerId.toString() === req.user._id.toString() ||
      ["admin", "super_admin"].includes(req.user.role));

  const query = { eventId };
  if (!canViewUnpublished) {
    query.publishedAt = { $ne: null };
  }

  const results = await EventResult.find(query)
    .populate("userId", "fullName email profilePicture department")
    .populate("teamId", "name members")
    .sort({ position: 1 });

  res.status(200).json({
    success: true,
    data: results,
  });
});

/**
 * @desc    Publish event results
 * @route   POST /api/v1/events/:eventId/results/publish
 * @access  Private (Organizer+)
 */
exports.publishResults = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check authorization
  if (
    event.organizerId.toString() !== req.user._id.toString() &&
    !["admin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to publish results for this event", 403);
  }

  // RACE CONDITION FIX: Get all unpublished results with atomic check
  const results = await EventResult.find({
    eventId,
    publishedAt: null,
  });

  if (results.length === 0) {
    throw new AppError("No unpublished results found", 400);
  }

  // RACE CONDITION FIX: Atomic update with timestamp check to prevent double publish
  const publishedAt = new Date();
  const updateResult = await EventResult.updateMany(
    { eventId, publishedAt: null },
    { publishedAt }
  );

  if (updateResult.modifiedCount === 0) {
    throw new AppError(
      "Results already published or no results to publish",
      400
    );
  }

  // Populate results for notifications
  const publishedResults = await EventResult.find({
    eventId,
    publishedAt,
  })
    .populate("userId", "fullName email")
    .populate("teamId", "name members");

  // Send notifications to participants
  const notifications = [];
  for (const result of publishedResults) {
    if (result.userId && result.userId._id) {
      // NULL CHECK: Individual participant
      notifications.push({
        recipient: result.userId._id,
        sentBy: req.user._id,
        type: "result_published",
        title: "Event Results Published",
        message: `Results for "${event.title}" have been published. You secured position #${result.position}!`,
        relatedEvent: eventId,
        channels: ["in_app", "email"],
        priority: "high",
      });
    } else if (result.teamId) {
      // NULL CHECK: Team members
      const team = await Team.findById(result.teamId).populate("members");
      if (team && team.members && Array.isArray(team.members)) {
        for (const memberId of team.members) {
          // NULL CHECK: Ensure memberId exists
          if (memberId) {
            notifications.push({
              recipient: memberId,
              sentBy: req.user._id,
              type: "result_published",
              title: "Team Results Published",
              message: `Results for "${event.title}" have been published. Your team "${team.name}" secured position #${result.position}!`,
              relatedEvent: eventId,
              relatedTeam: team._id,
              channels: ["in_app", "email"],
              priority: "high",
            });
          }
        }
      }
    }
  }

  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
  }

  logger.info(
    `[publishResults] Published ${results.length} results for event ${eventId}, sent ${notifications.length} notifications`
  );

  res.status(200).json({
    success: true,
    data: publishedResults,
    message: "Results published successfully. Participants have been notified.",
  });
});

/**
 * @desc    Delete a result
 * @route   DELETE /api/v1/events/:eventId/results/:resultId
 * @access  Private (Organizer+)
 */
exports.deleteResult = asyncHandler(async (req, res) => {
  const { eventId, resultId } = req.params;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check authorization
  if (
    event.organizerId.toString() !== req.user._id.toString() &&
    !["admin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to delete results for this event", 403);
  }

  const result = await EventResult.findOneAndDelete({
    _id: resultId,
    eventId,
  });

  if (!result) {
    throw new AppError("Result not found", 404);
  }

  logger.info(`[deleteResult] Deleted result ${resultId} for event ${eventId}`);

  res.status(200).json({
    success: true,
    message: "Result deleted successfully",
  });
});
