const express = require("express");
const router = express.Router();

// Import all route modules
const authRoutes = require("./auth");
const eventRoutes = require("./events");
const registrationRoutes = require("./registrations");
const teamRoutes = require("./teams");
const paymentRoutes = require("./payments");
const certificateRoutes = require("./certificates");
const feedbackRoutes = require("./feedback");
const analyticsRoutes = require("./analytics");
const notificationRoutes = require("./notifications");
const attendanceRoutes = require("./attendance");
const adminRoutes = require("./admin");

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// API info endpoint
router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Event Management System API",
    version: "1.0.0",
    documentation: "/api/docs",
    endpoints: {
      auth: "/api/auth",
      events: "/api/events",
      registrations: "/api/registrations",
      teams: "/api/teams",
      payments: "/api/payments",
      certificates: "/api/certificates",
      feedback: "/api/feedback",
      analytics: "/api/analytics",
      notifications: "/api/notifications",
      attendance: "/api/attendance",
      admin: "/api/admin",
    },
  });
});

// Mount routes
router.use("/auth", authRoutes);
router.use("/events", eventRoutes);
router.use("/registrations", registrationRoutes);
router.use("/teams", teamRoutes);
router.use("/payments", paymentRoutes);
router.use("/certificates", certificateRoutes);
router.use("/feedback", feedbackRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/notifications", notificationRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/admin", adminRoutes);

// 404 handler for undefined routes
router.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

module.exports = router;
