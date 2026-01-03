const Payment = require("../models/Payment");
const EventRegistration = require("../models/EventRegistration");
const Event = require("../models/Event");
const Invoice = require("../models/Invoice");
const Refund = require("../models/Refund");
const Notification = require("../models/Notification");
const { asyncHandler } = require("../middleware/errorHandler");
const AppError = require("../middleware/errorHandler").AppError;
const logger = require("../utils/logger");
const { stripe, razorpay } = require("../utils/payment");
const { sendEmail } = require("../utils/email");

/**
 * @desc    Initiate payment for registration
 * @route   POST /api/v1/payments/initiate
 * @access  Private
 */
exports.initiatePayment = asyncHandler(async (req, res) => {
  const { registrationId, paymentMethod = "stripe" } = req.body;

  // Get registration
  const registration = await EventRegistration.findById(registrationId)
    .populate("event")
    .populate("user", "fullName email")
    .populate("team");

  if (!registration) {
    throw new AppError("Registration not found", 404);
  }

  // Check if user owns this registration
  if (registration.user._id.toString() !== req.user._id.toString()) {
    throw new AppError(
      "Not authorized to make payment for this registration",
      403
    );
  }

  // Check if already paid
  if (registration.paymentStatus === "paid") {
    throw new AppError("Payment already completed", 400);
  }

  // Check if event requires payment
  if (!registration.event.isPaid) {
    throw new AppError("This event does not require payment", 400);
  }

  // TEAM PAYMENT ENFORCEMENT: Only team leader can initiate payment for team events
  if (registration.team) {
    const isLeader =
      registration.team.leader.toString() === req.user._id.toString();

    if (!isLeader) {
      throw new AppError(
        "Only the team leader can make payment for team registrations. Please contact your team leader.",
        403
      );
    }

    // Check if payment already exists for this team
    const existingTeamPayment = await Payment.findOne({
      event: registration.event._id,
      registration: {
        $in: await EventRegistration.find({
          team: registration.team._id,
        }).distinct("_id"),
      },
      status: { $in: ["pending", "completed"] },
    });

    if (existingTeamPayment) {
      throw new AppError(
        "Payment has already been initiated for this team",
        400
      );
    }
  }

  const amount = registration.event.amount;

  let paymentData;
  let orderId;

  if (paymentMethod === "stripe") {
    // Create Stripe Payment Intent
    paymentData = await stripe.createPaymentIntent(
      amount,
      registration.event.currency || "inr",
      {
        registrationId: registrationId,
        eventId: registration.event._id.toString(),
        userId: req.user._id.toString(),
      }
    );
    orderId = paymentData.paymentIntentId;
  } else if (paymentMethod === "razorpay") {
    // Create Razorpay Order
    paymentData = await razorpay.createOrder(
      amount,
      registration.event.currency || "INR",
      `reg_${registrationId}`,
      {
        registrationId: registrationId,
        eventId: registration.event._id.toString(),
        userId: req.user._id.toString(),
      }
    );
    orderId = paymentData.orderId;
  } else {
    throw new AppError("Invalid payment method", 400);
  }

  // Create payment record
  const payment = await Payment.create({
    user: req.user._id,
    event: registration.event._id,
    registration: registrationId,
    amount,
    currency: registration.event.currency || "INR",
    paymentGateway: paymentMethod,
    paymentMethod: "online",
    orderId,
    status: "pending",
    gatewayResponse: paymentData,
  });

  res.status(200).json({
    success: true,
    data: {
      payment,
      clientSecret:
        paymentMethod === "stripe" ? paymentData.client_secret : null,
      orderId: orderId,
      amount: amount,
      currency: registration.event.currency || "INR",
      key:
        paymentMethod === "razorpay"
          ? process.env.RAZORPAY_KEY_ID
          : paymentMethod === "stripe"
          ? process.env.STRIPE_PUBLISHABLE_KEY
          : null,
    },
    message: "Payment initiated successfully",
  });
});

/**
 * @desc    Verify payment
 * @route   POST /api/v1/payments/verify
 * @access  Private
 */
