const Notification = require("../models/Notification");
const User = require("../models/User");
const Event = require("../models/Event");
const { asyncHandler } = require("../middleware/errorHandler");
const AppError = require("../middleware/errorHandler").AppError;
const logger = require("../utils/logger");
const { sendEmail } = require("../utils/email");
const { sendSMS } = require("../utils/sms");

/**
 * @desc    Create notification
 * @route   POST /api/v1/notifications
 * @access  Private (Organizer+)
 */
exports.createNotification = asyncHandler(async (req, res) => {
  const {
    recipients, // Array of user IDs or 'all'
    title,
    message,
    type,
    relatedEvent,
    channels = ["in_app"],
    priority = "normal",
    scheduledFor,
  } = req.body;

  let recipientIds = [];

  if (recipients === "all") {
    // Send to all users
    const users = await User.find({ isActive: true }).select("_id");
    recipientIds = users.map((u) => u._id);
  } else if (Array.isArray(recipients)) {
    recipientIds = recipients;
  } else {
    recipientIds = [recipients];
  }

  const notifications = [];

  for (const recipientId of recipientIds) {
    const notification = await Notification.create({
      recipient: recipientId,
      title,
      message,
      type,
      relatedEvent,
      channels,
      priority,
      scheduledFor: scheduledFor || new Date(),
      sentBy: req.user._id,
    });

    notifications.push(notification);

    // Send immediately if not scheduled
    if (!scheduledFor || new Date(scheduledFor) <= new Date()) {
      await sendNotificationNow(notification);
    }
  }

  res.status(201).json({
    success: true,
    data: notifications,
    message: `${notifications.length} notification(s) created successfully`,
  });
});

/**
 * Helper function to send notification immediately
 */
const sendNotificationNow = async (notification) => {
  try {
    const user = await User.findById(notification.recipient);
    if (!user) return;

    // Send via email
    if (notification.channels.includes("email") && user.email) {
      try {
        await sendEmail({
          to: user.email,
          subject: notification.title,
          text: notification.message,
        });

        notification.deliveryStatus.email = "delivered";
      } catch (error) {
        logger.error("Failed to send email notification:", error);
        notification.deliveryStatus.email = "failed";
      }
    }

    // Send via SMS
    if (notification.channels.includes("sms") && user.phone) {
      try {
        await sendSMS({
          to: user.phone,
          message: `${notification.title}: ${notification.message}`,
        });

        notification.deliveryStatus.sms = "delivered";
      } catch (error) {
        logger.error("Failed to send SMS notification:", error);
        notification.deliveryStatus.sms = "failed";
      }
    }

    // In-app is always marked as delivered when created
    if (notification.channels.includes("in_app")) {
      notification.deliveryStatus.in_app = "delivered";
    }

    // Push notification (implement if needed)
    if (notification.channels.includes("push")) {
      // Implement push notification logic here
      notification.deliveryStatus.push = "pending";
    }

    notification.sentAt = new Date();
    await notification.save();
  } catch (error) {
    logger.error("Error sending notification:", error);
  }
};

/**
 * @desc    Get my notifications
 * @route   GET /api/v1/notifications/my
 * @access  Private
 */
exports.getMyNotifications = asyncHandler(async (req, res) => {
  const { isRead, type, page = 1, limit = 20 } = req.query;

  const filter = { recipient: req.user._id };

  if (isRead !== undefined) {
    filter.isRead = isRead === "true";
  }

  if (type) {
    filter.type = type;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const notifications = await Notification.find(filter)
    .populate("relatedEvent", "title startDateTime")
    .populate("sentBy", "fullName")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Notification.countDocuments(filter);
  const unreadCount = await Notification.countDocuments({
    recipient: req.user._id,
    isRead: false,
  });

  res.status(200).json({
    success: true,
    data: notifications,
    unreadCount,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      limit: parseInt(limit),
    },
  });
});

/**
 * @desc    Mark notification as read
 * @route   PUT /api/v1/notifications/:id/read
 * @access  Private
 */
exports.markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  // Check if user owns this notification
  if (notification.recipient.toString() !== req.user._id.toString()) {
    throw new AppError("Not authorized to access this notification", 403);
  }

  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();

  res.status(200).json({
    success: true,
    data: notification,
    message: "Notification marked as read",
  });
});

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/v1/notifications/mark-all-read
 * @access  Private
 */
