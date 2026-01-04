const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");
const strictRoundController = require("../controllers/strictRoundController");
const roundController = require("../controllers/roundController");
const resultController = require("../controllers/resultController");
const registrationController = require("../controllers/registrationController");
const analyticsController = require("../controllers/analyticsController");
const {
  authenticate,
  authorize,
  checkPermission,
  optionalAuth,
} = require("../middleware/auth");
const { validateSchema, schemas } = require("../middleware/validation");
const {
  auditCreate,
  auditUpdate,
  auditDelete,
  auditRead,
} = require("../middleware/audit");
const { uploadMultiple, uploadSingle } = require("../middleware/upload");

// Public routes
router.get("/", optionalAuth, eventController.getAllEvents);
router.get("/:id", optionalAuth, auditRead("event"), eventController.getEvent);

// Protected routes - require authentication
router.use(authenticate);

// Get my events - MUST come before other protected /:id routes
router.get("/my/events", eventController.getMyEvents);

// Create event - department organizers, faculty and above
router.post(
  "/",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  uploadSingle("bannerImage"),
  validateSchema(schemas.eventCreate),
  auditCreate("event"),
  eventController.createEvent
);

// Update event - organizers can update their own, admins can update any
router.put(
  "/:id",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  uploadSingle("bannerImage"),
  auditUpdate("event"),
  eventController.updateEvent
);

// Delete event
router.delete("/:id", auditDelete("event"), eventController.deleteEvent);

// Publish event
router.post("/:id/publish", eventController.publishEvent);

// Round management routes - STRICT VALIDATION
router.post(
  "/:eventId/rounds",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  strictRoundController.createRound
);

router.put(
  "/:eventId/rounds/:roundId",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  strictRoundController.updateRound
);

router.delete(
  "/:eventId/rounds/:roundId",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  strictRoundController.deleteRound
);

router.post(
  "/:eventId/rounds/:roundNumber/progress-teams",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  strictRoundController.progressTeams
);

router.get(
  "/:eventId/rounds/:roundNumber/participants",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  roundController.getRoundParticipants
);

router.get(
  "/:eventId/rounds/stats",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  roundController.getRoundStats
);

// Result management routes
router.post(
  "/:eventId/results",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  resultController.addResults
);

router.get("/:eventId/results", optionalAuth, resultController.getResults);

router.post(
  "/:eventId/results/publish",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  resultController.publishResults
);

router.delete(
  "/:eventId/results/:resultId",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  resultController.deleteResult
);

// Additional event endpoints to be implemented:
router.get(
  "/:id/registrations",
  checkPermission("event.read"),
  registrationController.getEventRegistrations
);
router.get(
  "/:id/analytics",
  checkPermission("analytics.read"),
  analyticsController.getEventAnalytics
);
router.post(
  "/:id/duplicate",
  checkPermission("event.create"),
  eventController.duplicateEvent
);
router.post(
  "/:id/cancel",
  checkPermission("event.update"),
  eventController.cancelEvent
);

module.exports = router;
