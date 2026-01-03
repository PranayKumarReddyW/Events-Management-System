const Team = require("../models/Team");
const Event = require("../models/Event");
const User = require("../models/User");
const EventRegistration = require("../models/EventRegistration");
const { asyncHandler } = require("../middleware/errorHandler");
const AppError = require("../middleware/errorHandler").AppError;
const logger = require("../utils/logger");

/**
 * @desc    Create a team
 * @route   POST /api/v1/teams
 * @access  Private
 */
exports.createTeam = asyncHandler(async (req, res) => {
  const { name, eventId, description } = req.body;

  // Check if event exists and allows teams
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  if ((event.maxTeamSize || 1) <= 1) {
    throw new AppError("This event does not allow team registration", 400);
  }

  // Check if user already has a team for this event
  const existingTeam = await Team.findOne({
    event: eventId,
    $or: [{ leader: req.user._id }, { members: req.user._id }],
    status: { $ne: "disbanded" },
  });

  if (existingTeam) {
    throw new AppError("You are already part of a team for this event", 400);
  }

  // Create team
  const team = await Team.create({
    name,
    event: eventId,
    leader: req.user._id,
    members: [req.user._id],
    description,
    maxSize: event.maxTeamSize || 1,
    status: "active",
  });

  logger.info(
    `[createTeam] Team created: ${team.name} (${team._id}), inviteCode: ${team.inviteCode}`
  );

  await team.populate([
    { path: "event", select: "title maxTeamSize" },
    { path: "leader", select: "fullName email profilePicture" },
    { path: "members", select: "fullName email profilePicture" },
  ]);

  res.status(201).json({
    success: true,
    data: team,
    message: `Team created successfully! Invite code: ${team.inviteCode}`,
  });
});

/**
 * @desc    Get team by ID
 * @route   GET /api/v1/teams/:id
 * @access  Public
 */
exports.getTeamById = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id)
    .populate("event", "title maxTeamSize")
    .populate("leader", "fullName email profilePicture department")
    .populate("members", "fullName email profilePicture department");

  if (!team) {
    throw new AppError("Team not found", 404);
  }

  res.status(200).json({
    success: true,
    data: team,
  });
});

/**
 * @desc    Debug - List all teams with invite codes
 * @route   GET /api/v1/teams/debug/list
 * @access  Private (for debugging)
 */
exports.debugListTeams = asyncHandler(async (req, res) => {
  const teams = await Team.find({})
    .select("name inviteCode status event members maxSize")
    .populate("event", "title")
    .lean();

  res.status(200).json({
    success: true,
    count: teams.length,
    data: teams.map((t) => ({
      id: t._id,
      name: t.name,
      inviteCode: t.inviteCode,
      status: t.status,
      event: t.event?.title || "Unknown",
      memberCount: t.members?.length || 0,
      maxSize: t.maxSize,
    })),
  });
});

/**
 * @desc    Get teams for an event
 * @route   GET /api/v1/teams/event/:eventId
 * @access  Public
 */
exports.getEventTeams = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { status, search, page = 1, limit = 20 } = req.query;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  const filter = { event: eventId };

  if (status) {
    filter.status = status;
  }

  if (search) {
    filter.name = { $regex: search, $options: "i" };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const teams = await Team.find(filter)
    .populate("leader", "fullName profilePicture")
    .populate("members", "fullName profilePicture")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Team.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: teams,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      limit: parseInt(limit),
    },
  });
});

/**
 * @desc    Get my teams
 * @route   GET /api/v1/teams/my
 * @access  Private
 */
exports.getMyTeams = asyncHandler(async (req, res) => {
  const teams = await Team.find({
    $or: [{ leader: req.user._id }, { members: req.user._id }],
    status: { $ne: "disbanded" },
  })
    .populate("event", "title startDateTime eventType")
    .populate("leader", "fullName email profilePicture")
    .populate("members", "fullName email profilePicture")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: teams,
  });
});

/**
 * @desc    Join team with invite code
 * @route   POST /api/v1/teams/join
 * @access  Private
 */
