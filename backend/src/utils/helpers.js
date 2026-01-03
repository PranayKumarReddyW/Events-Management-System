const moment = require("moment");

// Format date
exports.formatDate = (date, format = "YYYY-MM-DD") => {
  return moment(date).format(format);
};

// Check if date is in past
exports.isPastDate = (date) => {
  return moment(date).isBefore(moment());
};

// Check if date is in future
exports.isFutureDate = (date) => {
  return moment(date).isAfter(moment());
};

// Get date range
exports.getDateRange = (startDate, endDate) => {
  const start = moment(startDate);
  const end = moment(endDate);
  const dates = [];

  while (start.isSameOrBefore(end)) {
    dates.push(start.format("YYYY-MM-DD"));
    start.add(1, "day");
  }

  return dates;
};

// Paginate results
exports.paginate = (page = 1, limit = 10) => {
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  return {
    skip,
    limit: limitNum,
    page: pageNum,
  };
};

// Build pagination response
exports.buildPaginationResponse = (data, total, page, limit) => {
  return {
    data,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
};

// Generate random string
exports.generateRandomString = (length = 32) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Generate OTP
exports.generateOTP = (length = 6) => {
  return Math.floor(
    Math.pow(10, length - 1) + Math.random() * 9 * Math.pow(10, length - 1)
  ).toString();
};

// Validate email
exports.isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone
exports.isValidPhone = (phone) => {
  const phoneRegex = /^[0-9]{10}$/;
  return phoneRegex.test(phone);
};

// Sanitize filename
exports.sanitizeFilename = (filename) => {
  return filename.replace(/[^a-zA-Z0-9.-]/g, "_");
};

// Get file extension
exports.getFileExtension = (filename) => {
  return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
};

// Format file size
exports.formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

// Deep clone object
exports.deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

// Remove undefined values from object
exports.removeUndefined = (obj) => {
  const newObj = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) {
      newObj[key] = obj[key];
    }
  });
  return newObj;
};

// Capitalize first letter
exports.capitalize = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Generate slug from string
exports.generateSlug = (str) => {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

// Calculate percentage
exports.calculatePercentage = (value, total) => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};

// Get time ago string
exports.timeAgo = (date) => {
  return moment(date).fromNow();
};

// Check if event is ongoing
exports.isEventOngoing = (startDate, endDate) => {
  const now = moment();
  return now.isBetween(moment(startDate), moment(endDate));
};

// Check if event is upcoming
exports.isEventUpcoming = (startDate) => {
  return moment(startDate).isAfter(moment());
};

// Check if event is past
exports.isEventPast = (endDate) => {
  return moment(endDate).isBefore(moment());
};

// Generate unique ID
exports.generateUniqueId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Sleep function
exports.sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Chunk array
exports.chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

// Remove duplicates from array
exports.removeDuplicates = (array) => {
  return [...new Set(array)];
};

// Sort array of objects by key
exports.sortByKey = (array, key, order = "asc") => {
  return array.sort((a, b) => {
    if (order === "asc") {
      return a[key] > b[key] ? 1 : -1;
    } else {
      return a[key] < b[key] ? 1 : -1;
    }
  });
};

module.exports = exports;
