const Analytics = require("../models/Analytics");
const Event = require("../models/Event");
const EventRegistration = require("../models/EventRegistration");
const Payment = require("../models/Payment");
const Feedback = require("../models/Feedback");
const User = require("../models/User");
const Certificate = require("../models/Certificate");
const { asyncHandler } = require("../middleware/errorHandler");
const AppError = require("../middleware/errorHandler").AppError;
const logger = require("../utils/logger");

/**
 * @desc    Track custom analytics event
 * @route   POST /api/v1/analytics/track
 * @access  Private
 */
exports.trackEvent = asyncHandler(async (req, res) => {
  const { eventType, metricType, metricValue, metadata, relatedEvent } =
    req.body;

  const analytics = await Analytics.create({
    eventType,
    metricType,
    metricValue,
    relatedEvent,
    relatedUser: req.user._id,
    metadata,
    timestamp: new Date(),
  });

  res.status(201).json({
    success: true,
    data: analytics,
    message: "Analytics event tracked successfully",
  });
});

/**
 * @desc    Get event analytics (Organizer)
 * @route   GET /api/v1/analytics/event/:eventId
 * @access  Private (Organizer+)
 */
exports.getEventAnalytics = asyncHandler(async (req, res) => {
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
    throw new AppError("Not authorized to view event analytics", 403);
  }

  // Registration statistics
  const registrationStats = await EventRegistration.aggregate([
    { $match: { event: event._id } },
    {
      $group: {
        _id: null,
        totalRegistrations: { $sum: 1 },
        confirmed: {
          $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
        },
        pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
        cancelled: {
          $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
        },
        checkedIn: { $sum: { $cond: ["$checkInTime", 1, 0] } },
      },
    },
  ]);

  // Registration timeline (daily)
  const registrationTimeline = await EventRegistration.aggregate([
    { $match: { event: event._id } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$registrationDate" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Payment statistics
  const paymentStats = await Payment.aggregate([
    { $match: { event: event._id } },
    {
      $group: {
        _id: null,
        totalPayments: { $sum: 1 },
        completedPayments: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        totalRevenue: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$amount", 0] },
        },
        avgPaymentAmount: { $avg: "$amount" },
      },
    },
  ]);

  // Feedback statistics
  const feedbackStats = await Feedback.aggregate([
    { $match: { event: event._id, status: "approved" } },
    {
      $group: {
        _id: null,
        totalFeedback: { $sum: 1 },
        avgOverallRating: { $avg: "$overallRating" },
        avgContentQuality: { $avg: "$contentQuality" },
        avgOrganization: { $avg: "$organizationRating" },
        wouldRecommendCount: { $sum: { $cond: ["$wouldRecommend", 1, 0] } },
      },
    },
  ]);

  // Demographics (department distribution)
  const departmentDistribution = await EventRegistration.aggregate([
    { $match: { event: event._id, status: "confirmed" } },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "userInfo",
      },
    },
    { $unwind: "$userInfo" },
    {
      $group: {
        _id: "$userInfo.department",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  // Check-in rate over time
  const checkInTimeline = await EventRegistration.aggregate([
    { $match: { event: event._id, checkInTime: { $ne: null } } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%H:00", date: "$checkInTime" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Certificate generation stats
  const certificateStats = await Certificate.aggregate([
    { $match: { event: event._id } },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
        totalDownloads: { $sum: "$downloadCount" },
      },
    },
  ]);

  // Attendance rate
  const attendanceRate =
    registrationStats[0]?.confirmed > 0
      ? ((registrationStats[0]?.checkedIn || 0) /
          registrationStats[0].confirmed) *
        100
      : 0;

  // Response rate
  const responseRate =
    registrationStats[0]?.checkedIn > 0
      ? ((feedbackStats[0]?.totalFeedback || 0) /
          registrationStats[0].checkedIn) *
        100
      : 0;

  res.status(200).json({
    success: true,
    data: {
      event: {
        id: event._id,
        title: event.title,
        startDate: event.startDateTime,
        endDate: event.endDateTime,
        status: event.status,
      },
      registrations: registrationStats[0] || {},
      registrationTimeline,
      payments: paymentStats[0] || {},
      feedback: feedbackStats[0] || {},
      demographics: {
        byDepartment: departmentDistribution,
      },
      checkInTimeline,
      certificates: certificateStats,
      metrics: {
        attendanceRate: attendanceRate.toFixed(2),
        responseRate: responseRate.toFixed(2),
        capacityUtilization: (
          ((registrationStats[0]?.confirmed || 0) / event.maxParticipants) *
          100
        ).toFixed(2),
      },
    },
  });
});

/**
 * @desc    Get dashboard analytics (Admin)
 * @route   GET /api/v1/analytics/dashboard
 * @access  Private (Admin)
 */
exports.getDashboardAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }

  // Total counts
  const totalUsers = await User.countDocuments();
  const totalEvents = await Event.countDocuments();
  const activeEvents = await Event.countDocuments({
    status: "published",
    startDateTime: { $gte: new Date() },
  });
  const completedEvents = await Event.countDocuments({ status: "completed" });

  // Registration statistics
  const registrationStats = await EventRegistration.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: null,
        totalRegistrations: { $sum: 1 },
        confirmed: {
          $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
        },
      },
    },
  ]);

  // Revenue statistics
  const revenueStats = await Payment.aggregate([
    { $match: { ...dateFilter, status: "completed" } },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$amount" },
        totalTransactions: { $sum: 1 },
        avgTransactionValue: { $avg: "$amount" },
      },
    },
  ]);

  // Monthly revenue trend
  const monthlyRevenue = await Payment.aggregate([
    { $match: { status: "completed" } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m", date: "$createdAt" },
        },
        revenue: { $sum: "$amount" },
        transactions: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 12 },
  ]);

  // Event type distribution
  const eventTypeDistribution = await Event.aggregate([
    {
      $group: {
        _id: "$eventType",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  // Top events by registrations
  const topEvents = await EventRegistration.aggregate([
    {
      $group: {
        _id: "$event",
        registrations: { $sum: 1 },
      },
    },
    { $sort: { registrations: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "events",
        localField: "_id",
        foreignField: "_id",
        as: "eventInfo",
      },
    },
    { $unwind: "$eventInfo" },
    {
      $project: {
        eventId: "$_id",
        eventTitle: "$eventInfo.title",
        eventType: "$eventInfo.eventType",
        registrations: 1,
      },
    },
  ]);

  // User growth trend
  const userGrowth = await User.aggregate([
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m", date: "$createdAt" },
        },
        newUsers: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 12 },
  ]);

  // Feedback average ratings
  const avgRatings = await Feedback.aggregate([
    { $match: { status: "approved" } },
    {
      $group: {
        _id: null,
        avgOverallRating: { $avg: "$overallRating" },
        totalFeedback: { $sum: 1 },
      },
    },
  ]);

  // Certificate statistics
  const certificateStats = await Certificate.aggregate([
    {
      $group: {
        _id: null,
        totalCertificates: { $sum: 1 },
        totalDownloads: { $sum: "$downloadCount" },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      overview: {
        totalUsers,
        totalEvents,
        activeEvents,
        completedEvents,
        totalRegistrations: registrationStats[0]?.totalRegistrations || 0,
        confirmedRegistrations: registrationStats[0]?.confirmed || 0,
        totalRevenue: revenueStats[0]?.totalRevenue || 0,
        totalTransactions: revenueStats[0]?.totalTransactions || 0,
        avgRating: avgRatings[0]?.avgOverallRating || 0,
        totalCertificates: certificateStats[0]?.totalCertificates || 0,
      },
      trends: {
        monthlyRevenue,
        userGrowth,
      },
      distributions: {
        eventTypes: eventTypeDistribution,
      },
      topEvents,
    },
  });
});

/**
 * @desc    Get user analytics
 * @route   GET /api/v1/analytics/users
 * @access  Private (Admin)
 */
exports.getUserAnalytics = asyncHandler(async (req, res) => {
  // Role distribution
  const roleDistribution = await User.aggregate([
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
      },
    },
  ]);

  // Department distribution
  const departmentDistribution = await User.aggregate([
    { $match: { department: { $ne: null } } },
    {
      $group: {
        _id: "$department",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  // User activity (most active users by registrations)
  const mostActiveUsers = await EventRegistration.aggregate([
    {
      $group: {
        _id: "$user",
        eventCount: { $sum: 1 },
      },
    },
    { $sort: { eventCount: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "userInfo",
      },
    },
    { $unwind: "$userInfo" },
    {
      $project: {
        userId: "$_id",
        fullName: "$userInfo.fullName",
        email: "$userInfo.email",
        eventCount: 1,
      },
    },
  ]);

  // Registration rate by month
  const monthlyNewUsers = await User.aggregate([
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m", date: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 12 },
  ]);

  res.status(200).json({
    success: true,
    data: {
      roleDistribution,
      departmentDistribution,
      mostActiveUsers,
      monthlyNewUsers,
    },
  });
});

/**
 * @desc    Get event comparison
 * @route   POST /api/v1/analytics/compare
 * @access  Private (Organizer+)
 */
exports.compareEvents = asyncHandler(async (req, res) => {
  const { eventIds } = req.body;

  if (!eventIds || eventIds.length < 2) {
    throw new AppError("At least 2 event IDs required for comparison", 400);
  }

  const comparisons = [];

  for (const eventId of eventIds) {
    const event = await Event.findById(eventId);
    if (!event) continue;

    // Check authorization
    if (
      event.organizer.toString() !== req.user._id.toString() &&
      !["admin", "superadmin", "super_admin"].includes(req.user.role)
    ) {
      continue;
    }

    const registrations = await EventRegistration.aggregate([
      { $match: { event: event._id } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          confirmed: {
            $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
          },
          checkedIn: { $sum: { $cond: ["$checkInTime", 1, 0] } },
        },
      },
    ]);

    const revenue = await Payment.aggregate([
      { $match: { event: event._id, status: "completed" } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
        },
      },
    ]);

    const feedback = await Feedback.aggregate([
      { $match: { event: event._id, status: "approved" } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$overallRating" },
          count: { $sum: 1 },
        },
      },
    ]);

    comparisons.push({
      eventId: event._id,
      title: event.title,
      eventType: event.eventType,
      date: event.startDateTime,
      capacity: event.maxParticipants,
      registrations: registrations[0] || {},
      revenue: revenue[0]?.totalRevenue || 0,
      feedback: feedback[0] || {},
      attendanceRate: registrations[0]?.confirmed
        ? (
            ((registrations[0]?.checkedIn || 0) / registrations[0].confirmed) *
            100
          ).toFixed(2)
        : 0,
    });
  }

  res.status(200).json({
    success: true,
    data: comparisons,
  });
});

