/**
 * AUTO-TRANSITION BACKGROUND JOBS
 * Handles automatic status transitions for events and rounds based on datetime
 *
 * Runs every 5 minutes to check and update:
 * - Event: published → ongoing (when startDateTime reached)
 * - Event: ongoing → completed (when endDateTime reached)
 * - Round: upcoming → active (when startDate reached)
 * - Round: active → completed (when endDate reached)
 * - Registration: pending → cancelled (payment timeout after 24h)
 */

const cron = require("node-cron");
const Event = require("../models/Event");
const EventRegistration = require("../models/EventRegistration");
const Notification = require("../models/Notification");
const logger = require("../utils/logger");

/**
 * Auto-transition events from PUBLISHED to ONGOING
 */
async function transitionEventsToOngoing() {
  try {
    const now = new Date();

    // Find events that should be ongoing
    const events = await Event.find({
      status: "published",
      startDateTime: { $lte: now },
      endDateTime: { $gt: now },
    });

    if (events.length === 0) {
      return;
    }

    logger.info(
      `[AUTO-TRANSITION] Found ${events.length} events to transition to ONGOING`
    );

    for (const event of events) {
      event.status = "ongoing";
      await event.save();

      logger.info(
        `[AUTO-TRANSITION] Event ${event._id} (${event.title}) transitioned to ONGOING`
      );

      // Notify organizer
      await Notification.create({
        recipient: event.organizerId,
        title: `Event Started: ${event.title}`,
        message: `Your event "${event.title}" has started. You can now mark attendance and manage the event.`,
        type: "event_status_change",
        relatedEvent: event._id,
        priority: "high",
        channels: ["in_app", "email"],
      });

      // Optionally notify all confirmed participants
      const confirmedRegistrations = await EventRegistration.find({
        event: event._id,
        status: "confirmed",
      }).select("user");

      for (const reg of confirmedRegistrations) {
        await Notification.create({
          recipient: reg.user,
          title: `Event Starting Now: ${event.title}`,
          message: `The event "${event.title}" is now ongoing. Don't forget to check in!`,
          type: "event_started",
          relatedEvent: event._id,
          priority: "normal",
          channels: ["in_app", "push"],
        });
      }
    }

    logger.info(
      `[AUTO-TRANSITION] Successfully transitioned ${events.length} events to ONGOING`
    );
  } catch (error) {
    logger.error(
      "[AUTO-TRANSITION] Error transitioning events to ONGOING:",
      error
    );
  }
}

/**
 * Auto-transition events from ONGOING to COMPLETED
 */
async function transitionEventsToCompleted() {
  try {
    const now = new Date();

    // Find events that should be completed
    const events = await Event.find({
      status: "ongoing",
      endDateTime: { $lte: now },
    });

    if (events.length === 0) {
      return;
    }

    logger.info(
      `[AUTO-TRANSITION] Found ${events.length} events to transition to COMPLETED`
    );

    for (const event of events) {
      event.status = "completed";
      await event.save();

      logger.info(
        `[AUTO-TRANSITION] Event ${event._id} (${event.title}) transitioned to COMPLETED`
      );

      // Notify organizer
      await Notification.create({
        recipient: event.organizerId,
        title: `Event Completed: ${event.title}`,
        message: `Your event "${event.title}" has ended. You can now generate certificates and view final analytics.`,
        type: "event_status_change",
        relatedEvent: event._id,
        priority: "high",
        channels: ["in_app", "email"],
      });
    }

    logger.info(
      `[AUTO-TRANSITION] Successfully transitioned ${events.length} events to COMPLETED`
    );
  } catch (error) {
    logger.error(
      "[AUTO-TRANSITION] Error transitioning events to COMPLETED:",
      error
    );
  }
}

/**
 * Auto-transition rounds from UPCOMING to ACTIVE
 */
async function transitionRoundsToActive() {
  try {
    const now = new Date();

    // Find events with upcoming rounds that should be active
    const events = await Event.find({
      rounds: {
        $elemMatch: {
          status: "upcoming",
          startDate: { $lte: now },
        },
      },
    });

    if (events.length === 0) {
      return;
    }

    logger.info(
      `[AUTO-TRANSITION] Found events with rounds to transition to ACTIVE`
    );

    for (const event of events) {
      let updated = false;

      for (const round of event.rounds) {
        if (round.status === "upcoming" && new Date(round.startDate) <= now) {
          round.status = "active";
          updated = true;

          logger.info(
            `[AUTO-TRANSITION] Round ${round.number} of event ${event._id} transitioned to ACTIVE`
          );
        }
      }

      if (updated) {
        await event.save();

        // Notify organizer
        await Notification.create({
          recipient: event.organizerId,
          title: `Round Started: ${event.title}`,
          message: `A round in your event "${event.title}" is now active. You can start recording results.`,
          type: "round_status_change",
          relatedEvent: event._id,
          priority: "normal",
          channels: ["in_app"],
        });
      }
    }

    logger.info(
      `[AUTO-TRANSITION] Successfully processed round transitions to ACTIVE`
    );
  } catch (error) {
    logger.error(
      "[AUTO-TRANSITION] Error transitioning rounds to ACTIVE:",
      error
    );
  }
}

/**
 * Auto-transition rounds from ACTIVE to COMPLETED
 */
