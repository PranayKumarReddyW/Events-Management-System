/**
 * STRICT EVENT CONTROLLER
 * Production-grade implementation with zero silent failures
 * Complete validation on every operation
 */

const Event = require("../models/Event");
const { AppError, asyncHandler } = require("../middleware/strictErrorHandler");
const logger = require("../utils/logger");
const { getRedisClient } = require("../config/redis");

const {
  createEventSchema,
  updateEventSchema,
} = require("../validations/strictEventValidation");

const {
  validateWithSchema,
  validateEventDateConstraints,
  validateTeamSizeConstraints,
  validatePaymentConstraints,
  isEventLocked,
  getLockedFields,
  validateLockedFields,
} = require("../utils/validationUtils");

/**
 * CREATE EVENT - STRICT VALIDATION
 * Every required field is validated
 * No silent failures
 */
exports.createEvent = asyncHandler(async (req, res, next) => {
  logger.info(`[CREATE EVENT] User ${req.user._id} creating event`);

  try {
    // STEP 1: VALIDATE SCHEMA
    let eventData = validateWithSchema(req.body, createEventSchema);
    logger.debug(`[CREATE EVENT] Schema validation passed`);

    // STEP 2: VALIDATE DATE CONSTRAINTS
    validateEventDateConstraints(
      eventData.startDateTime,
      eventData.endDateTime,
      eventData.registrationDeadline
    );
    logger.debug(`[CREATE EVENT] Date constraints validated`);

    // STEP 3: VALIDATE TEAM SIZE CONSTRAINTS
    validateTeamSizeConstraints(eventData.minTeamSize, eventData.maxTeamSize);
    logger.debug(`[CREATE EVENT] Team size constraints validated`);

    // STEP 4: VALIDATE PAYMENT CONSTRAINTS
    validatePaymentConstraints(eventData.isPaid, eventData.amount);
    logger.debug(`[CREATE EVENT] Payment constraints validated`);

    // STEP 5: CHECK FOR DUPLICATES
    const existingEvent = await Event.findOne({ title: eventData.title });
    if (existingEvent) {
      const errors = { title: "An event with this title already exists" };
      logger.warn(`[CREATE EVENT] Duplicate title detected`, {
        title: eventData.title,
      });
      throw new AppError("Event validation failed", 409, { errors });
    }
    logger.debug(`[CREATE EVENT] No duplicates found`);

    // STEP 6: ADD ORGANIZER ID
    eventData.organizerId = req.user._id;
    eventData.status = "draft";
    logger.debug(`[CREATE EVENT] Added organizer: ${req.user._id}`);

    // STEP 7: HANDLE IMAGE DATA
    if (req.body.bannerImageBase64) {
      const maxBase64Size = 5 * 1024 * 1024;
      if (req.body.bannerImageBase64.length > maxBase64Size) {
        const errors = {
          bannerImage: "Banner image is too large (max 3.75MB)",
        };
        throw new AppError("File validation failed", 413, { errors });
      }
      eventData.bannerImage = req.body.bannerImageBase64;
    }

    if (req.body.images && Array.isArray(req.body.images)) {
      eventData.images = req.body.images;
    }

    logger.debug(`[CREATE EVENT] Image data processed`);

    // STEP 8: CREATE EVENT IN DATABASE
    const event = await Event.create(eventData);
    logger.info(`[CREATE EVENT] Event created successfully`, {
      eventId: event._id,
      title: event.title,
    });

    // STEP 9: CLEAR CACHE
    const redis = getRedisClient();
    if (redis) {
      await redis.del("events:all");
      logger.debug(`[CREATE EVENT] Redis cache cleared`);
    }

    // STEP 10: RETURN RESPONSE
    res.status(201).json({
      success: true,
      message: "Event created successfully",
      data: {
        event: event,
      },
    });
  } catch (error) {
    // Re-throw validation errors to be handled by error middleware
    if (error instanceof AppError) {
      throw error;
    }

    // Catch any unexpected errors
    logger.error(`[CREATE EVENT] Unexpected error`, {
      message: error.message,
      stack: error.stack,
    });

    throw new AppError("Failed to create event", 500);
  }
});

