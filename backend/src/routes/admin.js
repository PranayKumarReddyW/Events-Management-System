const express = require("express");
const router = express.Router();
const {
  getDashboard,
  getAllUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  getAllEvents,
  forceDeleteEvent,
  getAuditLogs,
  getSettings,
  updateSetting,
  managePermissions,
  getAllPermissions,
  getSystemStatistics,
  deleteInactiveUsers,
  generateSystemReport,
  clearCache,
  getSystemHealth,
} = require("../controllers/adminController");
const { protect, authorize } = require("../middleware/auth");
const { auditLog } = require("../middleware/audit");

// All routes require admin or super_admin
router.use(protect);
router.use(authorize("admin", "super_admin"));

// Dashboard
router.get("/dashboard", getDashboard);

// User Management
router.get("/users", getAllUsers);
router.put("/users/:id/role", auditLog("update", "user"), updateUserRole);
router.put("/users/:id/status", auditLog("update", "user"), updateUserStatus);
router.delete("/users/:id", auditLog("delete", "user"), deleteUser);
router.delete(
  "/users/inactive/cleanup",
  auditLog("bulk_delete", "user"),
  deleteInactiveUsers
);

// Event Management
router.get("/events", getAllEvents);
router.delete("/events/:id", auditLog("delete", "event"), forceDeleteEvent);

// Audit Logs
router.get("/audit-logs", getAuditLogs);

// Settings Management
router.get("/settings", getSettings);
router.put("/settings/:key", auditLog("update", "setting"), updateSetting);

// Permissions Management
router.get("/permissions", getAllPermissions);
router.put(
  "/permissions/:roleId",
  auditLog("update", "permissions"),
  managePermissions
);

// System Operations
router.get("/statistics", getSystemStatistics);
router.get("/health", getSystemHealth);
router.post("/cache/clear", auditLog("system", "cache_clear"), clearCache);
router.get("/reports/generate", generateSystemReport);

module.exports = router;
