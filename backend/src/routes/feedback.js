const express = require("express");
const router = express.Router();
const {
  submitFeedback,
  getFeedbackById,
  getEventFeedback,
  getMyFeedback,
  updateFeedback,
  deleteFeedback,
  updateFeedbackStatus,
  getPublicEventFeedback,
  getFeedbackSummary,
  exportFeedback,
} = require("../controllers/feedbackController");
const { protect, authorize } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validation");
const { auditLog } = require("../middleware/audit");

// Public routes
router.get("/event/:eventId/public", getPublicEventFeedback);

// Protected routes
router.use(protect);

// Submit feedback
router.post(
  "/",
  validate(schemas.feedback),
  auditLog("create", "feedback"),
  submitFeedback
);

// Get my feedback
router.get("/my", getMyFeedback);

// Get feedback by ID
router.get("/:id", getFeedbackById);

// Update feedback (own)
router.put("/:id", auditLog("update", "feedback"), updateFeedback);

// Delete feedback (own or admin)
router.delete("/:id", auditLog("delete", "feedback"), deleteFeedback);

// Department organizer+ routes
router.get(
  "/event/:eventId",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  getEventFeedback
);

router.get(
  "/event/:eventId/summary",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  getFeedbackSummary
);

router.get(
  "/event/:eventId/export",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  exportFeedback
);

router.put(
  "/:id/status",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  auditLog("update", "feedback"),
  updateFeedbackStatus
);

module.exports = router;
