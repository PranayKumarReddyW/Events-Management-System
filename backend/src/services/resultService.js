const EventResult = require("../models/EventResult");
const Event = require("../models/Event");
const EventRegistration = require("../models/EventRegistration");
const Team = require("../models/Team");
const Notification = require("../models/Notification");
const AppError = require("../middleware/errorHandler").AppError;
const logger = require("../utils/logger");

class ResultService {
  /**
   * Add or update event results
   * @param {string} eventId - Event ID
   * @param {Array} results - Array of result objects
   * @param {string} userId - User making the request
   * @returns {Promise<Array>} Saved results
   */
  async addResults(eventId, results, userId) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    // Validate results array
    if (!Array.isArray(results) || results.length === 0) {
      throw new AppError("Results array is required and cannot be empty", 400);
    }

    const savedResults = [];

    for (const result of results) {
      const {
        position,
        userId: participantUserId,
        teamId,
        score,
        remarks,
      } = result;

      // Validate required fields
      if (!position) {
        throw new AppError("Position is required for all results", 400);
      }

      if (!participantUserId && !teamId) {
        throw new AppError(
          "Either userId or teamId is required for each result",
          400
        );
      }

      // Check if result already exists for this position
      const existingResult = await EventResult.findOne({
        eventId,
        position,
      });

      if (existingResult) {
        // Update existing result
        existingResult.userId = participantUserId;
        existingResult.teamId = teamId;
        existingResult.score = score;
        existingResult.remarks = remarks;
        existingResult.publishedAt = null; // Reset published status
        await existingResult.save();
        savedResults.push(existingResult);
      } else {
        // Create new result
        const newResult = await EventResult.create({
          eventId,
          position,
          userId: participantUserId,
          teamId,
          score,
          remarks,
          publishedAt: null,
        });
        savedResults.push(newResult);
      }
    }

    logger.info(
      `[ResultService] Added ${savedResults.length} results for event ${eventId} by user ${userId}`
    );

    return savedResults;
  }

  /**
   * Get event results with authorization check
   * @param {string} eventId - Event ID
   * @param {Object} user - Current user (optional)
   * @returns {Promise<Array>} Results
   */
  async getResults(eventId, user = null) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    // Check if user can view unpublished results
    const canViewUnpublished =
      user &&
      user._id &&
      (event.organizerId.toString() === user._id.toString() ||
        ["admin", "super_admin"].includes(user.role));

    const query = { eventId };
    if (!canViewUnpublished) {
      query.publishedAt = { $ne: null };
    }

    const results = await EventResult.find(query)
      .populate("userId", "fullName email profilePicture department")
      .populate("teamId", "name members")
      .sort({ position: 1 });

    return results;
  }

  /**
   * Publish event results and notify participants
   * @param {string} eventId - Event ID
   * @param {string} userId - User publishing results
   * @returns {Promise<Object>} Published results and notification count
   */
  async publishResults(eventId, userId) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    // Get all unpublished results
    const results = await EventResult.find({
      eventId,
      publishedAt: null,
    });

    if (results.length === 0) {
      throw new AppError("No unpublished results found", 400);
    }

    // Mark as published
    const publishedAt = new Date();
    await EventResult.updateMany(
      { eventId, publishedAt: null },
      { publishedAt }
    );

    // Populate results for notifications
    const publishedResults = await EventResult.find({
      eventId,
      publishedAt,
    })
      .populate("userId", "fullName email")
      .populate("teamId", "name members");

    // Create notifications
    const notificationCount = await this._sendResultNotifications(
      publishedResults,
      event,
      userId
    );

    logger.info(
      `[ResultService] Published ${results.length} results for event ${eventId}, sent ${notificationCount} notifications`
    );

    return {
      results: publishedResults,
      notificationCount,
    };
  }

  /**
   * Delete a result
   * @param {string} eventId - Event ID
   * @param {string} resultId - Result ID
   * @returns {Promise<void>}
   */
  async deleteResult(eventId, resultId) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    const result = await EventResult.findById(resultId);
    if (!result) {
      throw new AppError("Result not found", 404);
    }

    if (result.eventId.toString() !== eventId) {
      throw new AppError("Result does not belong to this event", 400);
    }

    if (result.publishedAt) {
      throw new AppError("Cannot delete published results", 400);
    }

    await result.deleteOne();
    logger.info(
      `[ResultService] Deleted result ${resultId} for event ${eventId}`
    );
  }

  /**
   * Send notifications to participants about published results
   * @private
   * @param {Array} publishedResults - Published results
   * @param {Object} event - Event object
   * @param {string} userId - User who published results
   * @returns {Promise<number>} Number of notifications sent
   */
  async _sendResultNotifications(publishedResults, event, userId) {
    const notifications = [];

    for (const result of publishedResults) {
      if (result.userId) {
        // Individual participant
        notifications.push({
          recipient: result.userId._id,
          sentBy: userId,
          type: "result_published",
          title: "Event Results Published",
          message: `Results for "${event.title}" have been published. You secured position #${result.position}!`,
          relatedEvent: event._id,
          channels: ["in_app", "email"],
          priority: "high",
        });
      } else if (result.teamId) {
        // Team members
        const team = await Team.findById(result.teamId).populate("members");
        if (team) {
          for (const memberId of team.members) {
            notifications.push({
              recipient: memberId,
              sentBy: userId,
              type: "result_published",
              title: "Team Results Published",
              message: `Results for "${event.title}" have been published. Your team "${team.name}" secured position #${result.position}!`,
              relatedEvent: event._id,
              relatedTeam: team._id,
              channels: ["in_app", "email"],
              priority: "high",
            });
          }
        }
      }
    }

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    return notifications.length;
  }

  /**
   * Check if user is authorized to manage results
   * @param {Object} event - Event object
   * @param {Object} user - Current user
   * @returns {boolean} Authorization status
   */
  isAuthorized(event, user) {
    if (!user || !user._id) {
      return false;
    }

    return (
      event.organizerId.toString() === user._id.toString() ||
      ["admin", "super_admin"].includes(user.role)
    );
  }
}

module.exports = new ResultService();
