const express = require("express");
const router = express.Router();
const {
  createTeam,
  getTeamById,
  getEventTeams,
  getEventTeamsWithDetails,
  getMyTeams,
  joinTeamWithCode,
  addTeamMember,
  removeTeamMember,
  transferLeadership,
  lockTeam,
  unlockTeam,
  disbandTeam,
  updateTeam,
  leaveTeam,
  debugListTeams,
  advanceTeamsToNextRound,
  updateTeamScores,
  updateEventCurrentRound,
} = require("../controllers/teamController");
const { protect } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validation");
const { auditLog } = require("../middleware/audit");

// Public routes
router.get("/event/:eventId", getEventTeams);
router.get("/event/:eventId/details", getEventTeamsWithDetails);

// Protected routes
router.use(protect);

// Debug route - list all teams (must be before /my route)
router.get("/debug/list", debugListTeams);

// Get my teams (must be before /:id route)
router.get("/my", getMyTeams);

// Create team
router.post(
  "/",
  validate(schemas.team),
  auditLog("create", "team"),
  createTeam
);

// Get team by ID (must be after /my route)
router.get("/:id", getTeamById);

// Join team with invite code
router.post("/join", auditLog("update", "team"), joinTeamWithCode);

// Leave team
router.post("/:id/leave", auditLog("update", "team"), leaveTeam);

// Update team (leader only)
router.put("/:id", auditLog("update", "team"), updateTeam);

// Add team member (leader only)
router.post("/:id/members", auditLog("update", "team"), addTeamMember);

// Remove team member (leader or self)
router.delete(
  "/:id/members/:userId",
  auditLog("update", "team"),
  removeTeamMember
);

// Transfer leadership
router.put(
  "/:id/transfer-leadership",
  auditLog("update", "team"),
  transferLeadership
);

// Lock/unlock team
router.put("/:id/lock", auditLog("update", "team"), lockTeam);

router.put("/:id/unlock", auditLog("update", "team"), unlockTeam);

// Disband team (leader only)
router.delete("/:id", auditLog("delete", "team"), disbandTeam);

// Round management (organizer only)
router.post(
  "/event/:eventId/advance-round",
  auditLog("update", "team"),
  advanceTeamsToNextRound
);

router.post(
  "/event/:eventId/update-scores",
  auditLog("update", "team"),
  updateTeamScores
);

router.put(
  "/event/:eventId/current-round",
  auditLog("update", "event"),
  updateEventCurrentRound
);

module.exports = router;
