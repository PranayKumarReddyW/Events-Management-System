const EventRegistration = require("../models/EventRegistration");
const Event = require("../models/Event");
const User = require("../models/User");
const Team = require("../models/Team");
const Payment = require("../models/Payment");
const Notification = require("../models/Notification");
const { asyncHandler } = require("../middleware/errorHandler");
const AppError = require("../middleware/errorHandler").AppError;
const logger = require("../utils/logger");
const { sendEmail } = require("../utils/email");
const { sendSMS } = require("../utils/sms");
const { withTransaction } = require("../utils/transaction");

/**
 * @desc    Register for an event
 * @route   POST /api/v1/registrations
 * @access  Private (Student+)
 */
exports.registerForEvent = asyncHandler(async (req, res) => {
  const {
    eventId,
    teamId,
    emergencyContact,
    specialRequirements,
    participantInfo,
  } = req.body;

  // SECURITY: Check if user account is active
  if (!req.user.isActive) {
    throw new AppError(
      "Your account is inactive. Please contact support.",
      403
    );
  }

  // Check if event exists and is open for registration
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // CRITICAL: Lock ongoing/completed events from new registrations
  if (event.status === "ongoing") {
    throw new AppError(
      "Event is currently ONGOING. No new registrations allowed.",
      400
    );
  }

  if (event.status === "completed" || event.status === "cancelled") {
    throw new AppError(
      `Event is ${event.status.toUpperCase()}. Registration is closed.`,
      400
    );
  }

  if (event.status !== "published") {
    throw new AppError("Event is not open for registration", 400);
  }

  if (event.registrationDeadline && new Date() > event.registrationDeadline) {
    throw new AppError("Registration deadline has passed", 400);
  }

  // RACE CONDITION FIX: Check if user already registered (excluding cancelled)
  const existingRegistration = await EventRegistration.findOne({
    event: eventId,
    user: req.user._id,
    status: { $in: ["pending", "confirmed", "waitlisted"] },
  });

  if (existingRegistration) {
    throw new AppError("You are already registered for this event", 400);
  }

  // CRITICAL: Determine if event is SOLO or TEAM based
  const minTeamSize = event.minTeamSize || 1;
  const maxTeamSize = event.maxTeamSize || 1;
  const isTeamEvent = maxTeamSize > 1;
  const isSoloEvent = maxTeamSize <= 1;

  // CRITICAL: Enforce SOLO event - no teams allowed
  if (isSoloEvent && teamId) {
    throw new AppError(
      "This is a SOLO event (maxTeamSize <= 1). Team registration is not allowed. Register individually.",
      400
    );
  }

  // CRITICAL: Enforce TEAM event - teams required if minTeamSize > 1
  if (isTeamEvent && minTeamSize > 1 && !teamId) {
    throw new AppError(
      `This event requires TEAM registration (minTeamSize: ${minTeamSize}). You must create or join a team first.`,
      400
    );
  }

  // Handle team registration
  let team = null;
  if ((event.maxTeamSize || 1) > 1) {
    if (!teamId) {
      throw new AppError("Team registration required for this event", 400);
    }

    team = await Team.findById(teamId);
    if (!team) {
      throw new AppError("Team not found", 404);
    }

    // NULL CHECK: Ensure members array exists
    if (!team.members || !Array.isArray(team.members)) {
      throw new AppError("Team has invalid member data", 400);
    }

    // Check if user is team leader
    const isLeader = team.leader.toString() === req.user._id.toString();

    // FIX: Proper ObjectId comparison for team membership (members are ObjectIds, not populated)
    const isMember = team.members.some(
      (memberId) => memberId && memberId.toString() === req.user._id.toString()
    );

    if (!isLeader && !isMember) {
      throw new AppError("You are not a member of this team", 400);
    }

    // SECURITY: Check if user is already registered in a DIFFERENT team for this event
    const existingTeamRegistration = await EventRegistration.findOne({
      event: eventId,
      user: req.user._id,
      team: { $ne: teamId },
      status: { $in: ["pending", "confirmed"] },
    });

    if (existingTeamRegistration) {
      throw new AppError(
        "You are already registered with a different team for this event",
        400
      );
    }

    if (team.status !== "locked") {
      throw new AppError(
        "Team must be locked by the leader before registration",
        400
      );
    }

    // NULL CHECK: Ensure event field exists
    if (!team.event) {
      throw new AppError("Team has no associated event", 400);
    }

    if (team.event.toString() !== eventId) {
      throw new AppError("Team is registered for a different event", 400);
    }

    // Validate team size against event requirements
    // Note: team.members array already includes the leader (see Team model pre-save hook)
    const teamSize = team.members.length;
    const minSize = event.minTeamSize || 1;
    const maxSize = event.maxTeamSize;

    if (teamSize < minSize) {
      throw new AppError(
        `Team must have at least ${minSize} members. Current: ${teamSize}`,
        400
      );
    }

    if (teamSize > maxSize) {
      throw new AppError(
        `Team cannot exceed ${maxSize} members. Current: ${teamSize}`,
        400
      );
    }
  }

  // TRANSACTION: Use MongoDB session for atomicity (works with both standalone and replica set)
  const registrations = await withTransaction(async (session) => {
    // RACE CONDITION FIX: Check capacity atomically
    // Without transaction (standalone), this provides best-effort protection
    // With transaction (replica set), this provides full ACID guarantees
    const currentCount = await EventRegistration.countDocuments({
      event: eventId,
      status: { $in: ["pending", "confirmed"] },
    });

    if (event.maxParticipants && currentCount >= event.maxParticipants) {
      throw new AppError(
        `Event is full. Maximum ${event.maxParticipants} participants allowed.`,
        400
      );
    }

    // For paid events, registration status should be "pending" until payment is completed
    const registrationStatus = event.isPaid
      ? "pending"
      : event.requiresApproval
      ? "pending"
      : "confirmed";

    // Create registration (with or without session)
    const createOptions = session ? { session } : {};

    // FIX: If team registration, create registrations for ALL team members
    let registrationDocs = [];
    if (team) {
      // Check if user is team leader
      const isLeader = team.leader.toString() === req.user._id.toString();

      if (isLeader) {
        // Leader is registering - auto-register all team members
        const teamMembers = await User.find({ _id: { $in: team.members } });

        registrationDocs = teamMembers.map((member) => ({
          event: eventId,
          user: member._id,
          team: team._id,
          emergencyContact:
            member._id.toString() === req.user._id.toString()
              ? emergencyContact
              : undefined,
          specialRequirements:
            member._id.toString() === req.user._id.toString()
              ? specialRequirements
              : undefined,
          participantInfo:
            member._id.toString() === req.user._id.toString()
              ? participantInfo
              : undefined,
          registrationDate: new Date(),
          status: registrationStatus,
          paymentStatus: event.isPaid ? "pending" : "not_required",
        }));
      } else {
        // Team member is registering individually (should not happen if leader locked)
        registrationDocs = [
          {
            event: eventId,
            user: req.user._id,
            team: team._id,
            emergencyContact,
            specialRequirements,
            participantInfo,
            registrationDate: new Date(),
            status: registrationStatus,
            paymentStatus: event.isPaid ? "pending" : "not_required",
          },
        ];
      }
    } else {
      // Solo registration
      registrationDocs = [
        {
          event: eventId,
          user: req.user._id,
          team: null,
          emergencyContact,
          specialRequirements,
          participantInfo,
          registrationDate: new Date(),
          status: registrationStatus,
          paymentStatus: event.isPaid ? "pending" : "not_required",
        },
      ];
    }

    const newRegistrations = await EventRegistration.create(
      registrationDocs,
      createOptions
    );

    // ATOMICITY FIX: Update event's registeredCount
    if (registrationStatus === "confirmed") {
      const updateOptions = session ? { session } : {};
      await Event.findByIdAndUpdate(
        eventId,
        { $inc: { registeredCount: newRegistrations.length } },
        updateOptions
      );
    }

    return newRegistrations;
  });

  // Get the current user's registration for response
  const registration = Array.isArray(registrations)
    ? registrations.find((r) => r.user.toString() === req.user._id.toString())
    : registrations;

  // Populate fields after transaction
  await registration.populate([
    {
      path: "event",
      select: "title startDateTime eventType venue isPaid amount",
    },
    { path: "user", select: "fullName email phone" },
    { path: "team", select: "name members" },
  ]);

  // Send confirmation email (outside transaction to avoid rollback issues)
  try {
    await sendEmail({
      to: req.user.email,
      subject: `Registration Confirmation - ${registration.event.title}`,
      template: "registration-confirmation",
      context: {
        name: req.user.fullName,
        userName: req.user.fullName,
        eventName: registration.event.title,
        eventTitle: registration.event.title,
        date: registration.event.startDateTime,
        time: new Date(registration.event.startDateTime).toLocaleTimeString(),
        venue: registration.event.venue || "Online",
        eventVenue: registration.event.venue || "Online",
        registrationNumber: registration.registrationNumber,
        needsPayment: registration.event.isPaid,
        amount: registration.event.amount,
      },
    });
  } catch (error) {
    logger.error("Failed to send registration confirmation email:", error);
  }

  // Send SMS notification
  if (req.user.phone) {
    try {
      const smsMessage = registration.event.isPaid
        ? `Registration initiated for ${registration.event.title}. Please complete payment to confirm. Registration #: ${registration.registrationNumber}`
        : `Registration successful for ${registration.event.title}. Registration #: ${registration.registrationNumber}`;

      await sendSMS({
        to: req.user.phone,
        message: smsMessage,
      });
    } catch (error) {
      logger.error("Failed to send registration SMS:", error);
    }
  }

  // Create in-app notification
  try {
    const notificationTitle = event.isPaid
      ? "Registration Initiated - Payment Required"
      : "Registration Successful";
    const notificationMessage = event.isPaid
      ? `Your registration for ${event.title} has been created. Please complete payment to confirm your spot.`
      : `You have successfully registered for ${event.title}`;

    await Notification.create({
      recipient: req.user._id,
      sentBy: event.organizerId || event.organizer,
      title: notificationTitle,
      message: notificationMessage,
      type: "registration",
      relatedEvent: eventId,
      channels: ["in_app", "email"],
    });
  } catch (error) {
    logger.error("Failed to create notification:", error);
  }

  // If team registration by leader, notify all team members
  if (
    team &&
    team.leader.toString() === req.user._id.toString() &&
    Array.isArray(registrations) &&
    registrations.length > 1
  ) {
    const teamMembers = await User.find({
      _id: { $in: team.members, $ne: req.user._id },
    }).select("email fullName");

    for (const member of teamMembers) {
      try {
        await Notification.create({
          recipient: member._id,
          sentBy: req.user._id,
          title: "Team Registration Successful",
          message: `Your team leader has registered your team "${team.name}" for ${event.title}.`,
          type: "registration",
          relatedEvent: eventId,
          channels: ["in_app", "email"],
        });
      } catch (error) {
        logger.error(`Failed to notify team member ${member._id}:`, error);
      }
    }
  }

  // Return response
  res.status(201).json({
    success: true,
    data: registration,
    message: event.isPaid
      ? "Registration created. Please complete payment to confirm."
      : team && team.leader.toString() === req.user._id.toString()
      ? `Successfully registered your team! All ${registrations.length} team members have been registered.`
      : "Successfully registered for the event!",
  });
});