exports.joinTeamWithCode = asyncHandler(async (req, res) => {
  const { inviteCode } = req.body;

  if (!inviteCode || !inviteCode.trim()) {
    throw new AppError("Please provide an invite code", 400);
  }

  // Normalize invite code to uppercase for case-insensitive matching
  const normalizedCode = inviteCode.trim().toUpperCase();

  logger.info(
    `[joinTeam] User ${req.user._id} attempting to join with code: "${normalizedCode}" (length: ${normalizedCode.length})`
  );

  // Log the exact query being performed
  logger.info(
    `[joinTeam] Querying: Team.findOne({ inviteCode: "${normalizedCode}" })`
  );

  const team = await Team.findOne({ inviteCode: normalizedCode })
    .populate("event", "title maxTeamSize")
    .populate("leader", "fullName email")
    .populate("members", "fullName email profilePicture");

  if (!team) {
    logger.warn(
      `[joinTeam] No team found with invite code: "${normalizedCode}"`
    );

    // Log a sample of available codes for debugging
    const sampleTeams = await Team.find({})
      .select("name inviteCode")
      .limit(5)
      .lean();
    logger.info(
      `[joinTeam] Available codes (sample): ${sampleTeams
        .map((t) => t.inviteCode)
        .join(", ")}`
    );

    throw new AppError(
      "Invalid invite code. Please check the code and try again.",
      404
    );
  }

  logger.info(
    `[joinTeam] Found team: ${team.name} (${team._id}), status: ${
      team.status
    }, members: ${team.members?.length || 0}/${team.maxSize}`
  );

  // Check if team is locked
  if (team.status === "locked") {
    logger.warn(`[joinTeam] Team ${team._id} is locked`);
    throw new AppError(
      "This team is locked and cannot accept new members",
      400
    );
  }

  // Check if team is disbanded
  if (team.status === "disbanded") {
    logger.warn(`[joinTeam] Team ${team._id} is disbanded`);
    throw new AppError("This team has been disbanded", 400);
  }

  // NULL CHECK: Check if members array is populated
  if (!team.members || !Array.isArray(team.members)) {
    logger.error(`[joinTeam] Team ${team._id} has invalid members array`);
    throw new AppError("Team data is corrupted. Please contact support.", 500);
  }

  // Check if user is already a member of this team
  const isAlreadyMember = team.members.some(
    (m) => m?._id?.toString() === req.user._id.toString()
  );
  if (isAlreadyMember) {
    logger.info(
      `[joinTeam] User ${req.user._id} is already a member of team ${team._id}`
    );
    throw new AppError("You are already a member of this team", 400);
  }

  // Check if team is full
  if (team.members.length >= team.maxSize) {
    logger.warn(
      `[joinTeam] Team ${team._id} is full (${team.members.length}/${team.maxSize})`
    );
    throw new AppError(
      `This team is full (${team.members.length}/${team.maxSize} members)`,
      400
    );
  }

  // Check if user is already in another team for this event
  const existingTeam = await Team.findOne({
    event: team.event._id,
    $or: [{ leader: req.user._id }, { members: req.user._id }],
    status: { $ne: "disbanded" },
    _id: { $ne: team._id },
  });

  if (existingTeam) {
    throw new AppError(
      "You are already part of another team for this event",
      400
    );
  }

  // RACE CONDITION FIX: Use atomic operation to add member
  const updatedTeam = await Team.findOneAndUpdate(
    {
      _id: team._id,
      status: "active",
      $expr: { $lt: [{ $size: "$members" }, team.maxSize] },
    },
    { $addToSet: { members: req.user._id } },
    { new: true }
  )
    .populate("event", "title maxTeamSize")
    .populate("leader", "fullName email")
    .populate("members", "fullName email profilePicture");

  // NULL CHECK: Verify atomic update succeeded
  if (!updatedTeam) {
    logger.warn(
      `[joinTeam] Failed to add user to team ${team._id} - team may be full or locked`
    );
    throw new AppError(
      "Failed to join team. Team may be full or no longer available.",
      400
    );
  }

  res.status(200).json({
    success: true,
    data: updatedTeam,
    message: "Successfully joined the team",
  });
});

