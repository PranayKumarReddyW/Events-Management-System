const Attendance = require("../models/Attendance");
const Event = require("../models/Event");
const EventRegistration = require("../models/EventRegistration");
const User = require("../models/User");
const { asyncHandler } = require("../middleware/errorHandler");
const AppError = require("../middleware/errorHandler").AppError;
const logger = require("../utils/logger");
const QRCode = require("qrcode");

/**
 * @desc    Mark attendance (Check-in)
 * @route   POST /api/v1/attendance/checkin
 * @access  Private (Organizer+)
 */
exports.checkIn = asyncHandler(async (req, res) => {
  const {
    eventId,
    userId,
    method = "manual",
    location,
    deviceInfo,
    qrCode,
  } = req.body;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check authorization
  if (
    (event.organizerId || event.organizer).toString() !==
      req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to mark attendance", 403);
  }

  // EDGE CASE: Check-in time window validation (30 min before to 1 hour after start)
  const now = new Date();
  const allowCheckInFrom = new Date(
    event.startDateTime.getTime() - 30 * 60 * 1000
  );
  const allowCheckInUntil = new Date(
    event.startDateTime.getTime() + 60 * 60 * 1000
  );

  if (now < allowCheckInFrom) {
    const timeUntilOpen = Math.ceil((allowCheckInFrom - now) / (1000 * 60));
    throw new AppError(
      `Check-in opens ${timeUntilOpen} minutes before event start at ${allowCheckInFrom.toLocaleString()}. Event starts at ${event.startDateTime.toLocaleString()}`,
      400
    );
  }

  if (now > allowCheckInUntil) {
    throw new AppError(
      `Check-in closed at ${allowCheckInUntil.toLocaleString()} (1 hour after event start). Please contact the organizer for manual check-in.`,
      400
    );
  }

  // Check if user is registered
  const registration = await EventRegistration.findOne({
    event: eventId,
    user: userId,
    status: "confirmed",
  });

  if (!registration) {
    throw new AppError("User is not registered for this event", 400);
  }

  // EDGE CASE: Check if already checked in with detailed message
  const existingAttendance = await Attendance.findOne({
    event: eventId,
    user: userId,
  });

  if (existingAttendance) {
    if (!existingAttendance.checkOutTime) {
      throw new AppError(
        `User already checked in at ${existingAttendance.checkInTime.toLocaleString()}`,
        400
      );
    }
  }

  // RACE CONDITION FIX: Update registration check-in atomically
  const updateResult = await EventRegistration.updateOne(
    {
      _id: registration._id,
      checkInTime: null,
    },
    {
      $set: { checkInTime: new Date() },
    }
  );

  if (updateResult.modifiedCount === 0) {
    throw new AppError("User is already checked in", 400);
  }

  // Create attendance record
  const attendance = await Attendance.create({
    event: eventId,
    user: userId,
    checkInTime: new Date(),
    checkInMethod: method,
    location,
    deviceInfo,
    markedBy: req.user._id,
  });

  // Registration already updated atomically above
  // No need to update again

  await attendance.populate([
    { path: "event", select: "title startDateTime" },
    { path: "user", select: "fullName email profilePicture" },
    { path: "markedBy", select: "fullName" },
  ]);

  res.status(201).json({
    success: true,
    data: attendance,
    message: "Check-in successful",
  });
});

/**
 * @desc    Mark check-out
 * @route   POST /api/v1/attendance/checkout
 * @access  Private (Organizer+)
 */
exports.checkOut = asyncHandler(async (req, res) => {
  const { eventId, userId } = req.body;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check authorization
  if (
    (event.organizerId || event.organizer).toString() !==
      req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to mark attendance", 403);
  }

  // Find active attendance record
  const attendance = await Attendance.findOne({
    event: eventId,
    user: userId,
    checkOutTime: null,
  });

  if (!attendance) {
    throw new AppError("No active check-in found", 400);
  }

  attendance.checkOutTime = new Date();

  // Calculate duration in minutes
  const duration = Math.round(
    (attendance.checkOutTime - attendance.checkInTime) / (1000 * 60)
  );
  attendance.duration = duration;

  await attendance.save();

  await attendance.populate([
    { path: "event", select: "title" },
    { path: "user", select: "fullName email" },
  ]);

  res.status(200).json({
    success: true,
    data: attendance,
    message: "Check-out successful",
  });
});

/**
 * @desc    Self check-in with QR code
 * @route   POST /api/v1/attendance/self-checkin
 * @access  Private
 */
