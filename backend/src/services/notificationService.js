const Notification = require("../models/Notification");
const logger = require("./logger");

/**
 * Centralized notification service
 * Provides helper methods to create notifications from any controller
 */

/**
 * Create a notification for a user
 * @param {Object} options - Notification options
 * @param {String} options.recipient - User ID to send notification to
 * @param {String} options.title - Notification title
 * @param {String} options.message - Notification message
 * @param {String} options.type - Notification type (event, payment, certificate, etc.)
 * @param {String} [options.relatedEvent] - Related event ID
 * @param {Array} [options.channels] - Delivery channels (in_app, email, sms)
 * @param {String} [options.sentBy] - User ID of sender
 * @param {String} [options.priority] - Priority level (low, normal, high)
 * @returns {Promise<Notification>}
 */
async function createNotification({
  recipient,
  title,
  message,
  type,
  relatedEvent = null,
  channels = ["in_app"],
  sentBy = null,
  priority = "normal",
}) {
  try {
    // Validation
    if (!recipient || !title || !message || !type) {
      throw new Error("Missing required notification fields");
    }

    const notification = await Notification.create({
      recipient,
      title,
      message,
      type,
      relatedEvent,
      channels,
      sentBy,
      priority,
      scheduledFor: new Date(),
    });

    logger.info(
      `Notification created: ${notification._id} for user ${recipient}`
    );
    return notification;
  } catch (error) {
    logger.error("Failed to create notification:", error);
    throw error;
  }
}

/**
 * Create multiple notifications (bulk)
 * @param {Array} notificationsData - Array of notification objects
 * @returns {Promise<Array<Notification>>}
 */
async function createBulkNotifications(notificationsData) {
  try {
    const notifications = await Notification.insertMany(notificationsData);
    logger.info(`${notifications.length} notifications created`);
    return notifications;
  } catch (error) {
    logger.error("Failed to create bulk notifications:", error);
    throw error;
  }
}

/**
 * Notification templates for common scenarios
 */
const NotificationTemplates = {
  // Event registration
  eventRegistrationSuccess: (recipientId, eventTitle, eventId) => ({
    recipient: recipientId,
    title: "Registration Successful",
    message: `You have successfully registered for ${eventTitle}. Check your email for confirmation details.`,
    type: "event",
    relatedEvent: eventId,
    channels: ["in_app", "email"],
    priority: "normal",
  }),

  // Payment
  paymentSuccess: (recipientId, eventTitle, amount, currency, eventId) => ({
    recipient: recipientId,
    title: "Payment Successful - Registration Confirmed",
    message: `Your payment of ${currency} ${amount} for ${eventTitle} has been confirmed. Your registration is now complete!`,
    type: "payment",
    relatedEvent: eventId,
    channels: ["in_app", "email"],
    priority: "high",
  }),

  paymentFailed: (recipientId, eventTitle, eventId) => ({
    recipient: recipientId,
    title: "Payment Failed",
    message: `Your payment for ${eventTitle} could not be processed. Please try again or contact support.`,
    type: "payment",
    relatedEvent: eventId,
    channels: ["in_app", "email"],
    priority: "high",
  }),

  // Team
  teamCreated: (recipientId, teamName, eventTitle, eventId) => ({
    recipient: recipientId,
    title: "Team Created Successfully",
    message: `Your team "${teamName}" for ${eventTitle} has been created. Share your team code to invite members.`,
    type: "team",
    relatedEvent: eventId,
    channels: ["in_app"],
    priority: "normal",
  }),

  teamMemberAdded: (recipientId, teamName, eventTitle, eventId) => ({
    recipient: recipientId,
    title: "Added to Team",
    message: `You have been added to team "${teamName}" for ${eventTitle}.`,
    type: "team",
    relatedEvent: eventId,
    channels: ["in_app", "email"],
    priority: "normal",
  }),

  teamMemberRemoved: (recipientId, teamName, eventTitle, eventId) => ({
    recipient: recipientId,
    title: "Removed from Team",
    message: `You have been removed from team "${teamName}" for ${eventTitle}.`,
    type: "team",
    relatedEvent: eventId,
    channels: ["in_app", "email"],
    priority: "normal",
  }),

  // Round
  roundStarted: (recipientId, roundName, eventTitle, eventId) => ({
    recipient: recipientId,
    title: "Event Round Started",
    message: `${roundName} for ${eventTitle} has started. Good luck!`,
    type: "event",
    relatedEvent: eventId,
    channels: ["in_app", "email"],
    priority: "high",
  }),

  roundAdvanced: (recipientId, roundName, eventTitle, eventId) => ({
    recipient: recipientId,
    title: "Advanced to Next Round",
    message: `Congratulations! You have been selected for ${roundName} of ${eventTitle}.`,
    type: "event",
    relatedEvent: eventId,
    channels: ["in_app", "email"],
    priority: "high",
  }),

  roundEliminated: (recipientId, eventTitle, eventId) => ({
    recipient: recipientId,
    title: "Round Elimination",
    message: `Thank you for participating in ${eventTitle}. Unfortunately, you have not been selected for the next round.`,
    type: "event",
    relatedEvent: eventId,
    channels: ["in_app", "email"],
    priority: "normal",
  }),

  // Results
  resultDeclared: (recipientId, eventTitle, position, eventId) => ({
    recipient: recipientId,
    title: "Event Results Announced",
    message: `Results for ${eventTitle} have been declared. ${
      position
        ? `You secured position ${position}!`
        : "Check the event page for details."
    }`,
    type: "result",
    relatedEvent: eventId,
    channels: ["in_app", "email"],
    priority: "high",
  }),

  // Certificate
  certificateGenerated: (
    recipientId,
    eventTitle,
    certificateNumber,
    eventId
  ) => ({
    recipient: recipientId,
    title: "Certificate Available",
    message: `Your certificate (${certificateNumber}) for ${eventTitle} is ready to download.`,
    type: "certificate",
    relatedEvent: eventId,
    channels: ["in_app", "email"],
    priority: "normal",
  }),

  // Admin announcements
  adminAnnouncement: (
    recipientId,
    title,
    message,
    eventId = null,
    sentBy = null
  ) => ({
    recipient: recipientId,
    title,
    message,
    type: "announcement",
    relatedEvent: eventId,
    channels: ["in_app", "email"],
    priority: "high",
    sentBy,
  }),

  // Event updates
  eventUpdated: (recipientId, eventTitle, changes, eventId) => ({
    recipient: recipientId,
    title: "Event Updated",
    message: `${eventTitle} has been updated. ${changes}`,
    type: "event",
    relatedEvent: eventId,
    channels: ["in_app"],
    priority: "normal",
  }),

  eventCancelled: (recipientId, eventTitle, eventId) => ({
    recipient: recipientId,
    title: "Event Cancelled",
    message: `${eventTitle} has been cancelled. Your registration will be automatically refunded if payment was made.`,
    type: "event",
    relatedEvent: eventId,
    channels: ["in_app", "email"],
    priority: "high",
  }),
};

module.exports = {
  createNotification,
  createBulkNotifications,
  NotificationTemplates,
};
