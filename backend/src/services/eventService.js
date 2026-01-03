const Event = require("../models/Event");
const EventApproval = require("../models/EventApproval");
const EventRegistration = require("../models/EventRegistration");
const Notification = require("../models/Notification");
const AppError = require("../middleware/errorHandler").AppError;
const logger = require("../utils/logger");

class EventService {
  /**
   * Create a new event
   * @param {Object} eventData - Event data
   * @param {string} organizerId - Organizer user ID
   * @returns {Promise<Object>} Created event
   */
  async createEvent(eventData, organizerId) {
    const event = await Event.create({
      ...eventData,
      organizerId,
      status: "draft",
      registrationCount: 0,
    });

    logger.info(
      `[EventService] Created event ${event._id} by organizer ${organizerId}`
    );
    return event;
  }

  /**
   * Update event
   * @param {string} eventId - Event ID
   * @param {Object} updateData - Update data
   * @param {Object} user - Current user
   * @returns {Promise<Object>} Updated event
   */
  async updateEvent(eventId, updateData, user) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    // Check authorization
    if (!this.isAuthorized(event, user)) {
      throw new AppError("You are not authorized to update this event", 403);
    }

    // Don't allow changing critical fields after publishing
    if (event.status === "published") {
      const restrictedFields = ["organizerId", "eventType", "maxParticipants"];
      const hasRestrictedChanges = restrictedFields.some(
        (field) => updateData[field] !== undefined
      );

      if (hasRestrictedChanges) {
        throw new AppError(
          "Cannot modify critical fields after event is published",
          400
        );
      }
    }

    Object.assign(event, updateData);
    await event.save();

