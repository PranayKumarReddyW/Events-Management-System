const Certificate = require("../models/Certificate");
const EventRegistration = require("../models/EventRegistration");
const Event = require("../models/Event");
const EventResult = require("../models/EventResult");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { asyncHandler } = require("../middleware/errorHandler");
const AppError = require("../middleware/errorHandler").AppError;
const logger = require("../utils/logger");
const { generateCertificate } = require("../utils/certificate");
const { sendEmail } = require("../utils/email");
const path = require("path");
const fs = require("fs");

/**
 * @desc    Generate certificates for event
 * @route   POST /api/v1/certificates/generate
 * @access  Private (Organizer+)
 */
exports.generateCertificates = asyncHandler(async (req, res) => {
  const {
    eventId,
    certificateType = "participation",
    registrationIds,
    template,
  } = req.body;

  // Check event exists
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
    throw new AppError("Not authorized to generate certificates", 403);
  }

  // Check if event is completed
  if (event.status !== "completed" && event.endDateTime > new Date()) {
    throw new AppError(
      "Certificates can only be generated after event completion",
      400
    );
  }

  let registrations;
  if (registrationIds && registrationIds.length > 0) {
    // EDGE CASE: Only generate for confirmed registrations with check-in
    registrations = await EventRegistration.find({
      _id: { $in: registrationIds },
      event: eventId,
      status: "confirmed",
      checkInTime: { $ne: null }, // Must have attended
      disqualified: { $ne: true }, // Not disqualified
    }).populate("user", "fullName email");
  } else {
    // EDGE CASE: Generate for all confirmed, checked-in, non-disqualified participants
    registrations = await EventRegistration.find({
      event: eventId,
      status: "confirmed",
      checkInTime: { $ne: null }, // Only attendees
      disqualified: { $ne: true }, // Skip disqualified
    }).populate("user", "fullName email");
  }

  if (registrations.length === 0) {
    throw new AppError(
      "No eligible participants found. Only participants who checked in and are not disqualified can receive certificates.",
      400
    );
  }

  const generatedCertificates = [];
  const errors = [];

  for (const registration of registrations) {
    try {
      // NULL CHECK: Validate registration and user
      if (!registration?.user?._id) {
        logger.warn(`Invalid registration or user data, skipping`);
        continue;
      }

      // Check if certificate already exists
      let certificate = await Certificate.findOne({
        event: eventId,
        user: registration.user._id,
        registration: registration._id,
      });

      if (certificate) {
        logger.info(
          `Certificate already exists for user ${registration.user._id}`
        );
        generatedCertificates.push(certificate);
        continue;
      }

      // Get position if it's a winner certificate
      let position = null;
      if (certificateType === "winner") {
        const result = await EventResult.findOne({
          event: eventId,
          $or: [{ user: registration.user._id }, { team: registration.team }],
        });

        if (result) {
          position = result.position;
        }
      }

      // Generate certificate number
      const certificateNumber = `CERT-${new Date().getFullYear()}-${String(
        (await Certificate.countDocuments()) + 1
      ).padStart(6, "0")}`;

      // NULL CHECK: Validate required data for certificate generation
      if (!registration.user.fullName || !event.title) {
        throw new Error("Missing required certificate data");
      }

      // Generate PDF
      const certificatePath = await generateCertificate({
        recipientName: registration.user.fullName,
        eventTitle: event.title,
        eventDate: event.startDateTime,
        certificateType,
        certificateNumber,
        position,
        template,
      });

      // Create certificate record
      certificate = await Certificate.create({
        certificateNumber,
        user: registration.user._id,
        event: eventId,
        registration: registration._id,
        type: certificateType,
        position,
        filePath: certificatePath,
        issuedBy: req.user._id,
        issuedDate: new Date(),
      });

      generatedCertificates.push(certificate);

      // Send email notification
      try {
        // NULL CHECK: Validate email before sending
        if (registration.user.email) {
          await sendEmail({
            to: registration.user.email,
            subject: `Certificate Ready - ${event.title}`,
            template: "certificate-ready",
            context: {
              userName: registration.user.fullName,
              eventTitle: event.title,
              certificateNumber,
              downloadLink: `${process.env.FRONTEND_URL}/certificates/${certificate._id}`,
            },
          });
        }
      } catch (emailError) {
        logger.error("Failed to send certificate email:", emailError);
      }

      // Create notification
      await Notification.create({
        recipient: registration.user._id,
        title: "Certificate Available",
        message: `Your certificate for ${event.title} is ready to download`,
        type: "certificate",
        relatedEvent: eventId,
        channels: ["in_app", "email"],
        sentBy: req.user._id,
      });
    } catch (error) {
      logger.error(
        `Failed to generate certificate for ${
          registration.user?.email || "unknown"
        }:`,
        error
      );
      errors.push({
        userId: registration.user?._id,
        email: registration.user?.email,
        error: error.message,
      });
    }
  }

  // Mark event certificates as generated
  if (generatedCertificates.length > 0) {
    await Event.findByIdAndUpdate(eventId, {
      certificatesGenerated: true,
      certificatesGeneratedAt: new Date(),
    });
  }

  res.status(200).json({
    success: true,
    data: {
      generated: generatedCertificates.length,
      certificates: generatedCertificates,
      errors: errors.length > 0 ? errors : undefined,
    },
    message: `Successfully generated ${generatedCertificates.length} certificate(s)`,
  });
});