exports.verifyPayment = asyncHandler(async (req, res) => {
  const {
    paymentId,
    paymentIntentId, // For Stripe
    razorpay_payment_id, // For Razorpay
    razorpay_order_id,
    razorpay_signature,
  } = req.body;

  const payment = await Payment.findById(paymentId)
    .populate("registration")
    .populate("event", "title")
    .populate("user", "fullName email");

  if (!payment) {
    throw new AppError("Payment not found", 404);
  }

  // Check if user owns this payment
  if (payment.user._id.toString() !== req.user._id.toString()) {
    throw new AppError("Not authorized to verify this payment", 403);
  }

  if (payment.status === "completed") {
    throw new AppError("Payment already verified", 400);
  }

  let verified = false;

  if (payment.paymentGateway === "stripe") {
    // Verify Stripe payment
    const stripePayment = await stripe.verifyPayment(paymentIntentId);
    if (stripePayment.status === "succeeded") {
      verified = true;
      payment.transactionId = paymentIntentId;
      payment.gatewayResponse = stripePayment;
    }
  } else if (payment.paymentGateway === "razorpay") {
    // Verify Razorpay payment
    const razorpayVerification = await razorpay.verifyPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );
    verified = razorpayVerification.success;
    if (verified) {
      payment.transactionId = razorpay_payment_id;
      payment.gatewayResponse = razorpayVerification;
    }
  }

  if (!verified) {
    payment.status = "failed";
    await payment.save();
    throw new AppError("Payment verification failed", 400);
  }

  // Update payment status
  payment.status = "completed";
  payment.paidAt = new Date();
  await payment.save();

  // RACE CONDITION FIX: Update registration payment status and confirm registration atomically
  const registration = await EventRegistration.findById(
    payment.registration
  ).populate("team");

  if (!registration) {
    throw new AppError("Registration not found", 404);
  }

  const oldStatus = registration.status;
  registration.paymentStatus = "paid";
  registration.payment = payment._id;

  // Confirm the registration after successful payment
  if (registration.status === "pending") {
    registration.status = "confirmed";
  }

  await registration.save();

  // TEAM PAYMENT: If this is a team registration, mark ALL team members as paid
  if (registration.team) {
    const teamRegistrations = await EventRegistration.find({
      team: registration.team._id,
      event: registration.event,
      _id: { $ne: registration._id }, // Exclude current registration (already updated)
    });

    let confirmedCount = 0;
    for (const teamReg of teamRegistrations) {
      const wasUnconfirmed = teamReg.status === "pending";
      teamReg.paymentStatus = "paid";
      teamReg.payment = payment._id;
      if (teamReg.status === "pending") {
        teamReg.status = "confirmed";
        if (wasUnconfirmed) confirmedCount++;
      }
      await teamReg.save();
    }

    // Update event count for all newly confirmed team members
    if (confirmedCount > 0) {
      await Event.findByIdAndUpdate(
        registration.event,
        { $inc: { registeredCount: confirmedCount } },
        { new: false }
      );
    }
  }

  // RACE CONDITION FIX: Update event's registeredCount atomically only if status changed
  if (oldStatus === "pending" && registration.status === "confirmed") {
    await Event.findByIdAndUpdate(
      registration.event,
      { $inc: { registeredCount: 1 } },
      { new: false }
    );
  }

  // Generate invoice
  const invoice = await Invoice.create({
    invoiceNumber: `INV-${Date.now()}`,
    user: payment.user._id,
    event: payment.event,
    registration: payment.registration,
    payment: payment._id,
    amount: payment.amount,
    currency: payment.currency,
    items: [
      {
        description: `Registration for ${payment.event.title}`,
        quantity: 1,
        unitPrice: payment.amount,
        total: payment.amount,
      },
    ],
    subtotal: payment.amount,
    total: payment.amount,
    status: "paid",
    paidAt: new Date(),
  });

  // Send confirmation email
  try {
    await sendEmail({
      to: payment.user.email,
      subject: `Payment Confirmation - ${payment.event.title}`,
      template: "payment-confirmation",
      context: {
        userName: payment.user.fullName,
        eventTitle: payment.event.title,
        amount: payment.amount,
        currency: payment.currency,
        transactionId: payment.transactionId,
        invoiceNumber: invoice.invoiceNumber,
      },
    });
  } catch (error) {
    logger.error("Failed to send payment confirmation email:", error);
  }

  // Create notification
  await Notification.create({
    recipient: payment.user._id,
    sentBy: null,
    title: "Payment Successful - Registration Confirmed",
    message: `Your payment of ${payment.currency} ${payment.amount} for ${payment.event.title} has been confirmed. Your registration is now complete!`,
    type: "payment",
    relatedEvent: payment.event,
    channels: ["in_app", "email"],
  });

  res.status(200).json({
    success: true,
    data: {
      payment,
      invoice,
    },
    message: "Payment verified successfully",
  });
});

