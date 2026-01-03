const express = require("express");
const router = express.Router();
const {
  initiatePayment,
  verifyPayment,
  getPaymentById,
  getMyPayments,
  getEventPayments,
  requestRefund,
  processRefund,
  stripeWebhook,
  razorpayWebhook,
  getPaymentStats,
  downloadInvoice,
} = require("../controllers/paymentController");
const { protect, authorize } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validation");
const { auditLog } = require("../middleware/audit");

// Webhook routes (no authentication - verified by signature)
router.post(
  "/webhook/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhook
);
router.post("/webhook/razorpay", razorpayWebhook);

// Protected routes
router.use(protect);

// Initiate payment
router.post(
  "/initiate",
  validate(schemas.payment),
  auditLog("create", "payment"),
  initiatePayment
);

// Verify payment
router.post("/verify", auditLog("update", "payment"), verifyPayment);

// Get my payments (must be before /:id route)
router.get("/my", getMyPayments);

// Get payment by ID
router.get("/:id", getPaymentById);

// Download invoice
router.get("/:id/invoice", downloadInvoice);

// Request refund
router.post("/:id/refund", auditLog("create", "refund"), requestRefund);

// Organizer+ routes
router.get(
  "/event/:eventId",
  authorize("organizer", "admin", "superadmin"),
  getEventPayments
);

router.put(
  "/refunds/:id/process",
  authorize("organizer", "admin", "superadmin"),
  auditLog("update", "refund"),
  processRefund
);

// Admin routes
router.get("/stats", authorize("admin", "superadmin"), getPaymentStats);

module.exports = router;