/**
 * @desc    Get my registrations
 * @route   GET /api/v1/registrations/my
 * @access  Private
 */
exports.getMyRegistrations = asyncHandler(async (req, res) => {
  const {
    status,
    paymentStatus,
    eventMode,
    mode,
    page = 1,
    limit = 10,
  } = req.query;

  const filter = { user: req.user._id };

  if (status && status !== "all") {
    filter.status = status;
  }

  if (paymentStatus && paymentStatus !== "all") {
    filter.paymentStatus = paymentStatus;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build query for event filters
  let query = EventRegistration.find(filter);

  // If eventMode filter is applied, we need to filter by event.eventMode
  const modeValue = mode || eventMode;
  if (modeValue && modeValue !== "all") {
    // First get all registrations, then filter by populated event.eventMode
    const allRegistrations = await EventRegistration.find(filter)
      .populate({
        path: "event",
        select:
          "title startDateTime endDateTime eventType venue bannerImage isPaid amount currency maxTeamSize category eventMode",
        match: { eventMode: modeValue },
      })
      .populate({
        path: "team",
        select: "name members leader teamCode",
        populate: { path: "leader", select: "_id" },
      })
      .populate("payment", "amount paymentMethod transactionId paidAt status")
      .sort({ createdAt: -1 });

    // Filter out registrations where event is null (didn't match eventMode)
    const filteredRegistrations = allRegistrations.filter(
      (reg) => reg.event !== null
    );

    const total = filteredRegistrations.length;
    const paginatedRegistrations = filteredRegistrations.slice(
      skip,
      skip + parseInt(limit)
    );

    return res.status(200).json({
      success: true,
      data: paginatedRegistrations,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit),
      },
    });
  }

  const registrations = await EventRegistration.find(filter)
    .populate({
      path: "event",
      select:
        "title startDateTime endDateTime eventType venue bannerImage isPaid amount currency maxTeamSize category eventMode",
    })
    .populate({
      path: "team",
      select: "name members leader teamCode",
      populate: { path: "leader", select: "_id" },
    })
    .populate("payment", "amount paymentMethod transactionId paidAt status")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await EventRegistration.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: registrations,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      limit: parseInt(limit),
    },
  });
});