/**
 * @desc    Get payment by ID
 * @route   GET /api/v1/payments/:id
 * @access  Private
 */
exports.getPaymentById = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate("user", "fullName email")
    .populate("event", "title")
    .populate("registration");

  if (!payment) {
    throw new AppError("Payment not found", 404);
  }

  // Check access
  if (
    payment.user._id.toString() !== req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to access this payment", 403);
  }

  res.status(200).json({
    success: true,
    data: payment,
  });
});

/**
 * @desc    Get my payments
 * @route   GET /api/v1/payments/my
 * @access  Private
 */
exports.getMyPayments = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;

  const filter = { user: req.user._id };

  if (status) {
    filter.status = status;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const payments = await Payment.find(filter)
    .populate("event", "title startDateTime banner currency")
    .populate("registration", "registrationNumber")
    .populate("refund", "amount status refundPercentage")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Payment.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: {
      payments,
    },
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      limit: parseInt(limit),
    },
  });
});

/**
 * @desc    Get event payments (Organizer)
 * @route   GET /api/v1/payments/event/:eventId
 * @access  Private (Organizer+)
 */
exports.getEventPayments = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { status, page = 1, limit = 20 } = req.query;

  // Check authorization
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  if (
    (event.organizerId || event.organizer).toString() !==
      req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to access event payments", 403);
  }

  const filter = { event: eventId };

  if (status) {
    filter.status = status;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const payments = await Payment.find(filter)
    .populate("user", "fullName email phone")
    .populate("registration", "registrationNumber")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Payment.countDocuments(filter);

  // Get payment statistics
  const stats = await Payment.aggregate([
    { $match: { event: event._id } },
    {
      $group: {
        _id: null,
        totalPayments: { $sum: 1 },
        completedPayments: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        pendingPayments: {
          $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
        },
        failedPayments: {
          $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
        },
        totalAmount: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$amount", 0] },
        },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: payments,
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
 * @desc    Request refund
 * @route   POST /api/v1/payments/:id/refund
 * @access  Private
 */
exports.requestRefund = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const payment = await Payment.findById(req.params.id)
    .populate("event")
    .populate("registration")
    .populate("user", "fullName email");

  if (!payment) {
    throw new AppError("Payment not found", 404);
  }

  // Check if user owns this payment
  if (payment.user._id.toString() !== req.user._id.toString()) {
    throw new AppError(
      "Not authorized to request refund for this payment",
      403
    );
  }

  if (payment.status !== "completed") {
    throw new AppError("Only completed payments can be refunded", 400);
  }

  // Check if refund already exists
  const existingRefund = await Refund.findOne({
    payment: payment._id,
    status: { $ne: "rejected" },
  });

  if (existingRefund) {
    throw new AppError("Refund request already exists", 400);
  }

  // Check event refund policy
  const event = payment.event;
  const daysTillEvent =
    (event.startDateTime - new Date()) / (1000 * 60 * 60 * 24);

  let refundPercentage = 0;
  if (daysTillEvent >= 7) {
    refundPercentage = 100;
  } else if (daysTillEvent >= 3) {
    refundPercentage = 50;
  } else {
    throw new AppError("Event is too close for refund", 400);
  }

  const refundAmount = (payment.amount * refundPercentage) / 100;

  // Create refund request
  const refund = await Refund.create({
    payment: payment._id,
    registration: payment.registration,
    event: payment.event,
    user: payment.user._id,
    amount: refundAmount,
    originalAmount: payment.amount,
    refundPercentage,
    reason,
    status: "pending",
    requestedAt: new Date(),
  });

  // Update registration status
  const registration = await EventRegistration.findById(payment.registration);
  registration.paymentStatus = "refund_pending";
  await registration.save();

  // Notify organizer
  await Notification.create({
    recipient: event.organizerId || event.organizer,
    title: "Refund Request",
    message: `Refund requested for ${event.title}`,
    type: "payment",
    relatedEvent: event._id,
    channels: ["in_app", "email"],
  });

  res.status(200).json({
    success: true,
    data: refund,
    message: "Refund request submitted successfully",
  });
});

/**
 * @desc    Process refund (Admin/Organizer)
 * @route   PUT /api/v1/payments/refunds/:id/process
 * @access  Private (Organizer+)
 */
exports.processRefund = asyncHandler(async (req, res) => {
  const { action, notes } = req.body; // action: 'approve' or 'reject'

  const refund = await Refund.findById(req.params.id)
    .populate("payment")
    .populate("event")
    .populate("user", "fullName email");

  if (!refund) {
    throw new AppError("Refund request not found", 404);
  }

  // Check authorization
  if (
    (refund.event.organizerId || refund.event.organizer).toString() !==
      req.user._id.toString() &&
    !["admin", "superadmin", "super_admin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to process refunds", 403);
  }

  if (refund.status !== "pending") {
    throw new AppError("Refund request already processed", 400);
  }

  if (action === "reject") {
    refund.status = "rejected";
    refund.rejectionReason = notes;
    refund.processedBy = req.user._id;
    refund.processedAt = new Date();
    await refund.save();

    // Update registration
    const registration = await EventRegistration.findById(refund.registration);
    registration.paymentStatus = "paid";
    await registration.save();

    res.status(200).json({
      success: true,
      data: refund,
      message: "Refund request rejected",
    });
    return;
  }

  // Process refund with payment gateway
  const payment = refund.payment;
  let refundResponse;

  try {
    if (payment.paymentGateway === "stripe") {
      refundResponse = await stripe.createRefund(
        payment.transactionId,
        refund.amount
      );
    } else if (payment.paymentGateway === "razorpay") {
      refundResponse = await razorpay.createRefund(
        payment.transactionId,
        refund.amount
      );
    }

    refund.status = "completed";
    refund.refundTransactionId = refundResponse.refundId || refundResponse.id;
    refund.processedBy = req.user._id;
    refund.processedAt = new Date();
    refund.gatewayResponse = refundResponse;
    await refund.save();

    // Update payment
    payment.refundAmount = refund.amount;
    payment.refundedAt = new Date();
    await payment.save();

    // Update registration
    const registration = await EventRegistration.findById(refund.registration);
    registration.paymentStatus = "refunded";
    registration.status = "cancelled";
    await registration.save();

    // Notify user
    await Notification.create({
      recipient: refund.user._id,
      title: "Refund Processed",
      message: `Your refund of ${refund.amount} has been processed`,
      type: "payment",
      relatedEvent: refund.event,
      channels: ["in_app", "email"],
    });

    // Send email
    try {
      await sendEmail({
        to: refund.user.email,
        subject: "Refund Processed",
        template: "refund-confirmation",
        context: {
          userName: refund.user.fullName,
          eventTitle: refund.event.title,
          amount: refund.amount,
          transactionId: refund.refundTransactionId,
        },
      });
    } catch (error) {
      logger.error("Failed to send refund confirmation email:", error);
    }

    res.status(200).json({
      success: true,
      data: refund,
      message: "Refund processed successfully",
    });
  } catch (error) {
    logger.error("Refund processing error:", error);
    refund.status = "failed";
    refund.notes = error.message;
    await refund.save();
    throw new AppError("Failed to process refund", 500);
  }
});

/**
 * @desc    Webhook handler for Stripe
 * @route   POST /api/v1/payments/webhook/stripe
 * @access  Public (Webhook)
 */
exports.stripeWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers["stripe-signature"];

  // Verify webhook signature (implement in payment utility)
  // Handle different event types
  const event = req.body;

  switch (event.type) {
    case "payment_intent.succeeded":
      // Handle successful payment
      logger.info("Stripe payment succeeded:", event.data.object.id);
      break;
    case "payment_intent.payment_failed":
      // Handle failed payment
      logger.error("Stripe payment failed:", event.data.object.id);
      break;
    default:
      logger.info("Unhandled Stripe event type:", event.type);
  }

  res.status(200).json({ received: true });
});