/**
 * @desc    Add member to team (by leader)
 * @route   POST /api/v1/teams/:id/members
 * @access  Private
 */
exports.addTeamMember = asyncHandler(async (req, res) => {
  const { userId, email } = req.body;

  const team = await Team.findById(req.params.id)
    .populate("event")
    .populate("members", "fullName email profilePicture");

  if (!team) {
    throw new AppError("Team not found", 404);
  }

  // Check if requester is team leader
  if (team.leader.toString() !== req.user._id.toString()) {
    throw new AppError("Only team leader can add members", 403);
  }

  if (team.status === "locked") {
    throw new AppError("Team is locked and cannot accept new members", 400);
  }

  // NULL CHECK: Check if members array is valid
  if (!team.members || !Array.isArray(team.members)) {
    throw new AppError("Team data is corrupted. Please contact support.", 500);
  }

  // Check if team is full
  if (team.members.length >= team.maxSize) {
    throw new AppError("Team is full", 400);
  }

  // Find user by email or userId
  let user;
  if (email) {
    user = await User.findOne({ email: email.trim().toLowerCase() });
  } else if (userId) {
    user = await User.findById(userId);
  }

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const userIdToAdd = user._id.toString();

  // Check if user is already a member
  if (team.members.some((m) => m?._id?.toString() === userIdToAdd)) {
    throw new AppError("User is already a member of this team", 400);
  }

  // Check if user is in another team for this event
  const existingTeam = await Team.findOne({
    event: team.event._id,
    $or: [{ leader: userIdToAdd }, { members: userIdToAdd }],
    status: { $ne: "disbanded" },
    _id: { $ne: team._id },
  });

  if (existingTeam) {
    throw new AppError(
      "User is already part of another team for this event",
      400
    );
  }

  // RACE CONDITION FIX: Use atomic operation to add member
  const updatedTeam = await Team.findOneAndUpdate(
    {
      _id: team._id,
      status: { $ne: "locked" },
      $expr: { $lt: [{ $size: "$members" }, team.maxSize] },
    },
    { $addToSet: { members: userIdToAdd } },
    { new: true }
  ).populate("members", "fullName email profilePicture");

  // NULL CHECK: Verify atomic update succeeded
  if (!updatedTeam) {
    throw new AppError(
      "Failed to add member. Team may be full or locked.",
      400
    );
  }

  res.status(200).json({
    success: true,
    data: updatedTeam,
    message: "Member added successfully",
  });
});

/**
 * @desc    Remove member from team
 * @route   DELETE /api/v1/teams/:id/members/:userId
 * @access  Private
 */
exports.removeTeamMember = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // NULL CHECK: Validate userId parameter
  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  const team = await Team.findById(req.params.id).populate("event");

  if (!team) {
    throw new AppError("Team not found", 404);
  }

  // Check if requester is team leader or the user themselves
  if (
    team.leader.toString() !== req.user._id.toString() &&
    userId !== req.user._id.toString()
  ) {
    throw new AppError("Not authorized to remove this member", 403);
  }

  // Cannot remove leader
  if (team.leader.toString() === userId) {
    throw new AppError(
      "Team leader cannot be removed. Transfer leadership or disband team.",
      400
    );
  }

  if (team.status === "locked") {
    throw new AppError("Team is locked and members cannot be removed", 400);
  }

  // NULL CHECK: Check if members array is valid
  if (!team.members || !Array.isArray(team.members)) {
    throw new AppError("Team data is corrupted. Please contact support.", 500);
  }

  // RACE CONDITION FIX: Use atomic operation to remove member
  const updatedTeam = await Team.findOneAndUpdate(
    {
      _id: team._id,
      status: { $ne: "locked" },
      members: userId,
    },
    { $pull: { members: userId } },
    { new: true }
  ).populate("members", "fullName email profilePicture");

  // NULL CHECK: Verify atomic update succeeded
  if (!updatedTeam) {
    throw new AppError(
      "Failed to remove member. Member may not exist in team.",
      400
    );
  }

  res.status(200).json({
    success: true,
    data: updatedTeam,
    message: "Member removed successfully",
  });
});

