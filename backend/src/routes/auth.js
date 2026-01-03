const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { validateSchema, schemas } = require("../middleware/validation");
const {
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
} = require("../middleware/rateLimiter");
const { authenticate } = require("../middleware/auth");
const { auditLog } = require("../middleware/audit");

// Public routes
router.post(
  "/register",
  // registerLimiter,
  validateSchema(schemas.userRegister),
  auditLog("create", "user"),
  authController.register
);

router.post(
  "/login",
  authLimiter,
  validateSchema(schemas.userLogin),
  auditLog("login", "user"),
  authController.login
);

router.post(
  "/forgot-password",
  passwordResetLimiter,
  authController.forgotPassword
);

router.post("/reset-password/:token", authController.resetPassword);

// Protected routes
router.use(authenticate);

router.get("/me", authController.getCurrentUser);

router.post("/logout", auditLog("logout", "user"), authController.logout);

router.put(
  "/profile",
  auditLog("update", "user"),
  authController.updateProfile
);

router.post("/change-password", authController.changePassword);

module.exports = router;