exports.selfCheckIn = asyncHandler(async (req, res) => {
  const { qrData, location } = req.body;

  // Parse QR code data (should contain eventId)
  let eventId;
  try {
    const parsedData = JSON.parse(qrData);
    eventId = parsedData.eventId;
  } catch (error) {
    throw new AppError("Invalid QR code", 400);
  }

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check if user is registered
  const registration = await EventRegistration.findOne({
    event: eventId,
    user: req.user._id,
    status: "confirmed",
  });

  if (!registration) {
    throw new AppError("You are not registered for this event", 400);
  }

  // Check if already checked in
  const existingAttendance = await Attendance.findOne({
    event: eventId,
    user: req.user._id,
  });

  if (existingAttendance) {
    if (!existingAttendance.checkOutTime) {
      throw new AppError("You are already checked in", 400);
    }
  }

  // RACE CONDITION FIX: Update registration check-in atomically
  const updateResult = await EventRegistration.updateOne(
    {
      _id: registration._id,
      checkInTime: null,
    },
    {
      $set: { checkInTime: new Date() },
    }
  );

  if (updateResult.modifiedCount === 0) {
    throw new AppError("You are already checked in", 400);
  }

  // Create attendance record
  const attendance = await Attendance.create({
    event: eventId,
    user: req.user._id,
    checkInTime: new Date(),
    checkInMethod: "qr",
    location,
    markedBy: req.user._id,
  });

  // Registration already updated atomically above

  await attendance.populate([
    { path: "event", select: "title startDateTime venue" },
    { path: "user", select: "fullName email" },
  ]);

  res.status(201).json({
    success: true,
    data: attendance,
    message: "Check-in successful",
  });
});

/**
 * @desc    Generate QR code for event check-in
 * @route   GET /api/v1/attendance/qr/:eventId
 * @access  Private (Organizer+)
 */
exports.generateEventQRCode = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check authorization
  if (
    (event.organizerId || event.organizer).toString() !==
      req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to generate QR code", 403);
  }

  // Create QR code data
  const qrData = JSON.stringify({
    eventId: event._id,
    eventTitle: event.title,
    timestamp: new Date().getTime(),
  });

  // Generate QR code
  const qrCodeImage = await QRCode.toDataURL(qrData);

  res.status(200).json({
    success: true,
    data: {
      qrCode: qrCodeImage,
      qrData,
      event: {
        id: event._id,
        title: event.title,
      },
    },
  });
});

/**
 * @desc    Get event attendance list
 * @route   GET /api/v1/attendance/event/:eventId
 * @access  Private (Organizer+)
 */
