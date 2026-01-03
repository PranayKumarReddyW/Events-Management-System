const express = require("express");
const router = express.Router();
const {
  generateCertificates,
  getCertificateById,
  downloadCertificate,
  verifyCertificate,
  getMyCertificates,
  getEventCertificates,
  regenerateCertificate,
  revokeCertificate,
  bulkGenerateCertificates,
  getCertificateStats,
} = require("../controllers/certificateController");
const { protect, authorize } = require("../middleware/auth");
const { auditLog } = require("../middleware/audit");

// Public routes
router.get("/:id", getCertificateById);
router.get("/:id/download", downloadCertificate);
router.get("/verify/:certificateNumber", verifyCertificate);

// Protected routes
router.use(protect);

// Get my certificates
router.get("/my", getMyCertificates);

// Department organizer+ routes
router.post(
  "/generate",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  auditLog("create", "certificate"),
  generateCertificates
);

router.post(
  "/bulk-generate",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  auditLog("bulk_create", "certificate"),
  bulkGenerateCertificates
);

router.get(
  "/event/:eventId",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  getEventCertificates
);

router.post(
  "/:id/regenerate",
  authorize("department_organizer", "faculty", "admin", "super_admin"),
  auditLog("update", "certificate"),
  regenerateCertificate
);

// Admin routes
router.delete(
  "/:id",
  authorize("admin", "super_admin"),
  auditLog("delete", "certificate"),
  revokeCertificate
);

router.get("/stats", authorize("admin", "super_admin"), getCertificateStats);

module.exports = router;