exports.markAllAsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} notification(s) marked as read`,
  });
});

/**
 * @desc    Delete notification
 * @route   DELETE /api/v1/notifications/:id
 * @access  Private
 */
exports.deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  // Check if user owns this notification
  if (notification.recipient.toString() !== req.user._id.toString()) {
    throw new AppError("Not authorized to delete this notification", 403);
  }

  await notification.deleteOne();

  res.status(200).json({
    success: true,
    message: "Notification deleted successfully",
  });
});

/**
 * @desc    Delete all notifications
 * @route   DELETE /api/v1/notifications/delete-all
 * @access  Private
 */
exports.deleteAllNotifications = asyncHandler(async (req, res) => {
  const result = await Notification.deleteMany({ recipient: req.user._id });

  res.status(200).json({
    success: true,
    message: `${result.deletedCount} notification(s) deleted`,
  });
});

/**
 * @desc    Send bulk notification to event participants
 * @route   POST /api/v1/notifications/event/:eventId/bulk
 * @access  Private (Organizer+)
 */
exports.sendBulkEventNotification = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const {
    title,
    message,
    channels = ["in_app", "email"],
    status = "confirmed",
  } = req.body;

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
    throw new AppError(
      "Not authorized to send notifications for this event",
      403
    );
  }

  // Get all participants based on status
  const EventRegistration = require("../models/EventRegistration");
  const registrations = await EventRegistration.find({
    event: eventId,
    status: status,
  }).populate("user");

  if (registrations.length === 0) {
    throw new AppError("No participants found", 404);
  }

  const notifications = [];

  for (const registration of registrations) {
    const notification = await Notification.create({
      recipient: registration.user._id,
      title,
      message,
      type: "event",
      relatedEvent: eventId,
      channels,
      sentBy: req.user._id,
    });

    notifications.push(notification);
    await sendNotificationNow(notification);
  }

  res.status(200).json({
    success: true,
    data: {
      sent: notifications.length,
    },
    message: `Notification sent to ${notifications.length} participant(s)`,
  });
});

/**
 * @desc    Get notification statistics (Admin)
 * @route   GET /api/v1/notifications/stats
 * @access  Private (Admin)
 */
exports.getNotificationStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }

  const totalStats = await Notification.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        read: { $sum: { $cond: ["$isRead", 1, 0] } },
        unread: { $sum: { $cond: ["$isRead", 0, 1] } },
      },
    },
  ]);

  const byType = await Notification.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const byChannel = await Notification.aggregate([
    { $match: dateFilter },
    { $unwind: "$channels" },
    {
      $group: {
        _id: "$channels",
        count: { $sum: 1 },
      },
    },
  ]);

  const deliveryStats = await Notification.aggregate([
    { $match: dateFilter },
    {
      $project: {
        emailDelivered: {
          $cond: [{ $eq: ["$deliveryStatus.email", "delivered"] }, 1, 0],
        },
        smsDelivered: {
          $cond: [{ $eq: ["$deliveryStatus.sms", "delivered"] }, 1, 0],
        },
        emailFailed: {
          $cond: [{ $eq: ["$deliveryStatus.email", "failed"] }, 1, 0],
        },
        smsFailed: {
          $cond: [{ $eq: ["$deliveryStatus.sms", "failed"] }, 1, 0],
        },
      },
    },
    {
      $group: {
        _id: null,
        emailDelivered: { $sum: "$emailDelivered" },
        smsDelivered: { $sum: "$smsDelivered" },
        emailFailed: { $sum: "$emailFailed" },
        smsFailed: { $sum: "$smsFailed" },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      overview: totalStats[0] || {},
      byType,
      byChannel,
      delivery: deliveryStats[0] || {},
    },
  });
});

/**
 * @desc    Get notification preferences
 * @route   GET /api/v1/notifications/preferences
 * @access  Private
 */
exports.getPreferences = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "notificationPreferences"
  );

  res.status(200).json({
    success: true,
    data: user.notificationPreferences || {
      email: true,
      sms: true,
      push: true,
      in_app: true,
    },
  });
});

/**
 * @desc    Update notification preferences
 * @route   PUT /api/v1/notifications/preferences
 * @access  Private
 */
exports.updatePreferences = asyncHandler(async (req, res) => {
  const { email, sms, push, in_app } = req.body;

  const user = await User.findById(req.user._id);

  user.notificationPreferences = {
    email:
      email !== undefined ? email : user.notificationPreferences?.email || true,
    sms: sms !== undefined ? sms : user.notificationPreferences?.sms || true,
    push:
      push !== undefined ? push : user.notificationPreferences?.push || true,
    in_app:
      in_app !== undefined
        ? in_app
        : user.notificationPreferences?.in_app || true,
  };

  await user.save();

  res.status(200).json({
    success: true,
    data: user.notificationPreferences,
    message: "Notification preferences updated successfully",
  });
});

/**
 * @desc    Resend failed notifications
 * @route   POST /api/v1/notifications/resend-failed
 * @access  Private (Admin)
 */
exports.resendFailedNotifications = asyncHandler(async (req, res) => {
  // Find notifications with failed delivery
  const failedNotifications = await Notification.find({
    $or: [
      { "deliveryStatus.email": "failed" },
      { "deliveryStatus.sms": "failed" },
    ],
  }).limit(100); // Limit to prevent overwhelming the system

  let resent = 0;

  for (const notification of failedNotifications) {
    await sendNotificationNow(notification);
    resent++;
  }

  res.status(200).json({
    success: true,
    message: `${resent} notification(s) resent`,
  });
});

/**
 * @desc    Get sent notifications (Admin/Organizer)
 * @route   GET /api/v1/notifications/sent
 * @access  Private (Organizer+)
 */
exports.getSentNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const filter = { sentBy: req.user._id };

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const notifications = await Notification.find(filter)
    .populate("recipient", "fullName email")
    .populate("relatedEvent", "title")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Notification.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: notifications,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      limit: parseInt(limit),
    },
  });
});