exports.getEventAttendance = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { page = 1, limit = 50 } = req.query;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check authorization
  if (
    (event.organizerId || event.organizer).toString() !==
      req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to view attendance", 403);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const attendance = await Attendance.find({ event: eventId })
    .populate("user", "fullName email phone department rollNumber")
    .populate("markedBy", "fullName")
    .sort({ checkInTime: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Attendance.countDocuments({ event: eventId });

  // Get statistics
  const stats = await Attendance.aggregate([
    { $match: { event: event._id } },
    {
      $group: {
        _id: null,
        totalCheckIns: { $sum: 1 },
        activeCheckIns: {
          $sum: { $cond: [{ $eq: ["$checkOutTime", null] }, 1, 0] },
        },
        completedSessions: {
          $sum: { $cond: ["$checkOutTime", 1, 0] },
        },
        avgDuration: { $avg: "$duration" },
      },
    },
  ]);

  // Check-in methods distribution
  const methodStats = await Attendance.aggregate([
    { $match: { event: event._id } },
    {
      $group: {
        _id: "$checkInMethod",
        count: { $sum: 1 },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: attendance,
    stats: stats[0] || {},
    methodStats,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      limit: parseInt(limit),
    },
  });
});

/**
 * @desc    Get my attendance history
 * @route   GET /api/v1/attendance/my
 * @access  Private
 */
exports.getMyAttendance = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const attendance = await Attendance.find({ user: req.user._id })
    .populate("event", "title startDateTime endDateTime eventType banner")
    .sort({ checkInTime: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Attendance.countDocuments({ user: req.user._id });

  // Get user statistics
  const stats = await Attendance.aggregate([
    { $match: { user: req.user._id } },
    {
      $group: {
        _id: null,
        totalEvents: { $sum: 1 },
        totalDuration: { $sum: "$duration" },
        avgDuration: { $avg: "$duration" },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: attendance,
    stats: stats[0] || {},
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      limit: parseInt(limit),
    },
  });
});

/**
 * @desc    Update attendance record
 * @route   PUT /api/v1/attendance/:id
 * @access  Private (Organizer+)
 */
exports.updateAttendance = asyncHandler(async (req, res) => {
  const { checkInTime, checkOutTime, notes } = req.body;

  const attendance = await Attendance.findById(req.params.id).populate("event");

  if (!attendance) {
    throw new AppError("Attendance record not found", 404);
  }

  // Check authorization
  if (
    attendance.event.organizer.toString() !== req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to update attendance", 403);
  }

  if (checkInTime) attendance.checkInTime = new Date(checkInTime);
  if (checkOutTime) attendance.checkOutTime = new Date(checkOutTime);
  if (notes) attendance.notes = notes;

  // Recalculate duration if both times are set
  if (attendance.checkInTime && attendance.checkOutTime) {
    const duration = Math.round(
      (attendance.checkOutTime - attendance.checkInTime) / (1000 * 60)
    );
    attendance.duration = duration;
  }

  await attendance.save();

  res.status(200).json({
    success: true,
    data: attendance,
    message: "Attendance updated successfully",
  });
});

/**
 * @desc    Delete attendance record
 * @route   DELETE /api/v1/attendance/:id
 * @access  Private (Admin)
 */
exports.deleteAttendance = asyncHandler(async (req, res) => {
  const attendance = await Attendance.findById(req.params.id);

  if (!attendance) {
    throw new AppError("Attendance record not found", 404);
  }

  await attendance.deleteOne();

  res.status(200).json({
    success: true,
    message: "Attendance record deleted successfully",
  });
});

/**
 * @desc    Get attendance report
 * @route   GET /api/v1/attendance/event/:eventId/report
 * @access  Private (Organizer+)
 */
exports.getAttendanceReport = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { format = "json" } = req.query;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check authorization
  if (
    event.organizer.toString() !== req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to view attendance report", 403);
  }

  const attendance = await Attendance.find({ event: eventId })
    .populate("user", "fullName email phone department rollNumber")
    .sort({ checkInTime: 1 });

  // Generate report data
  const reportData = attendance.map((record) => ({
    name: record.user.fullName,
    email: record.user.email,
    phone: record.user.phone || "",
    department: record.user.department || "",
    rollNumber: record.user.rollNumber || "",
    checkInTime: record.checkInTime,
    checkOutTime: record.checkOutTime || "",
    duration: record.duration || 0,
    method: record.checkInMethod,
  }));

  // Get summary statistics
  const totalRegistrations = await EventRegistration.countDocuments({
    event: eventId,
    status: "confirmed",
  });

  const summary = {
    eventTitle: event.title,
    totalRegistrations,
    totalAttendance: attendance.length,
    attendanceRate:
      totalRegistrations > 0
        ? ((attendance.length / totalRegistrations) * 100).toFixed(2)
        : 0,
    avgDuration:
      attendance.reduce((sum, r) => sum + (r.duration || 0), 0) /
        attendance.length || 0,
  };

  if (format === "csv") {
    const csv = [
      [
        "Name",
        "Email",
        "Phone",
        "Department",
        "Roll Number",
        "Check-in Time",
        "Check-out Time",
        "Duration (minutes)",
        "Method",
      ],
      ...reportData.map((r) => [
        r.name,
        r.email,
        r.phone,
        r.department,
        r.rollNumber,
        r.checkInTime.toISOString(),
        r.checkOutTime ? r.checkOutTime.toISOString() : "",
        r.duration,
        r.method,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=attendance-${eventId}.csv`
    );
    return res.send(csv);
  }

  res.status(200).json({
    success: true,
    data: {
      summary,
      attendance: reportData,
    },
  });
});

/**
 * @desc    Bulk check-in from list
 * @route   POST /api/v1/attendance/bulk-checkin
 * @access  Private (Organizer+)
 */
exports.bulkCheckIn = asyncHandler(async (req, res) => {
  const { eventId, userIds } = req.body;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check authorization
  if (
    event.organizer.toString() !== req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to mark attendance", 403);
  }

  const results = {
    success: [],
    failed: [],
  };

  for (const userId of userIds) {
    try {
      // Check registration
      const registration = await EventRegistration.findOne({
        event: eventId,
        user: userId,
        status: "confirmed",
      });

      if (!registration) {
        results.failed.push({
          userId,
          reason: "Not registered or not confirmed",
        });
        continue;
      }

      // Check if already checked in
      const existing = await Attendance.findOne({
        event: eventId,
        user: userId,
        checkOutTime: null,
      });

      if (existing) {
        results.failed.push({
          userId,
          reason: "Already checked in",
        });
        continue;
      }

      // Create attendance
      const attendance = await Attendance.create({
        event: eventId,
        user: userId,
        checkInTime: new Date(),
        checkInMethod: "manual",
        markedBy: req.user._id,
      });

      // Update registration
      registration.checkInTime = new Date();
      await registration.save();

      results.success.push(userId);
    } catch (error) {
      results.failed.push({
        userId,
        reason: error.message,
      });
    }
  }

  res.status(200).json({
    success: true,
    data: results,
    message: `${results.success.length} check-in(s) successful, ${results.failed.length} failed`,
  });
});

/**
 * @desc    Get attendance statistics (Admin)
 * @route   GET /api/v1/attendance/stats
 * @access  Private (Admin)
 */
exports.getAttendanceStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.checkInTime = {};
    if (startDate) dateFilter.checkInTime.$gte = new Date(startDate);
    if (endDate) dateFilter.checkInTime.$lte = new Date(endDate);
  }

  const overallStats = await Attendance.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: null,
        totalCheckIns: { $sum: 1 },
        avgDuration: { $avg: "$duration" },
        totalDuration: { $sum: "$duration" },
      },
    },
  ]);

  const byMethod = await Attendance.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: "$checkInMethod",
        count: { $sum: 1 },
      },
    },
  ]);

  const byEvent = await Attendance.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: "$event",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "events",
        localField: "_id",
        foreignField: "_id",
        as: "eventInfo",
      },
    },
    { $unwind: "$eventInfo" },
    {
      $project: {
        eventTitle: "$eventInfo.title",
        count: 1,
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      overall: overallStats[0] || {},
      byMethod,
      topEvents: byEvent,
    },
  });
});