/**
 * @desc    Get registration by ID
 * @route   GET /api/v1/registrations/:id
 * @access  Private
 */
exports.getRegistrationById = asyncHandler(async (req, res) => {
  const registration = await EventRegistration.findById(req.params.id)
    .populate("event")
    .populate("user", "fullName email phone profilePicture")
    .populate("team")
    .populate("payment")
    .populate("certificate");

  if (!registration) {
    throw new AppError("Registration not found", 404);
  }

  // Check access - user can view their own, organizers can view event registrations
  if (
    registration.user._id.toString() !== req.user._id.toString() &&
    !["organizer", "admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to access this registration", 403);
  }

  res.status(200).json({
    success: true,
    data: registration,
  });
});

/**
 * @desc    Get all registrations for an event
 * @route   GET /api/v1/registrations/event/:eventId
 * @access  Private (Organizer+)
 */
exports.getEventRegistrations = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const {
    status,
    paymentStatus,
    search,
    department,
    yearOfStudy,
    page = 1,
    limit = 20,
  } = req.query;

  // Check if user has access to this event
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  if (
    (event.organizerId || event.organizer).toString() !==
      req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to access event registrations", 403);
  }

  const filter = { event: eventId };

  if (status) {
    filter.status = status;
  }

  if (paymentStatus) {
    filter.paymentStatus = paymentStatus;
  }

  let query = EventRegistration.find(filter);

  // Optional filters based on user properties (department, yearOfStudy, search)
  if (search || department || yearOfStudy) {
    const userFilter = {};

    if (search) {
      userFilter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (department) {
      userFilter.department = department;
    }

    if (yearOfStudy) {
      userFilter.yearOfStudy = parseInt(yearOfStudy);
    }

    const users = await User.find(userFilter).select("_id");
    const userIds = users.map((u) => u._id);
    query = query.where("user").in(userIds);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const registrations = await query
    .populate("user", "fullName email phone department")
    .populate({
      path: "team",
      select: "name status inviteCode leader members maxSize",
      populate: { path: "leader", select: "fullName email" },
    })
    .populate("payment", "amount paymentMethod transactionId paidAt")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await EventRegistration.countDocuments(filter);

  // Get statistics
  const stats = await EventRegistration.aggregate([
    { $match: { event: event._id } },
    {
      $group: {
        _id: null,
        totalRegistrations: { $sum: 1 },
        confirmed: {
          $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
        },
        pending: {
          $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
        },
        waitlisted: {
          $sum: { $cond: [{ $eq: ["$status", "waitlisted"] }, 1, 0] },
        },
        rejected: {
          $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
        },
        checkedIn: {
          $sum: { $cond: ["$checkInTime", 1, 0] },
        },
        paidCount: {
          $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] },
        },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: registrations,
    stats: stats[0] || {},
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      limit: parseInt(limit),
    },
  });
});