/**
 * @desc    Webhook handler for Razorpay
 * @route   POST /api/v1/payments/webhook/razorpay
 * @access  Public (Webhook)
 */
exports.razorpayWebhook = asyncHandler(async (req, res) => {
  const event = req.body;

  // Verify webhook signature (implement in payment utility)

  switch (event.event) {
    case "payment.captured":
      // Handle successful payment
      logger.info(
        "Razorpay payment captured:",
        event.payload.payment.entity.id
      );
      break;
    case "payment.failed":
      // Handle failed payment
      logger.error("Razorpay payment failed:", event.payload.payment.entity.id);
      break;
    default:
      logger.info("Unhandled Razorpay event type:", event.event);
  }

  res.status(200).json({ received: true });
});

/**
 * @desc    Get payment statistics (Admin)
 * @route   GET /api/v1/payments/stats
 * @access  Private (Admin)
 */
exports.getPaymentStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const filter = {};
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const stats = await Payment.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalPayments: { $sum: 1 },
        completedPayments: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        pendingPayments: {
          $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
        },
        failedPayments: {
          $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
        },
        totalRevenue: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$amount", 0] },
        },
        totalRefunded: { $sum: "$refundAmount" },
      },
    },
  ]);

  // Payment methods breakdown
  const methodStats = await Payment.aggregate([
    { $match: { ...filter, status: "completed" } },
    {
      $group: {
        _id: "$paymentGateway",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      overall: stats[0] || {},
      byMethod: methodStats,
    },
  });
});