/**
 * @desc    Transfer team leadership
 * @route   PUT /api/v1/teams/:id/transfer-leadership
 * @access  Private
 */
exports.transferLeadership = asyncHandler(async (req, res) => {
  const { newLeaderId } = req.body;

  const team = await Team.findById(req.params.id).populate(
    "members",
    "fullName email"
  );

  if (!team) {
    throw new AppError("Team not found", 404);
  }

  // Check if requester is team leader
  if (team.leader.toString() !== req.user._id.toString()) {
    throw new AppError("Only team leader can transfer leadership", 403);
  }

  // Check if new leader is a member
  if (!team.members.some((m) => m._id.toString() === newLeaderId)) {
    throw new AppError("New leader must be a team member", 400);
  }

  team.leader = newLeaderId;
  await team.save();

  await team.populate([
    { path: "leader", select: "fullName email profilePicture" },
    { path: "members", select: "fullName email profilePicture" },
  ]);

  res.status(200).json({
    success: true,
    data: team,
    message: "Leadership transferred successfully",
  });
});

/**
 * @desc    Lock team (no more changes allowed)
 * @route   PUT /api/v1/teams/:id/lock
 * @access  Private
 */
exports.lockTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id).populate("event");

  if (!team) {
    throw new AppError("Team not found", 404);
  }

  // Check if requester is team leader
  if (team.leader.toString() !== req.user._id.toString()) {
    throw new AppError("Only team leader can lock the team", 403);
  }

  if (team.status === "locked") {
    throw new AppError("Team is already locked", 400);
  }

  // Check minimum team size
  // Note: team.members array already includes the leader (see Team model pre-save hook)
  const currentTeamSize = team.members.length;
  if (team.event.minTeamSize && currentTeamSize < team.event.minTeamSize) {
    throw new AppError(
      `Team must have at least ${team.event.minTeamSize} members (including leader). Current: ${currentTeamSize}`,
      400
    );
  }

  team.status = "locked";
  await team.save();

  res.status(200).json({
    success: true,
    data: team,
    message: "Team locked successfully",
  });
});

/**
 * @desc    Unlock team
 * @route   PUT /api/v1/teams/:id/unlock
 * @access  Private
 */
exports.unlockTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);

  if (!team) {
    throw new AppError("Team not found", 404);
  }

  // Check if requester is team leader
  if (team.leader.toString() !== req.user._id.toString()) {
    throw new AppError("Only team leader can unlock the team", 403);
  }

  if (team.status !== "locked") {
    throw new AppError("Team is not locked", 400);
  }

  // SECURITY: Prevent unlocking if team has any registrations
  const registrationCount = await EventRegistration.countDocuments({
    team: team._id,
    status: { $in: ["pending", "confirmed", "waitlisted"] },
  });

  if (registrationCount > 0) {
    throw new AppError(
      "Cannot unlock team with existing registrations. Team members must cancel their registrations first.",
      400
    );
  }

  team.status = "active";
  await team.save();

  res.status(200).json({
    success: true,
    data: team,
    message: "Team unlocked successfully",
  });
});

/**
 * @desc    Disband team
 * @route   DELETE /api/v1/teams/:id
 * @access  Private
 */
exports.disbandTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);

  if (!team) {
    throw new AppError("Team not found", 404);
  }

  // Check if requester is team leader
  if (team.leader.toString() !== req.user._id.toString()) {
    throw new AppError("Only team leader can disband the team", 403);
  }

  // Check if team has any confirmed registrations
  const registrations = await EventRegistration.find({
    team: team._id,
    status: "confirmed",
  });

  if (registrations.length > 0) {
    throw new AppError("Cannot disband team with confirmed registrations", 400);
  }

  team.status = "disbanded";
  await team.save();

  res.status(200).json({
    success: true,
    message: "Team disbanded successfully",
  });
});

