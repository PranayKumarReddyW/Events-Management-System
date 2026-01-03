const Event = require("../models/Event");
const EventApproval = require("../models/EventApproval");
const EventRegistration = require("../models/EventRegistration");
const { AppError } = require("../middleware/errorHandler");
const { getRedisClient } = require("../config/redis");
const fs = require("fs");

// Create event
exports.createEvent = async (req, res, next) => {
  try {
    // Check for duplicate title
    const existingEvent = await Event.findOne({ title: req.body.title });
    if (existingEvent) {
      return next(new AppError("An event with this title already exists", 400));
    }

    const eventData = {
      ...req.body,
      organizerId: req.user._id,
      // Set status to draft by default, organizer must publish manually
      status: req.body.status || "draft",
    };

    // Parse arrays if they come as array notation from FormData
    if (req.body["eligibleYears[]"]) {
      eventData.eligibleYears = Array.isArray(req.body["eligibleYears[]"])
        ? req.body["eligibleYears[]"].map(Number)
        : [Number(req.body["eligibleYears[]"])];
    }
    if (req.body["eligibleDepartments[]"]) {
      eventData.eligibleDepartments = Array.isArray(
        req.body["eligibleDepartments[]"]
      )
        ? req.body["eligibleDepartments[]"]
        : [req.body["eligibleDepartments[]"]];
    }

    // Parse schedule if it comes as JSON string from FormData
    if (req.body.schedule && typeof req.body.schedule === "string") {
      try {
        eventData.schedule = JSON.parse(req.body.schedule);
      } catch (e) {
        return next(new AppError("Invalid schedule format", 400));
      }
    }

    // Handle uploaded banner image - support both file upload and base64
    if (req.body.bannerImageBase64) {
      // Store base64 directly in MongoDB
      eventData.bannerImage = req.body.bannerImageBase64;
    } else if (req.files && req.files.length > 0) {
      // Convert uploaded file to base64
      const fs = require("fs");
      const fileBuffer = fs.readFileSync(req.files[0].path);
      const base64Image = `data:${
        req.files[0].mimetype
      };base64,${fileBuffer.toString("base64")}`;
      eventData.bannerImage = base64Image;
      // Clean up the uploaded file
      fs.unlinkSync(req.files[0].path);
    } else if (req.file) {
      // Convert uploaded file to base64
      const fs = require("fs");
      const fileBuffer = fs.readFileSync(req.file.path);
      const base64Image = `data:${
        req.file.mimetype
      };base64,${fileBuffer.toString("base64")}`;
      eventData.bannerImage = base64Image;
      // Clean up the uploaded file
      fs.unlinkSync(req.file.path);
    }

    // Handle multiple images array
    if (req.body.images && Array.isArray(req.body.images)) {
      eventData.images = req.body.images; // Assume these are already base64
    } else if (req.body.images && typeof req.body.images === "string") {
      try {
        eventData.images = JSON.parse(req.body.images);
      } catch (e) {
        eventData.images = [req.body.images]; // Single image
      }
    }

    const event = await Event.create(eventData);

    // Approval workflow:
    // - Admins can always auto-approve.
    // - Non-admins only require approval when event.requiresApproval is true.
    const isAdmin = ["admin", "super_admin"].includes(req.user.role);
    if (isAdmin || event.requiresApproval !== true) {
      event.approvalStatus = "approved";
      await event.save();
    } else {
      await EventApproval.create({
        eventId: event._id,
        submittedBy: req.user._id,
        status: "pending",
      });
    }

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      data: { event },
    });
  } catch (error) {
    next(error);
  }
};

