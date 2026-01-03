const User = require("../models/User");
const Event = require("../models/Event");
const EventRegistration = require("../models/EventRegistration");
const Payment = require("../models/Payment");
const Certificate = require("../models/Certificate");
const Feedback = require("../models/Feedback");
const AuditLog = require("../models/AuditLog");
const RolePermission = require("../models/RolePermission");
const Settings = require("../models/Settings");
const { asyncHandler } = require("../middleware/errorHandler");
const AppError = require("../middleware/errorHandler").AppError;
const logger = require("../utils/logger");

/**
 * @desc    Get dashboard statistics
 * @route   GET /api/v1/admin/dashboard
 * @access  Private (Admin)
 */
exports.getDashboard = asyncHandler(async (req, res) => {
  // Overall counts
  const totalUsers = await User.countDocuments();
  const totalEvents = await Event.countDocuments();
  const totalRegistrations = await EventRegistration.countDocuments();
  const totalRevenue = await Payment.aggregate([
    { $match: { status: "completed" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  // Recent activities
  const recentUsers = await User.find()
    .select("fullName email role createdAt")
    .sort({ createdAt: -1 })
    .limit(10);

  const recentEvents = await Event.find()
    .select("title status startDateTime organizer")
    .populate("organizer", "fullName")
    .sort({ createdAt: -1 })
    .limit(10);

  const recentPayments = await Payment.find()
    .select("amount status createdAt user event")
    .populate("user", "fullName")
    .populate("event", "title")
    .sort({ createdAt: -1 })
    .limit(10);

  // Statistics by status
  const eventsByStatus = await Event.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const usersByRole = await User.aggregate([
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      overview: {
        totalUsers,
        totalEvents,
        totalRegistrations,
        totalRevenue: totalRevenue[0]?.total || 0,
      },
      distributions: {
        eventsByStatus,
        usersByRole,
      },
      recent: {
        users: recentUsers,
        events: recentEvents,
        payments: recentPayments,
      },
    },
  });
});

/**
 * @desc    Get all users (Admin)
 * @route   GET /api/v1/admin/users
 * @access  Private (Admin)
 */
exports.getAllUsers = asyncHandler(async (req, res) => {
  const {
    role,
    department,
    isActive,
    search,
    page = 1,
    limit = 20,
  } = req.query;

  const filter = {};

  if (role) filter.role = role;
  if (department) filter.department = department;
  if (isActive !== undefined) filter.isActive = isActive === "true";

  if (search) {
    filter.$or = [
      { fullName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const users = await User.find(filter)
    .select("-password -resetPasswordToken -resetPasswordExpire")
    .populate("departmentId", "name code")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await User.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: {
      users: users,
    },
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      limit: parseInt(limit),
    },
  });
});

/**
 * @desc    Update user role (Admin)
 * @route   PUT /api/v1/admin/users/:id/role
 * @access  Private (Admin)
 */
exports.updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;

  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Prevent changing own role
  if (user._id.toString() === req.user._id.toString()) {
    throw new AppError("Cannot change your own role", 400);
  }

  const oldRole = user.role;
  user.role = role;
  await user.save();

  // Log the action
  await AuditLog.create({
    action: "update",
    resource: "user",
    resourceId: user._id,
    performedBy: req.user._id,
    changes: {
      role: { old: oldRole, new: role },
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  res.status(200).json({
    success: true,
    data: user,
    message: "User role updated successfully",
  });
});

/**
 * @desc    Suspend/Activate user (Admin)
 * @route   PUT /api/v1/admin/users/:id/status
 * @access  Private (Admin)
 */
exports.updateUserStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;

  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Prevent changing own status
  if (user._id.toString() === req.user._id.toString()) {
    throw new AppError("Cannot change your own status", 400);
  }

  user.isActive = isActive;
  await user.save();

  // Log the action
  await AuditLog.create({
    action: "update",
    resource: "user",
    resourceId: user._id,
    performedBy: req.user._id,
    changes: {
      isActive: { old: !isActive, new: isActive },
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  res.status(200).json({
    success: true,
    data: user,
    message: `User ${isActive ? "activated" : "suspended"} successfully`,
  });
});

/**
 * @desc    Delete user (Admin)
 * @route   DELETE /api/v1/admin/users/:id
 * @access  Private (Superadmin)
 */
exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Prevent deleting own account
  if (user._id.toString() === req.user._id.toString()) {
    throw new AppError("Cannot delete your own account", 400);
  }

  await user.deleteOne();

  // Log the action
  await AuditLog.create({
    action: "delete",
    resource: "user",
    resourceId: user._id,
    performedBy: req.user._id,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  res.status(200).json({
    success: true,
    message: "User deleted successfully",
  });
});

/**
 * @desc    Get all events (Admin)
 * @route   GET /api/v1/admin/events
 * @access  Private (Admin)
 */
exports.getAllEvents = asyncHandler(async (req, res) => {
  const { status, eventType, search, page = 1, limit = 20 } = req.query;

  const filter = {};

  if (status) filter.status = status;
  if (eventType) filter.eventType = eventType;

  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const events = await Event.find(filter)
    .populate("organizer", "fullName email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Event.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: events,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      limit: parseInt(limit),
    },
  });
});

/**
 * @desc    Force delete event (Admin)
 * @route   DELETE /api/v1/admin/events/:id
 * @access  Private (Admin)
 */
exports.forceDeleteEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);

  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Delete associated records
  await EventRegistration.deleteMany({ event: event._id });
  await Payment.updateMany({ event: event._id }, { $set: { event: null } });

  await event.deleteOne();

  // Log the action
  await AuditLog.create({
    action: "delete",
    resource: "event",
    resourceId: event._id,
    performedBy: req.user._id,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  res.status(200).json({
    success: true,
    message: "Event deleted successfully",
  });
});

/**
 * @desc    Get audit logs
 * @route   GET /api/v1/admin/audit-logs
 * @access  Private (Admin)
 */
exports.getAuditLogs = asyncHandler(async (req, res) => {
  const {
    action,
    resource,
    performedBy,
    startDate,
    endDate,
    page = 1,
    limit = 50,
  } = req.query;

  const filter = {};

  if (action) filter.action = action;
  if (resource) filter.resource = resource;
  if (performedBy) filter.performedBy = performedBy;

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const logs = await AuditLog.find(filter)
    .populate("performedBy", "fullName email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await AuditLog.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: logs,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      limit: parseInt(limit),
    },
  });
});

