const express = require("express");
const router = express.Router();
const {
  createNotification,
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  sendBulkEventNotification,
  getNotificationStats,
  getPreferences,
  updatePreferences,
  resendFailedNotifications,
  getSentNotifications,
} = require("../controllers/notificationController");
const { protect, authorize } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validation");
const { auditLog } = require("../middleware/audit");

// Protected routes
router.use(protect);

// Get my notifications
router.get("/my", getMyNotifications);

// Get notification preferences
router.get("/preferences", getPreferences);

// Update notification preferences
router.put("/preferences", updatePreferences);

// Mark as read
router.put("/:id/read", markAsRead);

// Mark all as read
router.put("/read-all", markAllAsRead);

// Delete notification
router.delete("/:id", deleteNotification);

// Delete all notifications
router.delete("/", deleteAllNotifications);

// Department organizer+ routes
router.post(
  "/",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  validate(schemas.notification),
  auditLog("create", "notification"),
  createNotification
);

router.post(
  "/bulk/event/:eventId",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  auditLog("bulk_create", "notification"),
  sendBulkEventNotification
);

router.get(
  "/sent",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  getSentNotifications
);

router.post(
  "/resend-failed",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  auditLog("bulk_update", "notification"),
  resendFailedNotifications
);

// Admin routes
router.get("/stats", authorize("admin", "super_admin"), getNotificationStats);

module.exports = router;
