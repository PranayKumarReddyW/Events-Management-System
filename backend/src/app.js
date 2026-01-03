const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const compression = require("compression");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs/promises");
const logger = require("./utils/logger");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimiter");
const { sanitizeInput } = require("./middleware/validation");

const app = express();

// Trust proxy
app.set("trust proxy", 1);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGIN.split(",");
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Data sanitization against NoSQL injection
app.use(mongoSanitize());

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Compression middleware
app.use(compression());

// HTTP request logger
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(
    morgan("combined", {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    })
  );
}

// Input sanitization
app.use(sanitizeInput);

// Rate limiting for API routes
// app.use("/api", apiLimiter);

// Serve static files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// API version info
app.get("/api", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Event Management System API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/v1/auth",
      events: "/api/v1/events",
      registrations: "/api/v1/registrations",
      teams: "/api/v1/teams",
      payments: "/api/v1/payments",
      certificates: "/api/v1/certificates",
      feedback: "/api/v1/feedback",
      analytics: "/api/v1/analytics",
      admin: "/api/v1/admin",
    },
  });
});

// API docs (markdown)
app.get("/api/docs", async (req, res) => {
  try {
    const docsPath = path.join(__dirname, "../API.md");
    const content = await fs.readFile(docsPath, "utf8");

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    return res.status(200).send(content);
  } catch (error) {
    logger.error("Failed to load API docs:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load API documentation",
    });
  }
});

// API Routes
const routes = require("./routes");
app.use("/api/v1", routes);

// Convenience redirect (keeps the docs URL stable)
app.get("/api/v1/docs", (req, res) => res.redirect(302, "/api/docs"));

// 404 handler - must be after all routes
app.use(notFound);

// Global error handler - must be last
app.use(errorHandler);

module.exports = app;