/**
 * @desc    Update team
 * @route   PUT /api/v1/teams/:id
 * @access  Private
 */
exports.updateTeam = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const team = await Team.findById(req.params.id);

  if (!team) {
    throw new AppError("Team not found", 404);
  }

  // Check if requester is team leader
  if (team.leader.toString() !== req.user._id.toString()) {
    throw new AppError("Only team leader can update team details", 403);
  }

  if (team.status === "locked") {
    throw new AppError("Cannot update locked team", 400);
  }

  if (name) team.name = name;
  if (description) team.description = description;

  await team.save();

  await team.populate([
    { path: "event", select: "title maxTeamSize" },
    { path: "leader", select: "fullName email profilePicture" },
    { path: "members", select: "fullName email profilePicture" },
  ]);

  res.status(200).json({
    success: true,
    data: team,
    message: "Team updated successfully",
  });
});

/**
 * @desc    Leave team
 * @route   POST /api/v1/teams/:id/leave
 * @access  Private
 */
exports.leaveTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);

  if (!team) {
    throw new AppError("Team not found", 404);
  }

  // Check if user is a member
  if (!team.members.some((m) => m.toString() === req.user._id.toString())) {
    throw new AppError("You are not a member of this team", 400);
  }

  // Team leader cannot leave, must transfer leadership first
  if (team.leader.toString() === req.user._id.toString()) {
    throw new AppError(
      "Team leader cannot leave. Transfer leadership first.",
      400
    );
  }

  if (team.status === "locked") {
    throw new AppError("Cannot leave locked team", 400);
  }

  // Remove user from members
  team.members = team.members.filter(
    (m) => m.toString() !== req.user._id.toString()
  );
  await team.save();

  res.status(200).json({
    success: true,
    message: "Left team successfully",
  });
});

/**
 * @desc    Get event teams with full member details (for organizers/public view)
 * @route   GET /api/v1/teams/event/:eventId/details
 * @access  Public
 */
exports.getEventTeamsWithDetails = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const {
    status,
    round,
    eliminated,
    sortBy = "rank",
    order = "asc",
  } = req.query;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  const filter = { event: eventId };

  if (status) {
    filter.status = status;
  }

  if (round) {
    filter.round = parseInt(round);
  }

  if (eliminated !== undefined) {
    filter.eliminated = eliminated === "true";
  }

  // Build sort options
  const sortOptions = {};
  const sortDirection = order === "desc" ? -1 : 1;

  if (sortBy === "rank") {
    sortOptions.rank = sortDirection;
    sortOptions.score = -1; // Secondary sort by score (higher first)
  } else if (sortBy === "score") {
    sortOptions.score = sortDirection;
  } else if (sortBy === "round") {
    sortOptions.round = sortDirection;
  } else {
    sortOptions.createdAt = sortDirection;
  }

  const teams = await Team.find(filter)
    .populate({
      path: "leader",
      select: "fullName email phone profilePicture department",
    })
    .populate({
      path: "members",
      select: "fullName email phone profilePicture department",
    })
    .populate({
      path: "event",
      select: "title eventType maxTeamSize minTeamSize currentRound rounds",
    })
    .sort(sortOptions);

  // Get registration count for each team
  const teamsWithRegistrations = await Promise.all(
    teams.map(async (team) => {
      const registrationCount = await EventRegistration.countDocuments({
        team: team._id,
        status: { $in: ["confirmed", "pending", "waitlisted"] },
      });

      return {
        ...team.toObject(),
        registrationCount,
        memberDetails: team.members.map((member) => ({
          _id: member._id,
          fullName: member.fullName,
          email: member.email,
          phone: member.phone,
          profilePicture: member.profilePicture,
          department: member.department,
          isLeader: member._id.toString() === team.leader._id.toString(),
        })),
      };
    })
  );

  res.status(200).json({
    success: true,
    data: {
      teams: teamsWithRegistrations,
      totalTeams: teams.length,
      activeTeams: teams.filter((t) => !t.eliminated).length,
      eliminatedTeams: teams.filter((t) => t.eliminated).length,
      currentRound: event.currentRound || 0,
      totalRounds: event.rounds?.length || 0,
    },
  });
});