/**
 * @desc    Cancel registration
 * @route   PUT /api/v1/registrations/:id/cancel
 * @access  Private
 */
exports.cancelRegistration = asyncHandler(async (req, res) => {
  const registration = await EventRegistration.findById(req.params.id);

  if (!registration) {
    throw new AppError("Registration not found", 404);
  }

  // Check if user owns this registration
  if (registration.user.toString() !== req.user._id.toString()) {
    throw new AppError("Not authorized to cancel this registration", 403);
  }

  if (registration.status === "cancelled") {
    throw new AppError("Registration is already cancelled", 400);
  }

  // Check event start time
  const event = await Event.findById(registration.event);
  const hoursTillEvent = (event.startDateTime - new Date()) / (1000 * 60 * 60);

  if (hoursTillEvent < 24) {
    throw new AppError(
      "Cannot cancel registration within 24 hours of event start",
      400
    );
  }

  // Handle refund if payment was made
  if (registration.paymentStatus === "paid" && registration.payment) {
    const Payment = require("../models/Payment");
    const Refund = require("../models/Refund");

    // Find the payment
    const payment = await Payment.findById(registration.payment);

    if (payment && payment.status === "completed") {
      // Calculate refund percentage based on time until event
      let refundPercentage = 100; // Default 100% refund

      if (hoursTillEvent < 24) {
        refundPercentage = 0; // No refund within 24 hours
      } else if (hoursTillEvent < 48) {
        refundPercentage = 50; // 50% refund within 48 hours
      } else if (hoursTillEvent < 72) {
        refundPercentage = 75; // 75% refund within 72 hours
      }
      // else 100% refund (more than 72 hours)

      const refundAmount = (payment.amount * refundPercentage) / 100;

      // Create refund record
      const refund = await Refund.create({
        payment: payment._id,
        user: req.user._id,
        event: registration.event,
        registration: registration._id,
        amount: refundAmount,
        originalAmount: payment.amount,
        refundPercentage: refundPercentage,
        reason: req.body.reason || "Registration cancelled by user",
        status: "pending",
      });

      // Update registration payment status
      registration.paymentStatus = "refund_pending";

      logger.info(
        `Refund created for registration ${registration._id}, amount: ${refundAmount} (${refundPercentage}% of ${payment.amount})`
      );

      // Store refund info for notification
      registration._refundInfo = {
        refundPercentage,
        refundAmount,
        originalAmount: payment.amount,
      };
    }
  }

  registration.status = "cancelled";
  registration.cancelledAt = new Date();
  registration.cancellationReason = req.body.reason;
  await registration.save();

  // Update event's registeredCount
  if (event.registeredCount > 0) {
    event.registeredCount = event.registeredCount - 1;
    await event.save();
  }

  // Build notification message with refund details
  let notificationMessage = `Your registration for ${event.title} has been cancelled`;
  let responseMessage = "Registration cancelled successfully";

  if (
    registration.paymentStatus === "refund_pending" &&
    registration._refundInfo
  ) {
    const { refundPercentage, refundAmount } = registration._refundInfo;
    const currency = event.currency || "INR";
    notificationMessage = `Your registration for ${
      event.title
    } has been cancelled. You will receive a ${refundPercentage}% refund (${currency} ${refundAmount.toFixed(
      2
    )}) of your payment within 5-7 business days.`;
    responseMessage = `Registration cancelled successfully. You will receive a ${refundPercentage}% refund (${currency} ${refundAmount.toFixed(
      2
    )}) within 5-7 business days.`;
  }

  await Notification.create({
    recipient: req.user._id,
    sentBy: event.organizerId || event.organizer,
    title: "Registration Cancelled",
    message: notificationMessage,
    type: "registration",
    relatedEvent: event._id,
    channels: ["in_app", "email"],
  });

  res.status(200).json({
    success: true,
    data: registration,
    message: responseMessage,
  });
});

