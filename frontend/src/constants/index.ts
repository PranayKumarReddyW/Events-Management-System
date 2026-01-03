export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
export const API_VERSION = "/api/v1";
export const API_URL = `${API_BASE_URL}${API_VERSION}`;

// Storage keys
export const TOKEN_KEY = "auth_token";
export const SESSION_KEY = "session_id";
export const USER_KEY = "user_data";

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 10;
export const DEFAULT_PAGE = 1;

// Date formats
export const DATE_FORMAT = "MMM dd, yyyy";
export const DATETIME_FORMAT = "MMM dd, yyyy HH:mm";
export const TIME_FORMAT = "HH:mm";

// File upload
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_IMAGES = 5;
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
];

// Payment gateways
export const PAYMENT_GATEWAYS = {
  STRIPE: "stripe",
  RAZORPAY: "razorpay",
} as const;

// Query keys for React Query
export const QUERY_KEYS = {
  // Auth
  AUTH_ME: "auth-me",

  // Events
  EVENTS: "events",
  EVENT_DETAIL: "event-detail",
  MY_EVENTS: "my-events",

  // Registrations
  REGISTRATIONS: "registrations",
  MY_REGISTRATIONS: "my-registrations",
  EVENT_REGISTRATIONS: "event-registrations",
  REGISTRATION_DETAIL: "registration-detail",

  // Teams
  TEAMS: "teams",
  MY_TEAMS: "my-teams",
  TEAM_DETAIL: "team-detail",
  EVENT_TEAMS: "event-teams",

  // Payments
  PAYMENTS: "payments",
  MY_PAYMENTS: "my-payments",
  PAYMENT_DETAIL: "payment-detail",
  EVENT_PAYMENTS: "event-payments",
  PAYMENT_STATS: "payment-stats",

  // Certificates
  CERTIFICATES: "certificates",
  MY_CERTIFICATES: "my-certificates",
  CERTIFICATE_DETAIL: "certificate-detail",
  EVENT_CERTIFICATES: "event-certificates",
  CERTIFICATE_VERIFY: "certificate-verify",
  CERTIFICATE_STATS: "certificate-stats",

  // Feedback
  FEEDBACK: "feedback",
  MY_FEEDBACK: "my-feedback",
  EVENT_FEEDBACK: "event-feedback",
  FEEDBACK_DETAIL: "feedback-detail",
  FEEDBACK_SUMMARY: "feedback-summary",

  // Notifications
  NOTIFICATIONS: "notifications",
  NOTIFICATION_PREFERENCES: "notification-preferences",
  SENT_NOTIFICATIONS: "sent-notifications",
  NOTIFICATION_STATS: "notification-stats",

  // Attendance
  ATTENDANCE: "attendance",
  MY_ATTENDANCE: "my-attendance",
  EVENT_ATTENDANCE: "event-attendance",
  ATTENDANCE_STATS: "attendance-stats",

  // Analytics
  ANALYTICS_DASHBOARD: "analytics-dashboard",
  ANALYTICS_EVENT: "analytics-event",
  ANALYTICS_COMPARE: "analytics-compare",
  ANALYTICS_USERS: "analytics-users",
  ANALYTICS_PERFORMANCE: "analytics-performance",

  // Admin
  ADMIN_DASHBOARD: "admin-dashboard",
  ADMIN_USERS: "admin-users",
  ADMIN_EVENTS: "admin-events",
  ADMIN_AUDIT_LOGS: "admin-audit-logs",
  ADMIN_SETTINGS: "admin-settings",
  ADMIN_PERMISSIONS: "admin-permissions",
  ADMIN_STATISTICS: "admin-statistics",
  ADMIN_HEALTH: "admin-health",
} as const;

// Role-based permissions
export const ROLES = {
  STUDENT: "student",
  ORGANIZER: "organizer",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
  FACULTY: "faculty",
  CLUB_LEAD: "club_lead",
} as const;

export const ROLE_HIERARCHY = {
  student: 0,
  faculty: 1,
  club_lead: 2,
  organizer: 3,
  admin: 4,
  super_admin: 5,
} as const;

// Event configuration
export const EVENT_TYPES = [
  { value: "workshop", label: "Workshop" },
  { value: "seminar", label: "Seminar" },
  { value: "competition", label: "Competition" },
  { value: "hackathon", label: "Hackathon" },
  { value: "conference", label: "Conference" },
  { value: "webinar", label: "Webinar" },
  { value: "meetup", label: "Meetup" },
  { value: "other", label: "Other" },
] as const;

export const EVENT_MODES = [
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "hybrid", label: "Hybrid" },
] as const;

export const EVENT_VISIBILITY = [
  { value: "public", label: "Public" },
  { value: "private", label: "Private" },
  { value: "department_only", label: "Department Only" },
  { value: "club_only", label: "Club Only" },
] as const;

export const EVENT_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
] as const;

// Registration statuses
export const REGISTRATION_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "waitlisted", label: "Waitlisted" },
  { value: "cancelled", label: "Cancelled" },
  { value: "rejected", label: "Rejected" },
] as const;

// Alias for backward compatibility
export const REGISTRATION_STATUS = REGISTRATION_STATUSES;
export const EVENT_STATUS = EVENT_STATUSES;

// Payment statuses
export const PAYMENT_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "refund_pending", label: "Refund Pending" },
  { value: "refunded", label: "Refunded" },
  { value: "not_required", label: "Not Required" },
] as const;

// Notification channels
export const NOTIFICATION_CHANNELS = [
  { value: "in_app", label: "In-App" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "push", label: "Push" },
] as const;

// Notification priorities
export const NOTIFICATION_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
] as const;

// Rating scales
export const RATING_LABELS = {
  1: "Very Poor",
  2: "Poor",
  3: "Average",
  4: "Good",
  5: "Excellent",
} as const;

// Export formats
export const EXPORT_FORMATS = [
  { value: "json", label: "JSON" },
  { value: "csv", label: "CSV" },
] as const;

// Analytics periods
export const ANALYTICS_PERIODS = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "1y", label: "Last Year" },
] as const;

// Academic years
export const ACADEMIC_YEARS = [
  { value: "1", label: "1st Year" },
  { value: "2", label: "2nd Year" },
  { value: "3", label: "3rd Year" },
  { value: "4", label: "4th Year" },
  { value: "5", label: "5th Year" },
] as const;

// Departments
export const DEPARTMENTS = [
  { value: "Computer Science", label: "Computer Science" },
  {
    value: "Electronics and Communication",
    label: "Electronics and Communication",
  },
  { value: "Electrical Engineering", label: "Electrical Engineering" },
  { value: "Mechanical Engineering", label: "Mechanical Engineering" },
  { value: "Civil Engineering", label: "Civil Engineering" },
  { value: "Information Technology", label: "Information Technology" },
  { value: "Chemical Engineering", label: "Chemical Engineering" },
  { value: "Biotechnology", label: "Biotechnology" },
  { value: "Aerospace Engineering", label: "Aerospace Engineering" },
  { value: "Industrial Engineering", label: "Industrial Engineering" },
  { value: "Automobile Engineering", label: "Automobile Engineering" },
  { value: "Artificial Intelligence", label: "Artificial Intelligence" },
  { value: "Data Science", label: "Data Science" },
  { value: "Cyber Security", label: "Cyber Security" },
  { value: "Robotics", label: "Robotics" },
  { value: "Other", label: "Other" },
] as const;