/**
 * @desc    Advance teams to next round
 * @route   POST /api/v1/teams/event/:eventId/advance-round
 * @access  Private (Organizer only)
 */
exports.advanceTeamsToNextRound = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { teamIds, eliminate } = req.body; // teamIds to advance, eliminate flag

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check if user is organizer
  const isOrganizer =
    event.organizerId.toString() === req.user._id.toString() ||
    event.organizers?.some((org) => org.toString() === req.user._id.toString());

  if (!isOrganizer && req.user.role !== "admin") {
    throw new AppError("Only event organizers can manage rounds", 403);
  }

  if (!teamIds || !Array.isArray(teamIds) || teamIds.length === 0) {
    throw new AppError("Please provide team IDs", 400);
  }

  const teams = await Team.find({
    _id: { $in: teamIds },
    event: eventId,
  });

  if (teams.length !== teamIds.length) {
    throw new AppError("Some teams not found", 404);
  }

  // Update teams
  const updates = await Promise.all(
    teams.map(async (team) => {
      if (eliminate) {
        team.eliminated = true;
      } else {
        team.round = team.round + 1;
      }
      await team.save();
      return team;
    })
  );

  logger.info(
    `[advanceRound] ${eliminate ? "Eliminated" : "Advanced"} ${
      updates.length
    } teams for event ${eventId}`
  );

  res.status(200).json({
    success: true,
    message: eliminate
      ? `Eliminated ${updates.length} teams`
      : `Advanced ${updates.length} teams to next round`,
    data: updates,
  });
});

/**
 * @desc    Update team scores and ranks
 * @route   POST /api/v1/teams/event/:eventId/update-scores
 * @access  Private (Organizer only)
 */
exports.updateTeamScores = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { scores } = req.body; // Array of { teamId, score, rank }

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check if user is organizer
  const isOrganizer =
    event.organizerId.toString() === req.user._id.toString() ||
    event.organizers?.some((org) => org.toString() === req.user._id.toString());

  if (!isOrganizer && req.user.role !== "admin") {
    throw new AppError("Only event organizers can update scores", 403);
  }

  if (!scores || !Array.isArray(scores) || scores.length === 0) {
    throw new AppError("Please provide scores array", 400);
  }

  // Update teams
  const updates = await Promise.all(
    scores.map(async (scoreData) => {
      const team = await Team.findOne({
        _id: scoreData.teamId,
        event: eventId,
      });

      if (!team) {
        throw new AppError(`Team ${scoreData.teamId} not found`, 404);
      }

      if (scoreData.score !== undefined) {
        team.score = scoreData.score;
      }

      if (scoreData.rank !== undefined) {
        team.rank = scoreData.rank;
      }

      await team.save();
      return team;
    })
  );

  logger.info(
    `[updateScores] Updated ${updates.length} team scores for event ${eventId}`
  );

  res.status(200).json({
    success: true,
    message: `Updated scores for ${updates.length} teams`,
    data: updates,
  });
});

/**
 * @desc    Update event current round
 * @route   PUT /api/v1/teams/event/:eventId/current-round
 * @access  Private (Organizer only)
 */
exports.updateEventCurrentRound = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { roundNumber } = req.body;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check if user is organizer
  const isOrganizer =
    event.organizerId.toString() === req.user._id.toString() ||
    event.organizers?.some((org) => org.toString() === req.user._id.toString());

  if (!isOrganizer && req.user.role !== "admin") {
    throw new AppError("Only event organizers can update rounds", 403);
  }

  if (roundNumber === undefined || roundNumber < 0) {
    throw new AppError("Please provide valid round number", 400);
  }

  event.currentRound = roundNumber;
  await event.save();

  logger.info(`[updateRound] Event ${eventId} moved to round ${roundNumber}`);

  res.status(200).json({
    success: true,
    message: `Event moved to round ${roundNumber}`,
    data: { currentRound: event.currentRound },
  });
});
