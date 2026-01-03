require("dotenv").config();
const app = require("./app");
const connectDatabase = require("./config/database");
const { connectRedis } = require("./config/redis");
const logger = require("./utils/logger");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5000;

// Create required directories
const directories = [
  "logs",
  "uploads",
  "uploads/certificates",
  "uploads/events",
  "uploads/profiles",
  "uploads/documents",
];

directories.forEach((dir) => {
  const dirPath = path.join(__dirname, "..", dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.info(`Created directory: ${dir}`);
  }
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION! 💥 Shutting down...");
  logger.error(err.name, err.message);
  logger.error(err.stack);
  process.exit(1);
});

// Connect to database
connectDatabase()
  .then(() => {
    logger.info("Database connection successful");
  })
  .catch((err) => {
    logger.error("Database connection failed:", err);
    process.exit(1);
  });

// Connect to Redis
const redis = connectRedis();
if (redis) {
  logger.info("Redis connection initialized");
} else {
  logger.warn("Redis connection failed, running without cache");
}

// Start server
const server = app.listen(PORT, () => {
  logger.info("=".repeat(50));
  logger.info(`🚀 Server running in ${process.env.NODE_ENV} mode`);
  logger.info(`📡 Listening on port ${PORT}`);
  logger.info(`🌐 API Base URL: http://localhost:${PORT}/api/v1`);
  logger.info(`📊 Health Check: http://localhost:${PORT}/health`);
  logger.info("=".repeat(50));
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error("UNHANDLED REJECTION! 💥 Shutting down...");
  logger.error(err.name, err.message);
  logger.error(err.stack);

  server.close(() => {
    process.exit(1);
  });
});

// Handle SIGTERM signal
process.on("SIGTERM", () => {
  logger.info("👋 SIGTERM RECEIVED. Shutting down gracefully");

  server.close(() => {
    logger.info("💥 Process terminated!");
  });
});

// Handle SIGINT signal (Ctrl+C)
process.on("SIGINT", () => {
  logger.info("👋 SIGINT RECEIVED. Shutting down gracefully");

  server.close(() => {
    logger.info("💥 Process terminated!");
    process.exit(0);
  });
});

module.exports = server;