/**
 * @desc    Update registration status (Organizer)
 * @route   PUT /api/v1/registrations/:id/status
 * @access  Private (Organizer+)
 */
exports.updateRegistrationStatus = asyncHandler(async (req, res) => {
  const { status, notes } = req.body;

  const registration = await EventRegistration.findById(req.params.id)
    .populate("event")
    .populate("user", "fullName email");

  if (!registration) {
    throw new AppError("Registration not found", 404);
  }

  // Check authorization
  if (
    (
      registration.event.organizerId || registration.event.organizer
    ).toString() !== req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to update registration status", 403);
  }

  const oldStatus = registration.status;
  registration.status = status;

  if (notes) {
    registration.notes = notes;
  }

  await registration.save();

  // Send notification if status changed
  if (oldStatus !== status) {
    await Notification.create({
      recipient: registration.user._id,
      sentBy: req.user._id,
      title: "Registration Status Updated",
      message: `Your registration for ${registration.event.title} has been ${status}`,
      type: "registration",
      relatedEvent: registration.event._id,
      channels: ["in_app", "email"],
    });

    // Send email
    try {
      await sendEmail({
        to: registration.user.email,
        subject: `Registration ${status} - ${registration.event.title}`,
        template: "registration-status",
        context: {
          userName: registration.user.fullName,
          eventTitle: registration.event.title,
          status: status,
          notes: notes,
        },
      });
    } catch (error) {
      logger.error("Failed to send status update email:", error);
    }
  }

  res.status(200).json({
    success: true,
    data: registration,
    message: "Registration status updated successfully",
  });
});