// Get all events
exports.getAllEvents = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      eventType,
      status,
      visibility,
      eventMode,
      isPaid,
      startDate,
      endDate,
      departmentId,
      clubId,
      sortBy = "startDateTime",
      order = "asc",
    } = req.query;

    // Build query
    const query = {};

    // Search
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    // Filters
    if (category) query.category = category;
    if (eventType) query.eventType = eventType;
    if (status) query.status = status;
    if (eventMode) query.eventMode = eventMode;
    if (isPaid !== undefined) query.isPaid = isPaid === "true";
    if (departmentId) query.departmentId = departmentId;
    if (clubId) query.clubId = clubId;

    // Visibility based on user role
    if (req.user) {
      if (!["admin", "super_admin"].includes(req.user.role)) {
        query.$or = [
          { visibility: "public" },
          { organizerId: req.user._id },
          {
            departmentId: req.user.departmentId,
            visibility: "department_only",
          },
        ];
      }
    } else {
      query.visibility = "public";
    }

    // Status filter
    if (!status) {
      query.status = { $in: ["published", "ongoing"] };
    }

    // Date range
    if (startDate || endDate) {
      query.startDateTime = {};
      if (startDate) query.startDateTime.$gte = new Date(startDate);
      if (endDate) query.startDateTime.$lte = new Date(endDate);
    }

    // Pagination
    const skip = (page - 1) * limit;
    const sortOrder = order === "desc" ? -1 : 1;

    const events = await Event.find(query)
      .populate("organizerId", "fullName email profilePicture")
      .populate("clubId", "name logo")
      .populate("departmentId", "name code")
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Event.countDocuments(query);

    // If user is logged in, check registration status for each event
    let eventsWithRegistrationStatus = events;
    if (req.user) {
      const eventIds = events.map((event) => event._id);

      // Find all registrations for this user for these events
      const userRegistrations = await EventRegistration.find({
        user: req.user._id,
        event: { $in: eventIds },
        status: { $in: ["pending", "confirmed", "waitlisted"] }, // Exclude cancelled/rejected
      }).select("event status");

      // Create a map for quick lookup
      const registrationMap = {};
      userRegistrations.forEach((reg) => {
        registrationMap[reg.event.toString()] = {
          isRegistered: true,
          registrationStatus: reg.status,
        };
      });

      // Add registration status to each event
      eventsWithRegistrationStatus = events.map((event) => {
        const eventObj = event.toObject();
        const eventId = event._id.toString();

        if (registrationMap[eventId]) {
          eventObj.isRegistered = true;
          eventObj.registrationStatus =
            registrationMap[eventId].registrationStatus;
        } else {
          eventObj.isRegistered = false;
          eventObj.registrationStatus = null;
        }

        return eventObj;
      });
    } else {
      // If no user is logged in, add default values
      eventsWithRegistrationStatus = events.map((event) => ({
        ...event.toObject(),
        isRegistered: false,
        registrationStatus: null,
      }));
    }

    res.status(200).json({
      success: true,
      data: {
        events: eventsWithRegistrationStatus,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get event by ID or slug
exports.getEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check Redis cache first
    const redis = getRedisClient();
    let event;

    if (redis) {
      const cachedEvent = await redis.get(`event:${id}`);
      if (cachedEvent) {
        return res.status(200).json({
          success: true,
          data: { event: JSON.parse(cachedEvent) },
        });
      }
    }

    // Try to find by ID first, then by slug
    event = await Event.findOne({
      $or: [{ _id: id }, { slug: id }],
    })
      .populate("organizerId", "fullName email phone profilePicture")
      .populate("organizers", "fullName email profilePicture")
      .populate("clubId", "name logo description")
      .populate("departmentId", "name code");

    if (!event) {
      return next(new AppError("Event not found", 404));
    }

    // Check visibility permissions
    if (event.visibility === "private") {
      if (
        !req.user ||
        (req.user._id.toString() !== event.organizerId._id.toString() &&
          !["admin", "super_admin"].includes(req.user.role))
      ) {
        return next(new AppError("Access denied", 403));
      }
    }

    // If user is logged in, check if they have registered for this event
    let eventWithRegistrationStatus = event.toObject();
    if (req.user) {
      const userRegistration = await EventRegistration.findOne({
        user: req.user._id,
        event: event._id,
        status: { $in: ["pending", "confirmed", "waitlisted"] }, // Exclude cancelled/rejected
      }).select("status");

      if (userRegistration) {
        eventWithRegistrationStatus.isRegistered = true;
        eventWithRegistrationStatus.registrationStatus = userRegistration.status;
      } else {
        eventWithRegistrationStatus.isRegistered = false;
        eventWithRegistrationStatus.registrationStatus = null;
      }
    } else {
      eventWithRegistrationStatus.isRegistered = false;
      eventWithRegistrationStatus.registrationStatus = null;
    }

    // Cache event (without registration status to keep cache shared)
    if (redis) {
      await redis.setex(`event:${id}`, 1800, JSON.stringify(event)); // Cache for 30 minutes
    }

    res.status(200).json({
      success: true,
      data: { event: eventWithRegistrationStatus },
    });
  } catch (error) {
    next(error);
  }
};

// Update event
exports.updateEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);

    if (!event) {
      return next(new AppError("Event not found", 404));
    }

    // Check permissions
    if (
      event.organizerId.toString() !== req.user._id.toString() &&
      !["admin", "super_admin"].includes(req.user.role)
    ) {
      return next(new AppError("Access denied", 403));
    }

    // CRITICAL: Check if event has already started - lock critical fields
    const eventHasStarted = new Date() >= new Date(event.startDateTime);
    const eventIsOngoing = new Date() >= new Date(event.startDateTime) && new Date() <= new Date(event.endDateTime);
    const eventHasEnded = new Date() > new Date(event.endDateTime);

    // Lock critical fields once event starts
    if (eventHasStarted) {
      const lockedFields = [
        'title', 'eventType', 'startDateTime', 'endDateTime',
        'minTeamSize', 'maxTeamSize', 'isPaid', 'amount',
        'eligibility', 'eligibleYears', 'eligibleDepartments',
        'allowExternalStudents', 'requiresApproval'
      ];
      
      for (const field of lockedFields) {
        if (req.body[field] !== undefined && req.body[field] !== event[field]) {
          // Allow array comparison for eligibleYears and eligibleDepartments
          if ((field === 'eligibleYears' || field === 'eligibleDepartments') && 
              Array.isArray(req.body[field]) && Array.isArray(event[field]) &&
              JSON.stringify(req.body[field].sort()) === JSON.stringify(event[field].sort())) {
            continue; // Arrays are same, allow
          }
          return next(
            new AppError(
              `Cannot modify ${field} after event has started. Only registration management, venue, and description updates are allowed.`,
              400
            )
          );
        }
      }
    }

    // Prevent extending registration deadline past current time if already closed
    if (req.body.registrationDeadline) {
      const newDeadline = new Date(req.body.registrationDeadline);
      const oldDeadline = new Date(event.registrationDeadline);
      const now = new Date();
      
      if (oldDeadline < now && newDeadline > now) {
        return next(
          new AppError(
            "Cannot extend registration deadline after it has already passed. This ensures fairness to all participants.",
            400
          )
        );
      }
    }

    // Validate maxParticipants cannot be reduced below current confirmed registrations
    if (req.body.maxParticipants !== undefined && req.body.maxParticipants < event.maxParticipants) {
      const confirmedCount = await EventRegistration.countDocuments({
        event: event._id,
        status: { $in: ['confirmed', 'pending'] }
      });
      
      if (req.body.maxParticipants < confirmedCount) {
        return next(
          new AppError(
            `Cannot reduce participant limit to ${req.body.maxParticipants}. There are already ${confirmedCount} confirmed registrations.`,
            400
          )
        );
      }
    }

    // Validate event status transitions
    if (req.body.status && req.body.status !== event.status) {
      const validTransitions = {
        draft: ['published', 'cancelled'],
        published: ['ongoing', 'cancelled'],
        ongoing: ['completed', 'cancelled'],
        completed: [], // Cannot transition from completed
        cancelled: [] // Cannot transition from cancelled
      };
      
      if (!validTransitions[event.status].includes(req.body.status)) {
        return next(
          new AppError(
            `Invalid status transition from ${event.status} to ${req.body.status}. Allowed transitions: ${validTransitions[event.status].join(', ') || 'none'}.`,
            400
          )
        );
      }
    }

    // Auto-transition status to 'ongoing' if event has started
    if (eventIsOngoing && event.status === 'published' && !req.body.status) {
      req.body.status = 'ongoing';
    }

    // Auto-transition status to 'completed' if event has ended
    if (eventHasEnded && (event.status === 'ongoing' || event.status === 'published') && !req.body.status) {
      req.body.status = 'completed';
    }

    // Check for duplicate title if title is being updated
    if (req.body.title && req.body.title !== event.title) {
      const existingEvent = await Event.findOne({ title: req.body.title });
      if (existingEvent) {
        return next(
          new AppError("An event with this title already exists", 400)
        );
      }
    }

    // Store old values for audit
    req.oldValues = event.toObject();

    // Parse arrays if they come as array notation from FormData
    if (req.body["eligibleYears[]"]) {
      req.body.eligibleYears = Array.isArray(req.body["eligibleYears[]"])
        ? req.body["eligibleYears[]"].map(Number)
        : [Number(req.body["eligibleYears[]"])];
      delete req.body["eligibleYears[]"];
    }
    if (req.body["eligibleDepartments[]"]) {
      req.body.eligibleDepartments = Array.isArray(
        req.body["eligibleDepartments[]"]
      )
        ? req.body["eligibleDepartments[]"]
        : [req.body["eligibleDepartments[]"]];
      delete req.body["eligibleDepartments[]"];
    }

    // Parse schedule if it comes as JSON string from FormData
    if (req.body.schedule && typeof req.body.schedule === "string") {
      try {
        req.body.schedule = JSON.parse(req.body.schedule);
      } catch (e) {
        return next(new AppError("Invalid schedule format", 400));
      }
    }

    // Handle uploaded banner image - support both file upload and base64
    if (req.body.bannerImageBase64) {
      // Store base64 directly in MongoDB
      req.body.bannerImage = req.body.bannerImageBase64;
    } else if (req.files && req.files.length > 0) {
      // Convert uploaded file to base64
      const fs = require("fs");
      const fileBuffer = fs.readFileSync(req.files[0].path);
      const base64Image = `data:${
        req.files[0].mimetype
      };base64,${fileBuffer.toString("base64")}`;
      req.body.bannerImage = base64Image;
      // Clean up the uploaded file
      fs.unlinkSync(req.files[0].path);
    } else if (req.file) {
      // Convert uploaded file to base64
      const fs = require("fs");
      const fileBuffer = fs.readFileSync(req.file.path);
      const base64Image = `data:${
        req.file.mimetype
      };base64,${fileBuffer.toString("base64")}`;
      req.body.bannerImage = base64Image;
      // Clean up the uploaded file
      fs.unlinkSync(req.file.path);
    }

    // Handle multiple images array
    if (req.body.images && Array.isArray(req.body.images)) {
      req.body.images = req.body.images; // Assume these are already base64
    } else if (req.body.images && typeof req.body.images === "string") {
      try {
        req.body.images = JSON.parse(req.body.images);
      } catch (e) {
        req.body.images = [req.body.images]; // Single image
      }
    }

    // Manual validation for team sizes if both are being updated
    const minTeamSize =
      req.body.minTeamSize !== undefined
        ? req.body.minTeamSize
        : event.minTeamSize;
    const maxTeamSize =
      req.body.maxTeamSize !== undefined
        ? req.body.maxTeamSize
        : event.maxTeamSize;

    if (maxTeamSize < minTeamSize) {
      return next(
        new AppError(
          "Max team size must be greater than or equal to min team size",
          400
        )
      );
    }

    // Update event fields manually to ensure proper validation context
    Object.assign(event, req.body);

    // Save the event (this triggers validators with proper context)
    await event.save();

    // Clear cache
    const redis = getRedisClient();
    if (redis) {
      await redis.del(`event:${id}`);
    }

    res.status(200).json({
      success: true,
      message: "Event updated successfully",
      data: { event },
    });
  } catch (error) {
    next(error);
  }
};

