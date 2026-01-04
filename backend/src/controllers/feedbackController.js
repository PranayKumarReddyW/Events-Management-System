const Feedback = require("../models/Feedback");
const Event = require("../models/Event");
const EventRegistration = require("../models/EventRegistration");
const { asyncHandler } = require("../middleware/errorHandler");
const AppError = require("../middleware/errorHandler").AppError;
const logger = require("../utils/logger");

/**
 * @desc    Submit feedback for an event
 * @route   POST /api/v1/feedback
 * @access  Private
 */
exports.submitFeedback = asyncHandler(async (req, res) => {
  const {
    eventId,
    overallRating,
    contentQuality,
    organizationRating,
    venueRating,
    speakerRating,
    comment,
    suggestions,
    wouldRecommend,
    anonymous,
    isAnonymous,
  } = req.body;

  const resolvedAnonymous =
    typeof anonymous === "boolean"
      ? anonymous
      : typeof isAnonymous === "boolean"
      ? isAnonymous
      : false;

  // Check if event exists
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // EDGE CASE: Block feedback before event ends (by date, not just status)
  const now = new Date();
  if (now < new Date(event.endDateTime)) {
    const hoursRemaining = Math.ceil(
      (new Date(event.endDateTime) - now) / (1000 * 60 * 60)
    );
    throw new AppError(
      `Feedback will be available after the event ends in ${hoursRemaining} hours (${new Date(
        event.endDateTime
      ).toLocaleString()})`,
      400
    );
  }

  // Check if event is completed
  if (event.status !== "completed") {
    throw new AppError(
      "Feedback can only be submitted after event completion",
      400
    );
  }

  // Check if user attended the event
  const registration = await EventRegistration.findOne({
    event: eventId,
    user: req.user._id,
    status: "confirmed",
    checkInTime: { $ne: null },
  });

  if (!registration) {
    throw new AppError("You must attend the event to submit feedback", 400);
  }

  // Check if feedback already exists
  const existingFeedback = await Feedback.findOne({
    event: eventId,
    submittedBy: req.user._id,
  });

  if (existingFeedback) {
    throw new AppError(
      "You have already submitted feedback for this event",
      400
    );
  }

  // Create feedback
  const feedback = await Feedback.create({
    event: eventId,
    submittedBy: req.user._id,
    overallRating,
    contentQuality,
    organizationRating,
    venueRating,
    speakerRating,
    comment,
    suggestions,
    wouldRecommend,
    anonymous: resolvedAnonymous,
    submittedAt: new Date(),
    status: "pending", // Pending approval
  });

  await feedback.populate([
    { path: "event", select: "title" },
    { path: "submittedBy", select: "fullName email" },
  ]);

  res.status(201).json({
    success: true,
    data: feedback,
    message: "Feedback submitted successfully",
  });
});

/**
 * @desc    Get feedback by ID
 * @route   GET /api/v1/feedback/:id
 * @access  Private (Organizer+)
 */
exports.getFeedbackById = asyncHandler(async (req, res) => {
  const feedback = await Feedback.findById(req.params.id)
    .populate("event", "title organizer")
    .populate("submittedBy", "fullName email profilePicture");

  if (!feedback) {
    throw new AppError("Feedback not found", 404);
  }

  // Check authorization
  if (
    feedback.event.organizer.toString() !== req.user._id.toString() &&
    feedback.submittedBy._id.toString() !== req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to view this feedback", 403);
  }

  res.status(200).json({
    success: true,
    data: feedback,
  });
});

/**
 * @desc    Get event feedback (Organizer)
 * @route   GET /api/v1/feedback/event/:eventId
 * @access  Private (Organizer+)
 */
