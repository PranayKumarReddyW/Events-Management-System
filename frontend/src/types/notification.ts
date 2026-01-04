/**
 * Notification System Type Definitions
 * Fixes FE-002: Notification system untyped
 *
 * Purpose: Type-safe notification management and real-time updates
 */

import { z } from "zod";

// ============================================================================
// Notification Core Types
// ============================================================================

/**
 * Notification type enumeration
 */
export const NotificationTypeSchema = z.enum([
  "event_created",
  "event_updated",
  "event_cancelled",
  "registration_confirmed",
  "registration_cancelled",
  "payment_success",
  "payment_failed",
  "payment_refunded",
  "team_invite",
  "team_joined",
  "team_left",
  "round_started",
  "round_completed",
  "result_published",
  "certificate_generated",
  "announcement",
  "reminder",
  "approval_request",
  "approval_granted",
  "approval_rejected",
  "system",
]);

export type NotificationType = z.infer<typeof NotificationTypeSchema>;

/**
 * Notification priority levels
 */
export const NotificationPrioritySchema = z.enum([
  "low",
  "normal",
  "high",
  "urgent",
]);

export type NotificationPriority = z.infer<typeof NotificationPrioritySchema>;

/**
 * Notification action button
 */
export const NotificationActionSchema = z.object({
  label: z.string(),
  url: z.string().optional(),
  action: z.string().optional(),
  variant: z
    .enum(["default", "primary", "success", "warning", "danger"])
    .optional(),
});

export type NotificationAction = z.infer<typeof NotificationActionSchema>;

/**
 * Complete notification schema
 */
export const NotificationSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  type: NotificationTypeSchema,
  priority: NotificationPrioritySchema.default("normal"),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  read: z.boolean().default(false),
  metadata: z.record(z.string(), z.any()).optional(),
  actions: z.array(NotificationActionSchema).optional(),
  relatedEvent: z.string().optional(),
  relatedRegistration: z.string().optional(),
  relatedTeam: z.string().optional(),
  icon: z.string().optional(),
  imageUrl: z.string().url().optional(),
  expiresAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Notification = z.infer<typeof NotificationSchema>;

// ============================================================================
// Notification List & Filtering
// ============================================================================

/**
 * Notification filter options
 */
export const NotificationFilterSchema = z.object({
  type: NotificationTypeSchema.optional(),
  priority: NotificationPrioritySchema.optional(),
  read: z.boolean().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
});

export type NotificationFilter = z.infer<typeof NotificationFilterSchema>;

/**
 * Notification list response
 */
export const NotificationListResponseSchema = z.object({
  notifications: z.array(NotificationSchema),
  total: z.number().int().min(0),
  unreadCount: z.number().int().min(0),
  page: z.number().int().min(1),
  pages: z.number().int().min(0),
  limit: z.number().int().min(1),
});

export type NotificationListResponse = z.infer<
  typeof NotificationListResponseSchema
>;

// ============================================================================
// Notification Preferences
// ============================================================================

/**
 * Notification channel preferences
 */
export const NotificationChannelSchema = z.object({
  inApp: z.boolean().default(true),
  email: z.boolean().default(false),
  push: z.boolean().default(false),
  sms: z.boolean().default(false),
});

export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

/**
 * User notification preferences
 */
export const NotificationPreferencesSchema = z.object({
  userId: z.string(),
  channels: NotificationChannelSchema,
  types: z.record(NotificationTypeSchema, z.boolean()),
  quietHours: z
    .object({
      enabled: z.boolean(),
      startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
      endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    })
    .optional(),
  mutedUntil: z.string().datetime().optional(),
});

export type NotificationPreferences = z.infer<
  typeof NotificationPreferencesSchema
>;

// ============================================================================
// Real-time Notification Events
// ============================================================================

/**
 * WebSocket notification event
 */
export const NotificationEventSchema = z.object({
  type: z.enum(["new", "updated", "deleted", "marked_read", "marked_unread"]),
  notification: NotificationSchema.optional(),
  notificationId: z.string().optional(),
  unreadCount: z.number().int().min(0),
  timestamp: z.string().datetime(),
});

export type NotificationEvent = z.infer<typeof NotificationEventSchema>;

// ============================================================================
// Notification Creation
// ============================================================================

/**
 * Create notification request
 */