    logger.info(`[EventService] Updated event ${eventId} by user ${user._id}`);
    return event;
  }

  /**
   * Submit event for approval
   * @param {string} eventId - Event ID
   * @param {Object} user - Current user
   * @returns {Promise<Object>} Approval request
   */
  async submitForApproval(eventId, user) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (!this.isAuthorized(event, user)) {
      throw new AppError("You are not authorized to submit this event", 403);
    }

    if (event.status !== "draft") {
      throw new AppError(
        "Only draft events can be submitted for approval",
        400
      );
    }

    // Validate required fields
    this._validateRequiredFields(event);

    // Create approval request
    const approval = await EventApproval.create({
      eventId: event._id,
      requestedBy: user._id,
      status: "pending",
    });

    // Update event status
    event.status = "pending_approval";
    await event.save();

    // Notify admins
    await this._notifyAdminsForApproval(event, user);

    logger.info(
      `[EventService] Event ${eventId} submitted for approval by ${user._id}`
    );
    return approval;
  }

  /**
   * Approve or reject event
   * @param {string} eventId - Event ID
   * @param {string} approvalId - Approval ID
   * @param {string} status - "approved" or "rejected"
   * @param {string} remarks - Admin remarks
   * @param {Object} user - Current user (admin)
   * @returns {Promise<Object>} Updated approval
   */
  async processApproval(eventId, approvalId, status, remarks, user) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    const approval = await EventApproval.findById(approvalId);
    if (!approval) {
      throw new AppError("Approval request not found", 404);
    }

    if (approval.eventId.toString() !== eventId) {
      throw new AppError("Approval request does not match event", 400);
    }

    if (approval.status !== "pending") {
      throw new AppError("This approval has already been processed", 400);
    }

    // Update approval
    approval.status = status;
    approval.reviewedBy = user._id;
    approval.reviewedAt = new Date();
    approval.remarks = remarks;
    await approval.save();

    // Update event status
    if (status === "approved") {
      event.status = "published";
      event.approvedAt = new Date();
      event.approvedBy = user._id;
    } else {
      event.status = "draft";
    }
    await event.save();

    // Notify organizer
    await this._notifyOrganizerOfApproval(event, approval, user);

    logger.info(
      `[EventService] Event ${eventId} ${status} by admin ${user._id}`
    );
    return approval;
  }

  /**
   * Delete event (soft delete)
   * @param {string} eventId - Event ID
   * @param {Object} user - Current user
   * @returns {Promise<void>}
   */
  async deleteEvent(eventId, user) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (!this.isAuthorized(event, user)) {
      throw new AppError("You are not authorized to delete this event", 403);
    }

    // Check for registrations
    const registrationCount = await EventRegistration.countDocuments({
      eventId: event._id,
      status: { $in: ["confirmed", "checked_in"] },
    });

    if (registrationCount > 0) {
      throw new AppError(
        "Cannot delete event with active registrations. Cancel the event instead.",
        400
      );
    }

    // Soft delete
    event.status = "cancelled";
    event.cancelledAt = new Date();
    event.cancelledBy = user._id;
    await event.save();

    logger.info(`[EventService] Event ${eventId} deleted by user ${user._id}`);
  }

  /**
   * Get events with filters
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Events and metadata
   */
  async getEvents(filters = {}, pagination = {}) {
    const {
      status,
      eventType,
      category,
      organizerId,
      search,
      startDate,
      endDate,
      department,
    } = filters;

    const { page = 1, limit = 10, sort = "-createdAt" } = pagination;

    const query = {};

    // Apply filters
    if (status) query.status = status;
    if (eventType) query.eventType = eventType;
    if (category) query.category = category;
    if (organizerId) query.organizerId = organizerId;
    if (department) query.department = department;

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      Event.find(query)
        .populate("organizerId", "fullName email department")
        .populate("clubId", "name logo")
        .sort(sort)
        .limit(limit)
        .skip(skip),
      Event.countDocuments(query),
    ]);

    return {
      events,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get event by ID with authorization check
   * @param {string} eventId - Event ID
   * @param {Object} user - Current user (optional)
   * @returns {Promise<Object>} Event
   */
  async getEventById(eventId, user = null) {
    const event = await Event.findById(eventId)
      .populate("organizerId", "fullName email department profilePicture")
      .populate("clubId", "name logo description")
      .populate("department", "name");

    if (!event) {
      throw new AppError("Event not found", 404);
    }

    // Check if user can view unpublished events
    if (event.status !== "published") {
      if (!user || !this.isAuthorized(event, user)) {
        throw new AppError("You are not authorized to view this event", 403);
      }
    }

    return event;
  }

  /**
   * Check if user is authorized to manage event
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

  /**
   * Validate required fields before submission
   * @private
   * @param {Object} event - Event object
   * @throws {AppError} If validation fails
   */
  _validateRequiredFields(event) {
    const required = [
      "title",
      "description",
      "eventType",
      "category",
      "startDate",
      "endDate",
      "venue",
      "maxParticipants",
    ];

    const missing = required.filter((field) => !event[field]);

    if (missing.length > 0) {
      throw new AppError(`Missing required fields: ${missing.join(", ")}`, 400);
    }

    if (new Date(event.startDate) < new Date()) {
      throw new AppError("Event start date cannot be in the past", 400);
    }

    if (new Date(event.endDate) < new Date(event.startDate)) {
      throw new AppError("Event end date must be after start date", 400);
    }
  }

  /**
   * Notify admins about new approval request
   * @private
   * @param {Object} event - Event object
   * @param {Object} user - User who submitted
   * @returns {Promise<void>}
   */
  async _notifyAdminsForApproval(event, user) {
    // This would query User model for admins, simplified for now
    const notification = {
      type: "approval_request",
      title: "New Event Approval Request",
      message: `${user.fullName} has submitted "${event.title}" for approval`,
      relatedEvent: event._id,
      sentBy: user._id,
      channels: ["in_app", "email"],
      priority: "medium",
    };

    // Note: In production, this should send to all admins
    // Skipping actual implementation to avoid complexity
    logger.info(
      `[EventService] Would notify admins about approval for event ${event._id}`
    );
  }

  /**
   * Notify organizer about approval decision
   * @private
   * @param {Object} event - Event object
   * @param {Object} approval - Approval object
   * @param {Object} admin - Admin who processed
   * @returns {Promise<void>}
   */
  async _notifyOrganizerOfApproval(event, approval, admin) {
    const notification = await Notification.create({
      recipient: event.organizerId,
      sentBy: admin._id,
      type:
        approval.status === "approved"
          ? "approval_granted"
          : "approval_rejected",
      title:
        approval.status === "approved"
          ? "Event Approved"
          : "Event Approval Rejected",
      message:
        approval.status === "approved"
          ? `Your event "${event.title}" has been approved and is now published!`
          : `Your event "${event.title}" was not approved. Reason: ${
              approval.remarks || "No reason provided"
            }`,
      relatedEvent: event._id,
      channels: ["in_app", "email"],
      priority: "high",
    });

    return notification;
  }
}

module.exports = new EventService();