/**
 * @desc    Check-in participant
 * @route   POST /api/v1/registrations/:id/checkin
 * @access  Private (Organizer+)
 */
exports.checkInParticipant = asyncHandler(async (req, res) => {
  const registration = await EventRegistration.findById(req.params.id)
    .populate("event")
    .populate("user", "fullName email");

  if (!registration) {
    throw new AppError("Registration not found", 404);
  }

  // Check authorization
  if (
    (
      registration.event.organizerId || registration.event.organizer
    ).toString() !== req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to check-in participants", 403);
  }

  if (registration.status !== "confirmed") {
    throw new AppError("Registration is not confirmed", 400);
  }

  if (registration.checkInTime) {
    throw new AppError("Participant already checked in", 400);
  }

  // Check payment if required
  if (registration.event.isPaid && registration.paymentStatus !== "paid") {
    throw new AppError("Payment not completed", 400);
  }

  registration.checkInTime = new Date();
  registration.checkedInBy = req.user._id;
  await registration.save();

  res.status(200).json({
    success: true,
    data: registration,
    message: "Participant checked in successfully",
  });
});

/**
 * @desc    Bulk check-in participants
 * @route   POST /api/v1/registrations/bulk-checkin
 * @access  Private (Organizer+)
 */
exports.bulkCheckIn = asyncHandler(async (req, res) => {
  const { registrationIds, eventId } = req.body;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check authorization
  if (
    (event.organizerId || event.organizer).toString() !==
      req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to check-in participants", 403);
  }

  const result = await EventRegistration.updateMany(
    {
      _id: { $in: registrationIds },
      event: eventId,
      status: "confirmed",
      checkInTime: null,
    },
    {
      $set: {
        checkInTime: new Date(),
        checkedInBy: req.user._id,
      },
    }
  );

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} participants checked in successfully`,
    data: {
      checkedInCount: result.modifiedCount,
    },
  });
});

/**
 * @desc    Export registrations
 * @route   GET /api/v1/registrations/event/:eventId/export
 * @access  Private (Organizer+)
 */
exports.exportRegistrations = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { format = "json" } = req.query;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check authorization
  if (
    (event.organizerId || event.organizer).toString() !==
      req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to export registrations", 403);
  }

  const registrations = await EventRegistration.find({ event: eventId })
    .populate("user", "fullName email phone department rollNumber")
    .populate("team", "name")
    .populate("payment", "amount paymentMethod transactionId paidAt")
    .sort({ createdAt: -1 });

  if (format === "csv") {
    // Convert to CSV format
    const csv = [
      [
        "Registration Number",
        "Name",
        "Email",
        "Phone",
        "Department",
        "Roll Number",
        "Team",
        "Status",
        "Payment Status",
        "Amount",
        "Registration Date",
        "Check-in Time",
      ],
      ...registrations.map((reg) => [
        reg.registrationNumber,
        reg.user.fullName,
        reg.user.email,
        reg.user.phone || "",
        reg.user.department || "",
        reg.user.rollNumber || "",
        reg.team ? reg.team.name : "",
        reg.status,
        reg.paymentStatus,
        reg.payment ? reg.payment.amount : 0,
        reg.registrationDate.toISOString(),
        reg.checkInTime ? reg.checkInTime.toISOString() : "",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=registrations-${eventId}.csv`
    );
    return res.send(csv);
  }

  res.status(200).json({
    success: true,
    data: registrations,
  });
});
