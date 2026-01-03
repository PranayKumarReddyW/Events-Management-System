const express = require("express");
const router = express.Router();
const {
  trackEvent,
  getEventAnalytics,
  getDashboardAnalytics,
  getUserAnalytics,
  compareEvents,
  getPerformanceMetrics,
  exportAnalytics,
} = require("../controllers/analyticsController");
const { protect, authorize } = require("../middleware/auth");
const { auditLog } = require("../middleware/audit");

// Protected routes
router.use(protect);

// Track custom event
router.post("/track", trackEvent);

// Organizer+ routes
router.get(
  "/events/:eventId",
  authorize("organizer", "admin", "superadmin"),
  getEventAnalytics
);

router.get(
  "/compare",
  authorize("organizer", "admin", "superadmin"),
  compareEvents
);

router.get(
  "/events/:eventId/export",
  authorize("organizer", "admin", "superadmin"),
  exportAnalytics
);

// General analytics export (matches controller contract)
router.get("/export", authorize("admin", "superadmin"), exportAnalytics);

// Admin routes
router.get(
  "/dashboard",
  authorize("admin", "superadmin"),
  getDashboardAnalytics
);

router.get("/users", authorize("admin", "superadmin"), getUserAnalytics);

router.get(
  "/performance",
  authorize("admin", "superadmin"),
  getPerformanceMetrics
);

module.exports = router;