exports.getEventFeedback = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { status, minRating, page = 1, limit = 20 } = req.query;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check authorization
  if (
    event.organizer.toString() !== req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to view event feedback", 403);
  }

  const filter = { event: eventId };

  if (status) {
    filter.status = status;
  }

  if (minRating) {
    filter.overallRating = { $gte: parseInt(minRating) };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const feedbacks = await Feedback.find(filter)
    .populate("submittedBy", "fullName email profilePicture")
    .sort({ submittedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Feedback.countDocuments(filter);

  // Get feedback statistics
  const stats = await Feedback.aggregate([
    { $match: { event: event._id, status: "approved" } },
    {
      $group: {
        _id: null,
        totalFeedback: { $sum: 1 },
        avgOverallRating: { $avg: "$overallRating" },
        avgContentQuality: { $avg: "$contentQuality" },
        avgOrganization: { $avg: "$organizationRating" },
        avgVenue: { $avg: "$venueRating" },
        avgSpeaker: { $avg: "$speakerRating" },
        wouldRecommendCount: {
          $sum: { $cond: ["$wouldRecommend", 1, 0] },
        },
        ratingDistribution: {
          $push: "$overallRating",
        },
      },
    },
  ]);

  // Rating distribution
  const ratingDistribution = await Feedback.aggregate([
    { $match: { event: event._id, status: "approved" } },
    {
      $group: {
        _id: "$overallRating",
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  res.status(200).json({
    success: true,
    data: feedbacks,
    stats: stats[0] || {},
    ratingDistribution,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      limit: parseInt(limit),
    },
  });
});

/**
 * @desc    Get my feedback submissions
 * @route   GET /api/v1/feedback/my
 * @access  Private
 */
exports.getMyFeedback = asyncHandler(async (req, res) => {
  const feedbacks = await Feedback.find({ submittedBy: req.user._id })
    .populate("event", "title startDateTime eventType banner")
    .sort({ submittedAt: -1 });

  res.status(200).json({
    success: true,
    data: feedbacks,
  });
});

/**
 * @desc    Update feedback
 * @route   PUT /api/v1/feedback/:id
 * @access  Private
 */
exports.updateFeedback = asyncHandler(async (req, res) => {
  const {
    overallRating,
    contentQuality,
    organizationRating,
    venueRating,
    speakerRating,
    comment,
    suggestions,
    wouldRecommend,
  } = req.body;

  const feedback = await Feedback.findById(req.params.id);

  if (!feedback) {
    throw new AppError("Feedback not found", 404);
  }

  // Check if user owns this feedback
  if (feedback.submittedBy.toString() !== req.user._id.toString()) {
    throw new AppError("Not authorized to update this feedback", 403);
  }

  // Check if feedback is still editable (within 24 hours or pending)
  const hoursSinceSubmission =
    (new Date() - feedback.submittedAt) / (1000 * 60 * 60);

  if (hoursSinceSubmission > 24 && feedback.status !== "pending") {
    throw new AppError(
      "Feedback can only be edited within 24 hours of submission",
      400
    );
  }

  // Update fields
  if (overallRating !== undefined) feedback.overallRating = overallRating;
  if (contentQuality !== undefined) feedback.contentQuality = contentQuality;
  if (organizationRating !== undefined)
    feedback.organizationRating = organizationRating;
  if (venueRating !== undefined) feedback.venueRating = venueRating;
  if (speakerRating !== undefined) feedback.speakerRating = speakerRating;
  if (comment !== undefined) feedback.comment = comment;
  if (suggestions !== undefined) feedback.suggestions = suggestions;
  if (wouldRecommend !== undefined) feedback.wouldRecommend = wouldRecommend;

  await feedback.save();

  await feedback.populate([
    { path: "event", select: "title" },
    { path: "submittedBy", select: "fullName email" },
  ]);

  res.status(200).json({
    success: true,
    data: feedback,
    message: "Feedback updated successfully",
  });
});

/**
 * @desc    Delete feedback
 * @route   DELETE /api/v1/feedback/:id
 * @access  Private
 */
exports.deleteFeedback = asyncHandler(async (req, res) => {
  const feedback = await Feedback.findById(req.params.id);

  if (!feedback) {
    throw new AppError("Feedback not found", 404);
  }

  // Check if user owns this feedback or is admin
  if (
    feedback.submittedBy.toString() !== req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to delete this feedback", 403);
  }

  await feedback.deleteOne();

  res.status(200).json({
    success: true,
    message: "Feedback deleted successfully",
  });
});

/**
 * @desc    Approve/Reject feedback (Organizer/Admin)
 * @route   PUT /api/v1/feedback/:id/status
 * @access  Private (Organizer+)
 */
exports.updateFeedbackStatus = asyncHandler(async (req, res) => {
  const { status, moderationNotes } = req.body;

  const feedback = await Feedback.findById(req.params.id).populate("event");

  if (!feedback) {
    throw new AppError("Feedback not found", 404);
  }

  // Check authorization
  if (
    feedback.event.organizer.toString() !== req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to moderate feedback", 403);
  }

  feedback.status = status;
  if (moderationNotes) {
    feedback.moderationNotes = moderationNotes;
  }
  feedback.moderatedBy = req.user._id;
  feedback.moderatedAt = new Date();

  await feedback.save();

  res.status(200).json({
    success: true,
    data: feedback,
    message: `Feedback ${status} successfully`,
  });
});

/**
 * @desc    Get public event feedback (approved only)
 * @route   GET /api/v1/feedback/event/:eventId/public
 * @access  Public
 */
exports.getPublicEventFeedback = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  const filter = {
    event: eventId,
    status: "approved",
  };

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const feedbacks = await Feedback.find(filter)
    .select("-submittedBy -moderatedBy -moderationNotes")
    .sort({ submittedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Replace with "Anonymous" if anonymous
  const processedFeedbacks = feedbacks.map((fb) => {
    const fbObj = fb.toObject();
    if (fbObj.anonymous) {
      delete fbObj.submittedBy;
    }
    return fbObj;
  });

  const total = await Feedback.countDocuments(filter);

  // Get average ratings
  const stats = await Feedback.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        avgOverallRating: { $avg: "$overallRating" },
        avgContentQuality: { $avg: "$contentQuality" },
        avgOrganization: { $avg: "$organizationRating" },
        avgVenue: { $avg: "$venueRating" },
        avgSpeaker: { $avg: "$speakerRating" },
        totalFeedback: { $sum: 1 },
        wouldRecommendPercent: {
          $avg: { $cond: ["$wouldRecommend", 100, 0] },
        },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: processedFeedbacks,
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
 * @desc    Get feedback summary (Organizer)
 * @route   GET /api/v1/feedback/event/:eventId/summary
 * @access  Private (Organizer+)
 */
exports.getFeedbackSummary = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check authorization
  if (
    event.organizer.toString() !== req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to view feedback summary", 403);
  }

  // Overall statistics
  const overallStats = await Feedback.aggregate([
    { $match: { event: event._id, status: "approved" } },
    {
      $group: {
        _id: null,
        totalFeedback: { $sum: 1 },
        avgOverallRating: { $avg: "$overallRating" },
        avgContentQuality: { $avg: "$contentQuality" },
        avgOrganization: { $avg: "$organizationRating" },
        avgVenue: { $avg: "$venueRating" },
        avgSpeaker: { $avg: "$speakerRating" },
        wouldRecommendCount: { $sum: { $cond: ["$wouldRecommend", 1, 0] } },
      },
    },
  ]);

  // Rating distribution (1-5 stars)
  const ratingDistribution = await Feedback.aggregate([
    { $match: { event: event._id, status: "approved" } },
    {
      $group: {
        _id: "$overallRating",
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  // Top positive and negative comments
  const topPositive = await Feedback.find({
    event: eventId,
    status: "approved",
    overallRating: { $gte: 4 },
    comment: { $ne: null, $ne: "" },
  })
    .select("comment overallRating submittedAt")
    .sort({ overallRating: -1 })
    .limit(5);

  const topNegative = await Feedback.find({
    event: eventId,
    status: "approved",
    overallRating: { $lte: 2 },
    comment: { $ne: null, $ne: "" },
  })
    .select("comment overallRating submittedAt")
    .sort({ overallRating: 1 })
    .limit(5);

  // Common suggestions (word frequency analysis could be added)
  const suggestions = await Feedback.find({
    event: eventId,
    status: "approved",
    suggestions: { $ne: null, $ne: "" },
  })
    .select("suggestions")
    .limit(10);

  // Response rate
  const totalRegistrations = await EventRegistration.countDocuments({
    event: eventId,
    status: "confirmed",
    checkInTime: { $ne: null },
  });

  const responseRate =
    totalRegistrations > 0
      ? ((overallStats[0]?.totalFeedback || 0) / totalRegistrations) * 100
      : 0;

  res.status(200).json({
    success: true,
    data: {
      overall: overallStats[0] || {},
      ratingDistribution,
      topPositive,
      topNegative,
      suggestions: suggestions.map((s) => s.suggestions),
      responseRate: responseRate.toFixed(2),
      totalAttendees: totalRegistrations,
    },
  });
});

/**
 * @desc    Export feedback data (Organizer)
 * @route   GET /api/v1/feedback/event/:eventId/export
 * @access  Private (Organizer+)
 */
exports.exportFeedback = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { format = "json" } = req.query;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check authorization
  if (
    event.organizer.toString() !== req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to export feedback", 403);
  }

  const feedbacks = await Feedback.find({ event: eventId, status: "approved" })
    .populate("submittedBy", "fullName email")
    .sort({ submittedAt: -1 });

  if (format === "csv") {
    const csv = [
      [
        "Submitted At",
        "Submitted By",
        "Overall Rating",
        "Content Quality",
        "Organization",
        "Venue",
        "Speaker",
        "Would Recommend",
        "Comment",
        "Suggestions",
      ],
      ...feedbacks.map((fb) => [
        fb.submittedAt.toISOString(),
        fb.anonymous ? "Anonymous" : fb.submittedBy.fullName,
        fb.overallRating,
        fb.contentQuality || "",
        fb.organizationRating || "",
        fb.venueRating || "",
        fb.speakerRating || "",
        fb.wouldRecommend ? "Yes" : "No",
        fb.comment || "",
        fb.suggestions || "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=feedback-${eventId}.csv`
    );
    return res.send(csv);
  }

  res.status(200).json({
    success: true,
    data: feedbacks,
  });
});