/**
 * UPDATE EVENT - STRICT VALIDATION WITH LOCKING
 * Prevents updates to locked fields once event starts
 */
exports.updateEvent = asyncHandler(async (req, res, next) => {
  const { eventId } = req.params;

  logger.info(`[UPDATE EVENT] User ${req.user._id} updating event ${eventId}`);

  try {
    // STEP 1: FIND EVENT
    const event = await Event.findById(eventId);
    if (!event) {
      logger.warn(`[UPDATE EVENT] Event not found`, { eventId });
      throw new AppError("Event not found", 404);
    }
    logger.debug(`[UPDATE EVENT] Event found: ${event.title}`);

    // STEP 2: CHECK AUTHORIZATION
    const isAuthorized =
      event.organizerId.toString() === req.user._id.toString() ||
      req.user.role === "admin" ||
      req.user.role === "super_admin";

    if (!isAuthorized) {
      logger.warn(`[UPDATE EVENT] Unauthorized user ${req.user._id}`, {
        eventId,
        organizerId: event.organizerId,
      });
      throw new AppError("Not authorized to update this event", 403);
    }
    logger.debug(`[UPDATE EVENT] Authorization verified`);

    // STEP 3: VALIDATE SCHEMA
    let updateData = validateWithSchema(req.body, updateEventSchema);
    logger.debug(`[UPDATE EVENT] Schema validation passed`);

    // STEP 4: CHECK LOCKED FIELDS
    const lockedFields = getLockedFields(event.status);
    if (lockedFields.length > 0) {
      validateLockedFields(lockedFields, updateData);
      logger.debug(`[UPDATE EVENT] Locked fields check passed`);
    }

    // STEP 5: VALIDATE DATE CONSTRAINTS IF DATES ARE BEING UPDATED
    if (
      updateData.startDateTime ||
      updateData.endDateTime ||
      updateData.registrationDeadline
    ) {
      validateEventDateConstraints(
        updateData.startDateTime || event.startDateTime,
        updateData.endDateTime || event.endDateTime,
        updateData.registrationDeadline || event.registrationDeadline
      );
      logger.debug(`[UPDATE EVENT] Date constraints validated`);
    }

    // STEP 6: VALIDATE TEAM SIZE CONSTRAINTS IF BEING UPDATED
    if (updateData.minTeamSize || updateData.maxTeamSize) {
      validateTeamSizeConstraints(
        updateData.minTeamSize || event.minTeamSize,
        updateData.maxTeamSize || event.maxTeamSize
      );
      logger.debug(`[UPDATE EVENT] Team size constraints validated`);
    }

    // STEP 7: VALIDATE PAYMENT CONSTRAINTS IF BEING UPDATED
    if (updateData.isPaid !== undefined || updateData.amount !== undefined) {
      validatePaymentConstraints(
        updateData.isPaid !== undefined ? updateData.isPaid : event.isPaid,
        updateData.amount !== undefined ? updateData.amount : event.amount
      );
      logger.debug(`[UPDATE EVENT] Payment constraints validated`);
    }

    // STEP 8: HANDLE IMAGE DATA
    if (req.body.bannerImageBase64) {
      const maxBase64Size = 5 * 1024 * 1024;
      if (req.body.bannerImageBase64.length > maxBase64Size) {
        const errors = {
          bannerImage: "Banner image is too large (max 3.75MB)",
        };
        throw new AppError("File validation failed", 413, { errors });
      }
      updateData.bannerImage = req.body.bannerImageBase64;
    }

    if (req.body.images && Array.isArray(req.body.images)) {
      updateData.images = req.body.images;
    }

    logger.debug(`[UPDATE EVENT] Image data processed`);

    // STEP 9: UPDATE EVENT
    const updatedEvent = await Event.findByIdAndUpdate(eventId, updateData, {
      new: true,
      runValidators: true,
    });

    logger.info(`[UPDATE EVENT] Event updated successfully`, {
      eventId,
      title: updatedEvent.title,
    });

    // STEP 10: CLEAR CACHE
    const redis = getRedisClient();
    if (redis) {
      await redis.del(`event:${eventId}`);
      await redis.del("events:all");
      logger.debug(`[UPDATE EVENT] Redis cache cleared`);
    }

    // STEP 11: RETURN RESPONSE
    res.status(200).json({
      success: true,
      message: "Event updated successfully",
      data: {
        event: updatedEvent,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    logger.error(`[UPDATE EVENT] Unexpected error`, {
      message: error.message,
      stack: error.stack,
      eventId,
    });

    throw new AppError("Failed to update event", 500);
  }
});

/**
 * GET EVENT BY ID
 * Returns complete event with all details
 */
exports.getEvent = asyncHandler(async (req, res, next) => {
  const { eventId } = req.params;

  logger.debug(`[GET EVENT] Fetching event ${eventId}`);

  try {
    const event = await Event.findById(eventId)
      .populate("organizerId", "name email")
      .lean();

    if (!event) {
      logger.warn(`[GET EVENT] Event not found`, { eventId });
      throw new AppError("Event not found", 404);
    }

    logger.debug(`[GET EVENT] Event found: ${event.title}`);

    res.status(200).json({
      success: true,
      data: {
        event,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    logger.error(`[GET EVENT] Unexpected error`, {
      message: error.message,
      eventId,
    });

    throw new AppError("Failed to fetch event", 500);
  }
});

/**
 * LIST EVENTS WITH PAGINATION
 * Supports filtering and sorting
 */
exports.listEvents = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10, status = "published", search } = req.query;

  logger.debug(`[LIST EVENTS] Fetching events`, { page, limit, status });

  try {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const query = { status };

    if (search) {
      query.$or = [
        { title: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
      ];
    }

    const events = await Event.find(query)
      .select(
        "title description eventType eventMode startDateTime endDateTime venue bannerImage organizerId"
      )
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 })
      .lean();

    const total = await Event.countDocuments(query);

    logger.debug(`[LIST EVENTS] Found ${events.length} events`, {
      total,
      page: pageNum,
    });

    res.status(200).json({
      success: true,
      data: {
        events,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    logger.error(`[LIST EVENTS] Unexpected error`, {
      message: error.message,
    });

    throw new AppError("Failed to fetch events", 500);
  }
});

/**
 * DELETE EVENT
 * Only event organizer or admin can delete
 */
exports.deleteEvent = asyncHandler(async (req, res, next) => {
  const { eventId } = req.params;

  logger.info(`[DELETE EVENT] User ${req.user._id} deleting event ${eventId}`);

  try {
    const event = await Event.findById(eventId);

    if (!event) {
      logger.warn(`[DELETE EVENT] Event not found`, { eventId });
      throw new AppError("Event not found", 404);
    }

    // Check authorization
    const isAuthorized =
      event.organizerId.toString() === req.user._id.toString() ||
      req.user.role === "admin" ||
      req.user.role === "super_admin";

    if (!isAuthorized) {
      logger.warn(`[DELETE EVENT] Unauthorized deletion attempt`, {
        eventId,
        userId: req.user._id,
      });
      throw new AppError("Not authorized to delete this event", 403);
    }

    // Prevent deletion of started events
    if (isEventLocked(event.status)) {
      const errors = {
        status: `Cannot delete event with status "${event.status}"`,
      };
      logger.warn(`[DELETE EVENT] Attempted deletion of locked event`, {
        eventId,
        status: event.status,
      });
      throw new AppError("Cannot delete this event", 403, { errors });
    }

    await Event.findByIdAndDelete(eventId);

    logger.info(`[DELETE EVENT] Event deleted successfully`, {
      eventId,
      title: event.title,
    });

    // Clear cache
    const redis = getRedisClient();
    if (redis) {
      await redis.del(`event:${eventId}`);
      await redis.del("events:all");
    }

    res.status(200).json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    logger.error(`[DELETE EVENT] Unexpected error`, {
      message: error.message,
      eventId,
    });

    throw new AppError("Failed to delete event", 500);
  }
});

module.exports = exports;
