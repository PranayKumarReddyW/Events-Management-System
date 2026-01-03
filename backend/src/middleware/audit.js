const AuditLog = require("../models/AuditLog");
const logger = require("../utils/logger");

// Audit log middleware
exports.auditLog = (action, entityType) => {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override res.json
    res.json = function (data) {
      // Log audit if request was successful
      if (
        res.statusCode >= 200 &&
        res.statusCode < 300 &&
        process.env.ENABLE_AUDIT_LOGS === "true"
      ) {
        const logData = {
          userId: req.user?._id,
          action,
          entityType,
          entityId: req.params.id || req.body.id || data?.data?._id,
          oldValues: req.oldValues || undefined,
          newValues: req.body || undefined,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get("user-agent"),
          metadata: {
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
          },
        };

        AuditLog.create(logData).catch((err) => {
          logger.error("Failed to create audit log:", err);
        });
      }

      // Call original json method
      return originalJson(data);
    };

    next();
  };
};

// Specific audit log methods
exports.auditCreate = (entityType) => exports.auditLog("create", entityType);
exports.auditRead = (entityType) => exports.auditLog("read", entityType);
exports.auditUpdate = (entityType) => exports.auditLog("update", entityType);
exports.auditDelete = (entityType) => exports.auditLog("delete", entityType);
