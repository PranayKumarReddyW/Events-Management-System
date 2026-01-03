const EventRegistration = require("../models/EventRegistration");
const Event = require("../models/Event");
const Team = require("../models/Team");
const User = require("../models/User");
const Payment = require("../models/Payment");
const Notification = require("../models/Notification");
const AppError = require("../middleware/errorHandler").AppError;
const logger = require("../utils/logger");

class RegistrationService {
  /**
   * Register for an event (individual or team)
   * @param {string} eventId - Event ID
   * @param {Object} registrationData - Registration data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Registration object
   */
  async registerForEvent(eventId, registrationData, userId) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    // Validate event status
    if (event.status !== "published") {
      throw new AppError("Event is not available for registration", 400);
    }

    // Check registration dates
    if (
      event.registrationStartDate &&
      new Date() < new Date(event.registrationStartDate)
    ) {
      throw new AppError("Registration has not started yet", 400);
    }

    if (
      event.registrationEndDate &&
      new Date() > new Date(event.registrationEndDate)
    ) {
      throw new AppError("Registration has ended", 400);
    }

    // Check capacity
    if (
      event.maxParticipants &&
      event.registrationCount >= event.maxParticipants
    ) {
      throw new AppError("Event is full", 400);
    }

    // Check for existing registration
    const existingRegistration = await EventRegistration.findOne({
      eventId,
      userId,
      status: { $in: ["pending", "confirmed", "checked_in"] },
    });

    if (existingRegistration) {
      throw new AppError("You are already registered for this event", 400);
    }

    // Validate team requirements
    if (event.eventType === "team") {
      if (!registrationData.teamId) {
        throw new AppError("Team ID is required for team events", 400);
      }

      const team = await Team.findById(registrationData.teamId);
      if (!team) {
        throw new AppError("Team not found", 404);
      }

      // Check if user is member of team
      const isMember = team.members.some(
        (memberId) => memberId.toString() === userId.toString()
      );
      if (!isMember) {
        throw new AppError("You are not a member of this team", 403);
      }

      // Check team size
      if (event.minTeamSize && team.members.length < event.minTeamSize) {
        throw new AppError(
          `Team must have at least ${event.minTeamSize} members`,
          400
        );
      }

      if (event.maxTeamSize && team.members.length > event.maxTeamSize) {
        throw new AppError(
          `Team cannot have more than ${event.maxTeamSize} members`,
          400
        );
      }
    }

    // Create registration
    const registration = await EventRegistration.create({
      eventId,
      userId,
      teamId: registrationData.teamId || null,
      status: event.requiresPayment ? "pending" : "confirmed",
      registeredAt: new Date(),
      additionalInfo: registrationData.additionalInfo || {},
    });

    // Update event registration count
    await Event.findByIdAndUpdate(eventId, {
      $inc: { registrationCount: 1 },
    });

    // Send confirmation notification
    await this._sendRegistrationNotification(registration, event);

    logger.info(
      `[RegistrationService] User ${userId} registered for event ${eventId}`
    );