// Delete event
exports.deleteEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);

    if (!event) {
      return next(new AppError("Event not found", 404));
    }

    // Check permissions
    if (
      event.organizerId.toString() !== req.user._id.toString() &&
      !["admin", "super_admin"].includes(req.user.role)
    ) {
      return next(new AppError("Access denied", 403));
    }

    // Check actual registrations in database
    const EventRegistration = require("../models/EventRegistration");
    const registrationCount = await EventRegistration.countDocuments({
      event: id,
      status: { $nin: ["cancelled", "rejected"] },
    });

    if (registrationCount > 0) {
      return next(
        new AppError(
          `Cannot delete event with ${registrationCount} existing registration(s)`,
          400
        )
      );
    }

    await Event.findByIdAndDelete(id);

    // Clear cache
    const redis = getRedisClient();
    if (redis) {
      await redis.del(`event:${id}`);
    }

    res.status(200).json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Publish event
exports.publishEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);

    if (!event) {
      return next(new AppError("Event not found", 404));
    }

    // Check permissions
    if (
      event.organizerId.toString() !== req.user._id.toString() &&
      !["admin", "super_admin"].includes(req.user.role)
    ) {
      return next(new AppError("Access denied", 403));
    }

    // Check if event is approved (only when approval is required)
    if (
      event.requiresApproval === true &&
      event.approvalStatus !== "approved"
    ) {
      return next(
        new AppError("Event must be approved before publishing", 400)
      );
    }

    event.status = "published";
    await event.save();

    res.status(200).json({
      success: true,
      message: "Event published successfully",
      data: { event },
    });
  } catch (error) {
    next(error);
  }
};

