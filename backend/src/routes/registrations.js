const express = require("express");
const router = express.Router();
const {
  registerForEvent,
  getMyRegistrations,
  getRegistrationById,
  getEventRegistrations,
  cancelRegistration,
  updateRegistrationStatus,
  checkInParticipant,
  bulkCheckIn,
  exportRegistrations,
} = require("../controllers/registrationController");
const { protect, authorize } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validation");
const { auditLog } = require("../middleware/audit");

// Public routes (none for registrations)

// Protected routes (authenticated users)
router.use(protect);

// Get my registrations
router.get("/my", getMyRegistrations);

// Register for an event
router.post(
  "/",
  validate(schemas.registration),
  auditLog("create", "registration"),
  registerForEvent
);

// Get registration by ID
router.get("/:id", getRegistrationById);

// Cancel registration
router.put(
  "/:id/cancel",
  auditLog("update", "registration"),
  cancelRegistration
);

// Organizer+ routes
router.get(
  "/event/:eventId",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  getEventRegistrations
);

router.put(
  "/:id/status",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  auditLog("update", "registration"),
  updateRegistrationStatus
);

router.post(
  "/:id/checkin",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  auditLog("update", "registration"),
  checkInParticipant
);

router.post(
  "/bulk-checkin",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  auditLog("bulk_update", "registration"),
  bulkCheckIn
);

router.get(
  "/event/:eventId/export",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  exportRegistrations
);

module.exports = router;