/**
 * @desc    Download payment invoice
 * @route   GET /api/v1/payments/:id/invoice
 * @access  Private
 */
exports.downloadInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const payment = await Payment.findById(id)
    .populate("event", "title startDateTime")
    .populate("user", "fullName email")
    .populate("registration", "registrationNumber");

  if (!payment) {
    throw new AppError("Payment not found", 404);
  }

  // Check if user owns this payment or is admin
  if (
    payment.user._id.toString() !== req.user._id.toString() &&
    !["admin", "super_admin", "superadmin"].includes(req.user.role)
  ) {
    throw new AppError("Not authorized to download this invoice", 403);
  }

  // Check if payment is completed
  if (payment.status !== "completed") {
    throw new AppError("Invoice is only available for completed payments", 400);
  }

  // Get or create invoice
  let invoice = await Invoice.findOne({ payment: payment._id });

  if (!invoice) {
    invoice = await Invoice.create({
      invoiceNumber: `INV-${Date.now()}`,
      payment: payment._id,
      user: payment.user._id,
      event: payment.event._id,
      amount: payment.amount,
      currency: payment.currency,
      taxAmount: 0,
      totalAmount: payment.amount,
      issuedDate: payment.paidAt || new Date(),
      dueDate: payment.paidAt || new Date(),
      status: "paid",
    });
  }

  // For now, return invoice data as JSON
  // In production, you would generate a PDF here
  res.status(200).json({
    success: true,
    data: {
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        issuedDate: invoice.issuedDate,
        payment: {
          transactionId: payment.transactionId,
          amount: payment.amount,
          currency: payment.currency,
          paidAt: payment.paidAt,
          paymentMethod: payment.paymentGateway,
        },
        event: {
          title: payment.event.title,
          date: payment.event.startDateTime,
        },
        user: {
          name: payment.user.fullName,
          email: payment.user.email,
        },
        registration: {
          number: payment.registration?.registrationNumber,
        },
      },
    },
  });
});