// Get my events (created by user)
exports.getMyEvents = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const query = { organizerId: req.user._id };
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const events = await Event.find(query)
      .populate("clubId", "name logo")
      .populate("departmentId", "name code")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Event.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        events,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Duplicate event
exports.duplicateEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const originalEvent = await Event.findById(id);

    if (!originalEvent) {
      return next(new AppError("Event not found", 404));
    }

    // Check permissions
    if (
      originalEvent.organizerId.toString() !== req.user._id.toString() &&
      !["admin", "super_admin"].includes(req.user.role)
    ) {
      return next(new AppError("Access denied", 403));
    }

    // Create new event with duplicated data
    const eventData = originalEvent.toObject();
    delete eventData._id;
    delete eventData.createdAt;
    delete eventData.updatedAt;
    delete eventData.slug;
    delete eventData.__v;

    // Update title to indicate duplicate
    eventData.title = `${eventData.title} (Copy)`;
    eventData.status = "draft";
    eventData.registeredCount = 0;

    const newEvent = await Event.create(eventData);

    res.status(201).json({
      success: true,
      message: "Event duplicated successfully",
      data: { event: newEvent },
    });
  } catch (error) {
    next(error);
  }
};

// Cancel event
exports.cancelEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);

    if (!event) {
      return next(new AppError("Event not found", 404));
    }

    // Check permissions
    if (
      event.organizerId.toString() !== req.user._id.toString() &&
      !["admin", "super_admin"].includes(req.user.role)
    ) {
      return next(new AppError("Access denied", 403));
    }

    event.status = "cancelled";
    await event.save();

    // Notify all registered participants
    const registrations = await EventRegistration.find({
      event: id,
      status: { $in: ["pending", "confirmed", "waitlisted"] },
    }).populate("user", "email fullName");

    // Send cancellation notifications to all registered users
    const Notification = require("../models/Notification");
    for (const registration of registrations) {
      if (registration.user && registration.user._id) {
        await Notification.create({
          recipient: registration.user._id,
          title: "Event Cancelled",
          message: `The event "${event.title}" has been cancelled by the organizer.`,
          type: "event",
          relatedEvent: event._id,
          channels: ["in_app", "email"],
          priority: "high",
          sentBy: req.user._id,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Event cancelled successfully",
      data: { event },
    });
  } catch (error) {
    next(error);
  }
};