/**
 * @desc    Get certificate by ID
 * @route   GET /api/v1/certificates/:id
 * @access  Public
 */
exports.getCertificateById = asyncHandler(async (req, res) => {
  const certificate = await Certificate.findById(req.params.id)
    .populate("user", "fullName email profilePicture")
    .populate("event", "title startDateTime endDateTime eventType")
    .populate("issuedBy", "fullName");

  if (!certificate) {
    throw new AppError("Certificate not found", 404);
  }

  res.status(200).json({
    success: true,
    data: certificate,
  });
});

/**
 * @desc    Download certificate
 * @route   GET /api/v1/certificates/:id/download
 * @access  Public
 */
exports.downloadCertificate = asyncHandler(async (req, res) => {
  const certificate = await Certificate.findById(req.params.id)
    .populate("user", "fullName")
    .populate("event", "title");

  if (!certificate) {
    throw new AppError("Certificate not found", 404);
  }

  // NULL CHECK: Validate file path
  if (!certificate.filePath) {
    throw new AppError("Certificate file path not found", 500);
  }

  const filePath = path.resolve(certificate.filePath);

  if (!fs.existsSync(filePath)) {
    throw new AppError("Certificate file not found", 404);
  }

  // RACE CONDITION FIX: Use atomic operation for download count
  await Certificate.findByIdAndUpdate(certificate._id, {
    $inc: { downloadCount: 1 },
  });

  const fileName = `Certificate_${certificate.certificateNumber}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

/**
 * @desc    Verify certificate
 * @route   GET /api/v1/certificates/verify/:certificateNumber
 * @access  Public
 */
exports.verifyCertificate = asyncHandler(async (req, res) => {
  const { certificateNumber } = req.params;
  const { verificationCode } = req.query;

  const certificate = await Certificate.findOne({ certificateNumber })
    .populate("user", "fullName email")
    .populate("event", "title startDateTime eventType organizer")
    .populate("issuedBy", "fullName");

  if (!certificate) {
    return res.status(404).json({
      success: false,
      verified: false,
      message: "Certificate not found",
    });
  }

  // Verify code if provided
  if (verificationCode && certificate.verificationCode !== verificationCode) {
    return res.status(400).json({
      success: false,
      verified: false,
      message: "Invalid verification code",
    });
  }

  res.status(200).json({
    success: true,
    verified: true,
    data: {
      certificateNumber: certificate.certificateNumber,
      recipientName: certificate.user.fullName,
      eventTitle: certificate.event.title,
      eventDate: certificate.event.startDateTime,
      type: certificate.type,
      position: certificate.position,
      issuedDate: certificate.issuedDate,
      issuedBy: certificate.issuedBy.fullName,
    },
    message: "Certificate verified successfully",
  });
});

/**
 * @desc    Get my certificates
 * @route   GET /api/v1/certificates/my
 * @access  Private
 */
exports.getMyCertificates = asyncHandler(async (req, res) => {
  const certificates = await Certificate.find({ user: req.user._id })
    .populate("event", "title startDateTime eventType banner")
    .populate("issuedBy", "fullName")
    .sort({ issuedDate: -1 });

  res.status(200).json({
    success: true,
    data: {
      certificates,
      total: certificates.length,
    },
  });
});

/**
 * @desc    Get event certificates (Organizer)
 * @route   GET /api/v1/certificates/event/:eventId
 * @access  Private (Organizer+)
 */
exports.getEventCertificates = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { type, page = 1, limit = 20 } = req.query;

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
    throw new AppError("Not authorized to access event certificates", 403);
  }

  const filter = { event: eventId };
  if (type) {
    filter.type = type;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const certificates = await Certificate.find(filter)
    .populate("user", "fullName email")
    .populate("registration", "registrationNumber")
    .sort({ issuedDate: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Certificate.countDocuments(filter);

  // Get statistics
  const stats = await Certificate.aggregate([
    { $match: { event: event._id } },
    {
      $group: {
        _id: null,
        totalCertificates: { $sum: 1 },
        byType: {
          $push: {
            type: "$type",
            count: 1,
          },
        },
        totalDownloads: { $sum: "$downloadCount" },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: certificates,
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
 * @desc    Regenerate certificate
 * @route   POST /api/v1/certificates/:id/regenerate
 * @access  Private (Organizer+)
 */
exports.regenerateCertificate = asyncHandler(async (req, res) => {
  const certificate = await Certificate.findById(req.params.id)
    .populate("user", "fullName email")
    .populate("event")
    .populate("registration");

  if (!certificate) {
    throw new AppError("Certificate not found", 404);
  }

  // Check authorization
  if (
    certificate.event.organizer.toString() !== req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to regenerate certificates", 403);
  }

  // Delete old file
  if (fs.existsSync(certificate.filePath)) {
    fs.unlinkSync(certificate.filePath);
  }

  // Generate new PDF
  const certificatePath = await generateCertificate({
    recipientName: certificate.user.fullName,
    eventTitle: certificate.event.title,
    eventDate: certificate.event.startDateTime,
    certificateType: certificate.type,
    certificateNumber: certificate.certificateNumber,
    position: certificate.position,
  });

  certificate.filePath = certificatePath;
  certificate.lastUpdated = new Date();
  await certificate.save();

  res.status(200).json({
    success: true,
    data: certificate,
    message: "Certificate regenerated successfully",
  });
});

/**
 * @desc    Revoke certificate
 * @route   DELETE /api/v1/certificates/:id
 * @access  Private (Admin)
 */
exports.revokeCertificate = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const certificate = await Certificate.findById(req.params.id);

  if (!certificate) {
    throw new AppError("Certificate not found", 404);
  }

  // Delete file
  if (fs.existsSync(certificate.filePath)) {
    fs.unlinkSync(certificate.filePath);
  }

  // Mark as revoked (you can add a revoked field to schema)
  await certificate.deleteOne();

  logger.info(
    `Certificate ${certificate.certificateNumber} revoked by ${req.user._id}. Reason: ${reason}`
  );

  res.status(200).json({
    success: true,
    message: "Certificate revoked successfully",
  });
});

/**
 * @desc    Bulk generate certificates
 * @route   POST /api/v1/certificates/bulk-generate
 * @access  Private (Organizer+)
 */
exports.bulkGenerateCertificates = asyncHandler(async (req, res) => {
  const { eventId, template } = req.body;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  // Check authorization
  if (
    event.organizer.toString() !== req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to generate certificates", 403);
  }

  // Get all participants who checked in
  const registrations = await EventRegistration.find({
    event: eventId,
    status: "confirmed",
    checkInTime: { $ne: null },
  }).populate("user", "fullName email");

  // Get winners
  const results = await EventResult.find({ event: eventId })
    .populate("user", "fullName email")
    .populate("team");

  const generated = {
    participation: 0,
    winner: 0,
    errors: [],
  };

  // Generate participation certificates
  for (const registration of registrations) {
    try {
      // Check if already exists
      const existing = await Certificate.findOne({
        event: eventId,
        user: registration.user._id,
        type: "participation",
      });

      if (existing) continue;

      const certificateNumber = `CERT-${new Date().getFullYear()}-${String(
        (await Certificate.countDocuments()) + 1
      ).padStart(6, "0")}`;

      const certificatePath = await generateCertificate({
        recipientName: registration.user.fullName,
        eventTitle: event.title,
        eventDate: event.startDateTime,
        certificateType: "participation",
        certificateNumber,
        template,
      });

      await Certificate.create({
        certificateNumber,
        user: registration.user._id,
        event: eventId,
        registration: registration._id,
        type: "participation",
        filePath: certificatePath,
        issuedBy: req.user._id,
        issuedDate: new Date(),
      });

      generated.participation++;
    } catch (error) {
      generated.errors.push({
        user: registration.user.email,
        type: "participation",
        error: error.message,
      });
    }
  }

  // Generate winner certificates
  for (const result of results) {
    try {
      const userId = result.user ? result.user._id : null;
      if (!userId) continue;

      const registration = await EventRegistration.findOne({
        event: eventId,
        user: userId,
      });

      if (!registration) continue;

      // Check if already exists
      const existing = await Certificate.findOne({
        event: eventId,
        user: userId,
        type: "winner",
      });

      if (existing) continue;

      const certificateNumber = `CERT-${new Date().getFullYear()}-${String(
        (await Certificate.countDocuments()) + 1
      ).padStart(6, "0")}`;

      const certificatePath = await generateCertificate({
        recipientName: result.user.fullName,
        eventTitle: event.title,
        eventDate: event.startDateTime,
        certificateType: "winner",
        certificateNumber,
        position: result.position,
        template,
      });

      await Certificate.create({
        certificateNumber,
        user: userId,
        event: eventId,
        registration: registration._id,
        type: "winner",
        position: result.position,
        filePath: certificatePath,
        issuedBy: req.user._id,
        issuedDate: new Date(),
      });

      generated.winner++;
    } catch (error) {
      generated.errors.push({
        user: result.user ? result.user.email : "unknown",
        type: "winner",
        error: error.message,
      });
    }
  }

  res.status(200).json({
    success: true,
    data: generated,
    message: `Generated ${generated.participation} participation and ${generated.winner} winner certificates`,
  });
});

/**
 * @desc    Get certificate statistics (Admin)
 * @route   GET /api/v1/certificates/stats
 * @access  Private (Admin)
 */
exports.getCertificateStats = asyncHandler(async (req, res) => {
  const stats = await Certificate.aggregate([
    {
      $group: {
        _id: null,
        totalCertificates: { $sum: 1 },
        byType: {
          $push: "$type",
        },
        totalDownloads: { $sum: "$downloadCount" },
        avgDownloadsPerCertificate: { $avg: "$downloadCount" },
      },
    },
  ]);

  const typeStats = await Certificate.aggregate([
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
        downloads: { $sum: "$downloadCount" },
      },
    },
  ]);

  const recentCertificates = await Certificate.find()
    .populate("user", "fullName")
    .populate("event", "title")
    .sort({ issuedDate: -1 })
    .limit(10);

  res.status(200).json({
    success: true,
    data: {
      overall: stats[0] || {},
      byType: typeStats,
      recent: recentCertificates,
    },
  });
});