    return registration;
  }

  /**
   * Cancel registration
   * @param {string} registrationId - Registration ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated registration
   */
  async cancelRegistration(registrationId, userId) {
    const registration = await EventRegistration.findById(registrationId);
    if (!registration) {
      throw new AppError("Registration not found", 404);
    }

    if (registration.userId.toString() !== userId.toString()) {
      throw new AppError(
        "You are not authorized to cancel this registration",
        403
      );
    }

    if (registration.status === "cancelled") {
      throw new AppError("Registration is already cancelled", 400);
    }

    if (registration.status === "checked_in") {
      throw new AppError("Cannot cancel after check-in", 400);
    }

    const event = await Event.findById(registration.eventId);

    // Check cancellation deadline
    if (
      event.cancellationDeadline &&
      new Date() > new Date(event.cancellationDeadline)
    ) {
      throw new AppError("Cancellation deadline has passed", 400);
    }

    // Update registration status
    registration.status = "cancelled";
    registration.cancelledAt = new Date();
    await registration.save();

    // Decrement event registration count
    await Event.findByIdAndUpdate(registration.eventId, {
      $inc: { registrationCount: -1 },
    });

    // Handle refund if payment was made
    if (registration.paymentStatus === "completed") {
      await this._processRefund(registration, event);
    }

    logger.info(
      `[RegistrationService] Registration ${registrationId} cancelled by user ${userId}`
    );

    return registration;
  }

  /**
   * Check in participant
   * @param {string} registrationId - Registration ID
   * @param {string} userId - Organizer/admin user ID
   * @returns {Promise<Object>} Updated registration
   */
  async checkinParticipant(registrationId, userId) {
    const registration = await EventRegistration.findById(registrationId);
    if (!registration) {
      throw new AppError("Registration not found", 404);
    }

    if (registration.status !== "confirmed") {
      throw new AppError("Only confirmed registrations can be checked in", 400);
    }

    const event = await Event.findById(registration.eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    // Check if event has started
    if (new Date() < new Date(event.startDate)) {
      throw new AppError("Event has not started yet", 400);
    }

    // Update registration
    registration.status = "checked_in";
    registration.checkInTime = new Date();
    await registration.save();

    logger.info(
      `[RegistrationService] Participant ${registration.userId} checked in for event ${registration.eventId}`
    );

    return registration;
  }

  /**
   * Update registration status (admin/organizer only)
   * @param {string} registrationId - Registration ID
   * @param {string} newStatus - New status
   * @param {string} userId - Admin/organizer user ID
   * @returns {Promise<Object>} Updated registration
   */
  async updateRegistrationStatus(registrationId, newStatus, userId) {
    const registration = await EventRegistration.findById(registrationId);
    if (!registration) {
      throw new AppError("Registration not found", 404);
    }

    const event = await Event.findById(registration.eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    // Validate status transition
    const validStatuses = [
      "pending",
      "confirmed",
      "cancelled",
      "checked_in",
      "waitlisted",
    ];
    if (!validStatuses.includes(newStatus)) {
      throw new AppError("Invalid status", 400);
    }

    const oldStatus = registration.status;
    registration.status = newStatus;

    if (newStatus === "checked_in") {
      registration.checkInTime = new Date();
    }

    await registration.save();

    // Update event count if necessary
    if (oldStatus === "confirmed" && newStatus === "cancelled") {
      await Event.findByIdAndUpdate(registration.eventId, {
        $inc: { registrationCount: -1 },
      });
    } else if (oldStatus === "cancelled" && newStatus === "confirmed") {
      await Event.findByIdAndUpdate(registration.eventId, {
        $inc: { registrationCount: 1 },
      });
    }

    logger.info(
      `[RegistrationService] Registration ${registrationId} status updated from ${oldStatus} to ${newStatus}`
    );

    return registration;
  }

  /**
   * Get registrations with filters
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Registrations and metadata
   */
  async getRegistrations(filters = {}, pagination = {}) {
    const { eventId, userId, status, teamId } = filters;
    const { page = 1, limit = 50, sort = "-registeredAt" } = pagination;

    const query = {};

    if (eventId) query.eventId = eventId;
    if (userId) query.userId = userId;
    if (status) query.status = status;
    if (teamId) query.teamId = teamId;

    const skip = (page - 1) * limit;

    const [registrations, total] = await Promise.all([
      EventRegistration.find(query)
        .populate(
          "userId",
          "fullName email department profilePicture rollNumber"
        )
        .populate("eventId", "title startDate endDate venue")
        .populate("teamId", "name members")
        .sort(sort)
        .limit(limit)
        .skip(skip),
      EventRegistration.countDocuments(query),
    ]);

    return {
      registrations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get registration by ID
   * @param {string} registrationId - Registration ID
   * @returns {Promise<Object>} Registration
   */
  async getRegistrationById(registrationId) {
    const registration = await EventRegistration.findById(registrationId)
      .populate(
        "userId",
        "fullName email department profilePicture rollNumber phone"
      )
      .populate("eventId", "title startDate endDate venue organizerId")
      .populate("teamId", "name members");

    if (!registration) {
      throw new AppError("Registration not found", 404);
    }

    return registration;
  }

  /**
   * Send registration confirmation notification
   * @private
   * @param {Object} registration - Registration object
   * @param {Object} event - Event object
   * @returns {Promise<void>}
   */
  async _sendRegistrationNotification(registration, event) {
    await Notification.create({
      recipient: registration.userId,
      sentBy: event.organizerId,
      type: "registration_confirmed",
      title: "Registration Confirmed",
      message: `Your registration for "${
        event.title
      }" has been confirmed. Event starts on ${new Date(
        event.startDate
      ).toLocaleDateString()}.`,
      relatedEvent: event._id,
      channels: ["in_app", "email"],
      priority: "medium",
    });
  }

  /**
   * Process refund for cancelled registration
   * @private
   * @param {Object} registration - Registration object
   * @param {Object} event - Event object
   * @returns {Promise<void>}
   */
  async _processRefund(registration, event) {
    // Find payment
    const payment = await Payment.findOne({
      registrationId: registration._id,
      status: "completed",
    });

    if (!payment) {
      logger.warn(
        `[RegistrationService] No payment found for registration ${registration._id}`
      );
      return;
    }

    // Check refund policy
    if (!event.refundPolicy || event.refundPolicy === "no_refund") {
      logger.info(
        `[RegistrationService] No refund policy for event ${event._id}`
      );
      return;
    }

    // Calculate refund amount based on policy
    let refundPercentage = 100;
    if (event.refundPolicy === "partial") {
      refundPercentage = 50; // 50% refund
    }

    const refundAmount = (payment.amount * refundPercentage) / 100;

    // Create refund record (actual payment gateway integration needed)
    logger.info(
      `[RegistrationService] Would process refund of ₹${refundAmount} for payment ${payment._id}`
    );

    // Note: Actual refund processing would go here
    // This is a placeholder for payment gateway integration
  }

  /**
   * Check if user is authorized to manage registration
   * @param {Object} registration - Registration object
   * @param {Object} user - Current user
   * @returns {boolean} Authorization status
   */
  isAuthorized(registration, user) {
    if (!user || !user._id) {
      return false;
    }

    return (
      registration.userId.toString() === user._id.toString() ||
      ["admin", "super_admin"].includes(user.role)
    );
  }
}

module.exports = new RegistrationService();
