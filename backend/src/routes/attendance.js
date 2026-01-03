const express = require("express");
const router = express.Router();
const {
  checkIn,
  checkOut,
  selfCheckIn,
  generateEventQRCode,
  getEventAttendance,
  getMyAttendance,
  updateAttendance,
  deleteAttendance,
  getAttendanceReport,
  bulkCheckIn,
  getAttendanceStats,
} = require("../controllers/attendanceController");
const { protect, authorize } = require("../middleware/auth");
const { auditLog } = require("../middleware/audit");

// Protected routes
router.use(protect);

// Get my attendance
router.get("/my", getMyAttendance);

// Self check-in (via QR scan)
router.post("/self-checkin", auditLog("create", "attendance"), selfCheckIn);

// Department organizer+ routes
router.post(
  "/checkin",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  auditLog("create", "attendance"),
  checkIn
);

router.post(
  "/checkout",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  auditLog("update", "attendance"),
  checkOut
);

router.post(
  "/bulk-checkin",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  auditLog("bulk_create", "attendance"),
  bulkCheckIn
);

router.get(
  "/event/:eventId",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  getEventAttendance
);

router.get(
  "/event/:eventId/qrcode",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  generateEventQRCode
);

router.get(
  "/event/:eventId/report",
  authorize("organizer", "admin", "superadmin"),
  getAttendanceReport
);

router.put(
  "/:id",
  authorize("organizer", "admin", "superadmin"),
  auditLog("update", "attendance"),
  updateAttendance
);

// Admin routes
router.delete(
  "/:id",
  authorize("admin", "superadmin"),
  auditLog("delete", "attendance"),
  deleteAttendance
);

router.get("/stats", authorize("admin", "superadmin"), getAttendanceStats);

module.exports = router;