/**
 * @desc    Get performance metrics
 * @route   GET /api/v1/analytics/performance
 * @access  Private (Admin)
 */
exports.getPerformanceMetrics = asyncHandler(async (req, res) => {
  const { period = "30d" } = req.query;

  // Calculate date range
  const now = new Date();
  let startDate = new Date();

  if (period === "7d") {
    startDate.setDate(now.getDate() - 7);
  } else if (period === "30d") {
    startDate.setDate(now.getDate() - 30);
  } else if (period === "90d") {
    startDate.setDate(now.getDate() - 90);
  } else if (period === "1y") {
    startDate.setFullYear(now.getFullYear() - 1);
  }

  const dateFilter = { createdAt: { $gte: startDate } };

  // Event metrics
  const eventMetrics = await Event.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: null,
        totalEvents: { $sum: 1 },
        publishedEvents: {
          $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
        },
        completedEvents: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        cancelledEvents: {
          $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
        },
      },
    },
  ]);

  // Registration conversion rate
  const registrationMetrics = await EventRegistration.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        confirmed: {
          $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
        },
      },
    },
  ]);

  // Payment success rate
  const paymentMetrics = await Payment.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        successful: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        failed: {
          $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
        },
      },
    },
  ]);

  // Calculate rates
  const confirmationRate = registrationMetrics[0]?.total
    ? (
        ((registrationMetrics[0]?.confirmed || 0) /
          registrationMetrics[0].total) *
        100
      ).toFixed(2)
    : 0;

  const paymentSuccessRate = paymentMetrics[0]?.total
    ? (
        ((paymentMetrics[0]?.successful || 0) / paymentMetrics[0].total) *
        100
      ).toFixed(2)
    : 0;

  const eventCompletionRate = eventMetrics[0]?.totalEvents
    ? (
        ((eventMetrics[0]?.completedEvents || 0) /
          eventMetrics[0].totalEvents) *
        100
      ).toFixed(2)
    : 0;

  res.status(200).json({
    success: true,
    data: {
      period,
      events: eventMetrics[0] || {},
      registrations: registrationMetrics[0] || {},
      payments: paymentMetrics[0] || {},
      rates: {
        confirmationRate,
        paymentSuccessRate,
        eventCompletionRate,
      },
    },
  });
});

/**
 * @desc    Get export analytics data
 * @route   GET /api/v1/analytics/export
 * @access  Private (Admin)
 */
exports.exportAnalytics = asyncHandler(async (req, res) => {
  const { type, startDate, endDate, format = "json" } = req.query;

  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.timestamp = {};
    if (startDate) dateFilter.timestamp.$gte = new Date(startDate);
    if (endDate) dateFilter.timestamp.$lte = new Date(endDate);
  }

  let data;

  switch (type) {
    case "events":
      data = await Event.find(dateFilter).lean();
      break;
    case "registrations":
      data = await EventRegistration.find(dateFilter)
        .populate("event user")
        .lean();
      break;
    case "payments":
      data = await Payment.find(dateFilter).populate("event user").lean();
      break;
    case "feedback":
      data = await Feedback.find(dateFilter).populate("event").lean();
      break;
    default:
      data = await Analytics.find(dateFilter).lean();
  }

  if (format === "csv") {
    // Convert to CSV (basic implementation)
    const csv = JSON.stringify(data);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${type}-analytics.csv`
    );
    return res.send(csv);
  }

  res.status(200).json({
    success: true,
    data,
  });
});