async function transitionRoundsToCompleted() {
  try {
    const now = new Date();

    // Find events with active rounds that should be completed
    const events = await Event.find({
      rounds: {
        $elemMatch: {
          status: "active",
          endDate: { $lte: now },
        },
      },
    });

    if (events.length === 0) {
      return;
    }

    logger.info(
      `[AUTO-TRANSITION] Found events with rounds to transition to COMPLETED`
    );

    for (const event of events) {
      let updated = false;

      for (const round of event.rounds) {
        if (round.status === "active" && new Date(round.endDate) <= now) {
          round.status = "completed";
          updated = true;

          logger.info(
            `[AUTO-TRANSITION] Round ${round.number} of event ${event._id} transitioned to COMPLETED`
          );
        }
      }

      if (updated) {
        await event.save();

        // Notify organizer
        await Notification.create({
          recipient: event.organizerId,
          title: `Round Completed: ${event.title}`,
          message: `A round in your event "${event.title}" has ended. You can now progress teams to the next round.`,
          type: "round_status_change",
          relatedEvent: event._id,
          priority: "normal",
          channels: ["in_app"],
        });
      }
    }

    logger.info(
      `[AUTO-TRANSITION] Successfully processed round transitions to COMPLETED`
    );
  } catch (error) {
    logger.error(
      "[AUTO-TRANSITION] Error transitioning rounds to COMPLETED:",
      error
    );
  }
}

/**
 * Cancel pending registrations with payment timeout (24h)
 */
async function cancelTimedOutPayments() {
  try {
    const timeout = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    const registrations = await EventRegistration.find({
      status: "pending",
      paymentStatus: "pending",
      registrationDate: { $lte: timeout },
    })
      .populate("event", "title isPaid")
      .populate("user", "fullName email");

    if (registrations.length === 0) {
      return;
    }

    logger.info(
      `[AUTO-TRANSITION] Found ${registrations.length} registrations to cancel (payment timeout)`
    );

    for (const registration of registrations) {
      // Only cancel if event requires payment
      if (!registration.event.isPaid) {
        continue;
      }

      registration.status = "cancelled";
      registration.cancelledAt = new Date();
      registration.cancellationReason = "Payment not completed within 24 hours";
      await registration.save();

      logger.info(
        `[AUTO-TRANSITION] Registration ${registration._id} cancelled due to payment timeout`
      );

      // Notify user
      await Notification.create({
        recipient: registration.user._id,
        title: `Registration Cancelled: ${registration.event.title}`,
        message: `Your registration for "${registration.event.title}" has been cancelled as payment was not completed within 24 hours. Please register again if you wish to participate.`,
        type: "registration_cancelled",
        relatedEvent: registration.event._id,
        priority: "normal",
        channels: ["in_app", "email"],
      });
    }

    logger.info(
      `[AUTO-TRANSITION] Successfully cancelled ${registrations.length} timed-out registrations`
    );
  } catch (error) {
    logger.error(
      "[AUTO-TRANSITION] Error cancelling timed-out payments:",
      error
    );
  }
}

/**
 * Promote waitlisted registrations when spots open
 */
async function promoteWaitlistedRegistrations() {
  try {
    // Find events with waitlisted registrations
    const events = await Event.find({
      maxParticipants: { $exists: true, $gt: 0 },
    });

    for (const event of events) {
      const confirmedCount = await EventRegistration.countDocuments({
        event: event._id,
        status: { $in: ["pending", "confirmed"] },
      });

      const spotsAvailable = event.maxParticipants - confirmedCount;

      if (spotsAvailable <= 0) {
        continue;
      }

      // Get waitlisted registrations (oldest first)
      const waitlisted = await EventRegistration.find({
        event: event._id,
        status: "waitlisted",
      })
        .sort({ registrationDate: 1 })
        .limit(spotsAvailable)
        .populate("user", "fullName email");

      if (waitlisted.length === 0) {
        continue;
      }

      logger.info(
        `[AUTO-TRANSITION] Promoting ${waitlisted.length} waitlisted registrations for event ${event._id}`
      );

      for (const registration of waitlisted) {
        registration.status = event.isPaid ? "pending" : "confirmed";
        await registration.save();

        // Notify user
        await Notification.create({
          recipient: registration.user._id,
          title: `Spot Available: ${event.title}`,
          message: event.isPaid
            ? `A spot has opened up for "${event.title}"! Please complete your payment within 24 hours to confirm your registration.`
            : `A spot has opened up for "${event.title}"! Your registration is now confirmed.`,
          type: "waitlist_promoted",
          relatedEvent: event._id,
          priority: "high",
          channels: ["in_app", "email", "push"],
        });

        logger.info(
          `[AUTO-TRANSITION] Promoted registration ${registration._id} from waitlist`
        );
      }
    }
  } catch (error) {
    logger.error(
      "[AUTO-TRANSITION] Error promoting waitlisted registrations:",
      error
    );
  }
}

/**
 * Run all status transitions
 */
async function runAllTransitions() {
  logger.info("[AUTO-TRANSITION] Starting status transition job");

  await transitionEventsToOngoing();
  await transitionEventsToCompleted();
  await transitionRoundsToActive();
  await transitionRoundsToCompleted();
  await cancelTimedOutPayments();
  await promoteWaitlistedRegistrations();

  logger.info("[AUTO-TRANSITION] Completed status transition job");
}

/**
 * Initialize cron jobs
 * Runs every 5 minutes
 */
function initializeStatusTransitionJobs() {
  // Run every 5 minutes: */5 * * * *
  cron.schedule("*/5 * * * *", async () => {
    try {
      await runAllTransitions();
    } catch (error) {
      logger.error("[AUTO-TRANSITION] Cron job failed:", error);
    }
  });

  logger.info(
    "[AUTO-TRANSITION] Status transition cron jobs initialized (runs every 5 minutes)"
  );

  // Run immediately on startup
  setTimeout(runAllTransitions, 5000);
}

module.exports = {
  initializeStatusTransitionJobs,
  runAllTransitions,
  transitionEventsToOngoing,
  transitionEventsToCompleted,
  transitionRoundsToActive,
  transitionRoundsToCompleted,
  cancelTimedOutPayments,
  promoteWaitlistedRegistrations,
};