/**
 * @desc    Get system settings
 * @route   GET /api/v1/admin/settings
 * @access  Private (Admin)
 */
exports.getSettings = asyncHandler(async (req, res) => {
  const { category } = req.query;

  const filter = {};
  if (category) filter.category = category;

  const settings = await Settings.find(filter);

  // Group by category
  const grouped = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = {};
    }
    acc[setting.category][setting.key] = setting.value;
    return acc;
  }, {});

  res.status(200).json({
    success: true,
    data: grouped,
  });
});

/**
 * @desc    Update system setting
 * @route   PUT /api/v1/admin/settings/:key
 * @access  Private (Admin)
 */
exports.updateSetting = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const { value, category = "general", description } = req.body;

  let setting = await Settings.findOne({ key });

  if (!setting) {
    setting = await Settings.create({
      key,
      value,
      category,
      description,
    });
  } else {
    setting.value = value;
    if (category) setting.category = category;
    if (description) setting.description = description;
    await setting.save();
  }

  // Log the action
  await AuditLog.create({
    action: "update",
    resource: "setting",
    resourceId: setting._id,
    performedBy: req.user._id,
    changes: {
      [key]: value,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  res.status(200).json({
    success: true,
    data: setting,
    message: "Setting updated successfully",
  });
});

/**
 * @desc    Manage role permissions
 * @route   POST /api/v1/admin/permissions
 * @access  Private (Superadmin)
 */
exports.managePermissions = asyncHandler(async (req, res) => {
  const { permissions, description } = req.body;

  // Route uses /permissions/:roleId but earlier versions used body.role.
  const role = (req.body.role || req.params.roleId || "").toString().trim();

  if (!role) {
    throw new AppError("Role is required", 400);
  }

  let rolePermission = await RolePermission.findOne({ role });

  if (!rolePermission) {
    rolePermission = await RolePermission.create({
      role,
      permissions,
      description,
    });
  } else {
    rolePermission.permissions = permissions;
    if (description) rolePermission.description = description;
    await rolePermission.save();
  }

  res.status(200).json({
    success: true,
    data: rolePermission,
    message: "Permissions updated successfully",
  });
});

/**
 * @desc    Get all permissions
 * @route   GET /api/v1/admin/permissions
 * @access  Private (Admin)
 */
exports.getAllPermissions = asyncHandler(async (req, res) => {
  const permissions = await RolePermission.find();

  res.status(200).json({
    success: true,
    data: permissions,
  });
});

/**
 * @desc    Get system statistics
 * @route   GET /api/v1/admin/statistics
 * @access  Private (Admin)
 */
exports.getSystemStatistics = asyncHandler(async (req, res) => {
  const { period = "30d" } = req.query;

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

  // User growth
  const newUsers = await User.countDocuments(dateFilter);
  const totalUsers = await User.countDocuments();

  // Event statistics
  const newEvents = await Event.countDocuments(dateFilter);
  const totalEvents = await Event.countDocuments();
  const activeEvents = await Event.countDocuments({
    status: "published",
    startDateTime: { $gte: now },
  });

  // Registration statistics
  const newRegistrations = await EventRegistration.countDocuments(dateFilter);
  const totalRegistrations = await EventRegistration.countDocuments();

  // Revenue statistics
  const revenue = await Payment.aggregate([
    { $match: { ...dateFilter, status: "completed" } },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  // Certificate statistics
  const certificates = await Certificate.countDocuments(dateFilter);

  // Feedback statistics
  const feedbackCount = await Feedback.countDocuments(dateFilter);
  const avgRating = await Feedback.aggregate([
    { $match: { ...dateFilter, status: "approved" } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: "$overallRating" },
      },
    },
  ]);

  // Daily activity
  const dailyActivity = await User.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        newUsers: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.status(200).json({
    success: true,
    data: {
      period,
      users: {
        new: newUsers,
        total: totalUsers,
        growthRate:
          totalUsers > 0 ? ((newUsers / totalUsers) * 100).toFixed(2) : 0,
      },
      events: {
        new: newEvents,
        total: totalEvents,
        active: activeEvents,
      },
      registrations: {
        new: newRegistrations,
        total: totalRegistrations,
      },
      revenue: {
        amount: revenue[0]?.total || 0,
        transactions: revenue[0]?.count || 0,
      },
      certificates,
      feedback: {
        count: feedbackCount,
        avgRating: avgRating[0]?.avgRating || 0,
      },
      dailyActivity,
    },
  });
});

/**
 * @desc    Bulk operations - Delete inactive users
 * @route   POST /api/v1/admin/bulk/delete-inactive-users
 * @access  Private (Superadmin)
 */
exports.deleteInactiveUsers = asyncHandler(async (req, res) => {
  const daysInactiveRaw =
    req.body?.daysInactive ?? req.query?.daysInactive ?? 365;
  const daysInactive = parseInt(daysInactiveRaw, 10);

  const cutoffDate = new Date();
  cutoffDate.setDate(
    cutoffDate.getDate() - (Number.isFinite(daysInactive) ? daysInactive : 365)
  );

  const result = await User.deleteMany({
    lastLogin: { $lt: cutoffDate },
    role: "student", // Only delete students
  });

  // Log the action
  await AuditLog.create({
    action: "bulk_delete",
    resource: "user",
    performedBy: req.user._id,
    details: `Deleted ${result.deletedCount} inactive users`,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  res.status(200).json({
    success: true,
    message: `${result.deletedCount} inactive users deleted`,
  });
});

/**
 * @desc    Generate system report
 * @route   GET /api/v1/admin/reports/system
 * @access  Private (Admin)
 */
exports.generateSystemReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, format = "json" } = req.query;

  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }

  const report = {
    generatedAt: new Date(),
    period: { startDate, endDate },
    users: await User.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]),
    events: await Event.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
    registrations: await EventRegistration.countDocuments(dateFilter),
    revenue: await Payment.aggregate([
      { $match: { ...dateFilter, status: "completed" } },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]),
    certificates: await Certificate.countDocuments(dateFilter),
    feedback: await Feedback.countDocuments(dateFilter),
  };

  if (format === "json") {
    return res.status(200).json({
      success: true,
      data: report,
    });
  }

  // Add CSV export if needed
  res.status(200).json({
    success: true,
    data: report,
  });
});

/**
 * @desc    Clear cache (Admin)
 * @route   POST /api/v1/admin/cache/clear
 * @access  Private (Admin)
 */
exports.clearCache = asyncHandler(async (req, res) => {
  const redis = require("../config/redis");
  const client = redis.getClient();

  await client.flushall();

  logger.info("Cache cleared by admin:", req.user._id);

  res.status(200).json({
    success: true,
    message: "Cache cleared successfully",
  });
});

/**
 * @desc    Get system health
 * @route   GET /api/v1/admin/health
 * @access  Private (Admin)
 */
exports.getSystemHealth = asyncHandler(async (req, res) => {
  const mongoose = require("mongoose");
  const redis = require("../config/redis");

  const health = {
    status: "healthy",
    timestamp: new Date(),
    services: {
      database: {
        status:
          mongoose.connection.readyState === 1 ? "connected" : "disconnected",
        readyState: mongoose.connection.readyState,
      },
      redis: {
        status: redis.getClient().status || "unknown",
      },
    },
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
    },
  };

  res.status(200).json({
    success: true,
    data: health,
  });
});