export const CreateNotificationRequestSchema = z.object({
  userId: z.string(),
  type: NotificationTypeSchema,
  priority: NotificationPrioritySchema.optional(),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  metadata: z.record(z.string(), z.any()).optional(),
  actions: z.array(NotificationActionSchema).optional(),
  relatedEvent: z.string().optional(),
  relatedRegistration: z.string().optional(),
  relatedTeam: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type CreateNotificationRequest = z.infer<
  typeof CreateNotificationRequestSchema
>;

// ============================================================================
// Notification Templates
// ============================================================================

/**
 * Notification template for common scenarios
 */
export interface NotificationTemplate {
  type: NotificationType;
  getTitleAndMessage: (data: Record<string, any>) => {
    title: string;
    message: string;
  };
  getActions?: (data: Record<string, any>) => NotificationAction[];
  priority?: NotificationPriority;
}

/**
 * Common notification templates
 */
export const NotificationTemplates: Record<
  NotificationType,
  NotificationTemplate
> = {
  event_created: {
    type: "event_created",
    getTitleAndMessage: (data) => ({
      title: "New Event Created",
      message: `${data.eventTitle} has been created and is now available for registration.`,
    }),
    getActions: (data) => [
      { label: "View Event", url: `/events/${data.eventId}` },
    ],
    priority: "normal",
  },
  event_updated: {
    type: "event_updated",
    getTitleAndMessage: (data) => ({
      title: "Event Updated",
      message: `${data.eventTitle} has been updated. Please check the latest details.`,
    }),
    getActions: (data) => [
      { label: "View Changes", url: `/events/${data.eventId}` },
    ],
  },
  registration_confirmed: {
    type: "registration_confirmed",
    getTitleAndMessage: (data) => ({
      title: "Registration Confirmed",
      message: `Your registration for ${data.eventTitle} has been confirmed!`,
    }),
    getActions: (_data) => [
      { label: "View Registration", url: `/registrations` },
    ],
    priority: "high",
  },
  payment_success: {
    type: "payment_success",
    getTitleAndMessage: (data) => ({
      title: "Payment Successful",
      message: `Your payment of ₹${data.amount} for ${data.eventTitle} has been processed successfully.`,
    }),
    getActions: (data) => [
      { label: "View Receipt", url: `/payments/${data.paymentId}` },
    ],
    priority: "high",
  },
  team_invite: {
    type: "team_invite",
    getTitleAndMessage: (data) => ({
      title: "Team Invitation",
      message: `You've been invited to join ${data.teamName} for ${data.eventTitle}.`,
    }),
    getActions: (data) => [
      { label: "View Team", url: `/teams/${data.teamId}`, variant: "primary" },
    ],
    priority: "normal",
  },
  // Add remaining templates...
  event_cancelled: {
    type: "event_cancelled",
    getTitleAndMessage: () => ({ title: "", message: "" }),
  },
  registration_cancelled: {
    type: "registration_cancelled",
    getTitleAndMessage: () => ({ title: "", message: "" }),
  },
  payment_failed: {
    type: "payment_failed",
    getTitleAndMessage: () => ({ title: "", message: "" }),
  },
  payment_refunded: {
    type: "payment_refunded",
    getTitleAndMessage: () => ({ title: "", message: "" }),
  },
  team_joined: {
    type: "team_joined",
    getTitleAndMessage: () => ({ title: "", message: "" }),
  },
  team_left: {
    type: "team_left",
    getTitleAndMessage: () => ({ title: "", message: "" }),
  },
  round_started: {
    type: "round_started",
    getTitleAndMessage: () => ({ title: "", message: "" }),
  },
  round_completed: {
    type: "round_completed",
    getTitleAndMessage: () => ({ title: "", message: "" }),
  },
  result_published: {
    type: "result_published",
    getTitleAndMessage: () => ({ title: "", message: "" }),
  },
  certificate_generated: {
    type: "certificate_generated",
    getTitleAndMessage: () => ({ title: "", message: "" }),
  },
  announcement: {
    type: "announcement",
    getTitleAndMessage: () => ({ title: "", message: "" }),
  },
  reminder: {
    type: "reminder",
    getTitleAndMessage: () => ({ title: "", message: "" }),
  },
  approval_request: {
    type: "approval_request",
    getTitleAndMessage: () => ({ title: "", message: "" }),
  },
  approval_granted: {
    type: "approval_granted",
    getTitleAndMessage: () => ({ title: "", message: "" }),
  },
  approval_rejected: {
    type: "approval_rejected",
    getTitleAndMessage: () => ({ title: "", message: "" }),
  },
  system: {
    type: "system",
    getTitleAndMessage: () => ({ title: "", message: "" }),
  },
};

// ============================================================================
// Validation Functions
// ============================================================================

export const validateNotification = (data: unknown) => {
  return NotificationSchema.parse(data);
};

export const validateNotificationList = (data: unknown) => {
  return NotificationListResponseSchema.parse(data);
};

export const validateNotificationPreferences = (data: unknown) => {
  return NotificationPreferencesSchema.parse(data);
};

// ============================================================================
// Type Guards
// ============================================================================

export const isNotification = (data: unknown): data is Notification => {
  return NotificationSchema.safeParse(data).success;
};

export const isNotificationEvent = (
  data: unknown
): data is NotificationEvent => {
  return NotificationEventSchema.safeParse(data).success;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get notification icon by type
 */
export const getNotificationIcon = (type: NotificationType): string => {
  const iconMap: Record<NotificationType, string> = {
    event_created: "calendar-plus",
    event_updated: "calendar-edit",
    event_cancelled: "calendar-x",
    registration_confirmed: "check-circle",
    registration_cancelled: "x-circle",
    payment_success: "credit-card",
    payment_failed: "alert-circle",
    payment_refunded: "rotate-ccw",
    team_invite: "users",
    team_joined: "user-plus",
    team_left: "user-minus",
    round_started: "play-circle",
    round_completed: "check-square",
    result_published: "trophy",
    certificate_generated: "award",
    announcement: "megaphone",
    reminder: "bell",
    approval_request: "help-circle",
    approval_granted: "thumbs-up",
    approval_rejected: "thumbs-down",
    system: "settings",
  };

  return iconMap[type] || "bell";
};

/**
 * Get notification color by priority
 */
export const getNotificationColor = (
  priority: NotificationPriority
): string => {
  const colorMap: Record<NotificationPriority, string> = {
    low: "text-gray-600",
    normal: "text-blue-600",
    high: "text-orange-600",
    urgent: "text-red-600",
  };

  return colorMap[priority] || colorMap.normal;
};

/**
 * Format notification time
 */
export const formatNotificationTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800)
    return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString();
};
