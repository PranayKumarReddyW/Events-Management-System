import { apiClient } from "./client";
import type {
  Notification,
  NotificationPreferences,
  Pagination,
} from "@/types";

export interface NotificationFilters {
  isRead?: boolean;
  type?: string;
  page?: number;
  limit?: number;
}

export interface NotificationsResponse {
  data: Notification[];
  unreadCount: number;
  pagination: Pagination;
}

export interface CreateNotificationData {
  recipients: "all" | string | string[];
  title: string;
  message: string;
  type: string;
  relatedEvent?: string;
  channels: Array<"in_app" | "email" | "sms" | "push">;
  priority?: "low" | "normal" | "high";
  scheduledFor?: string;
}

export interface BulkNotifyEventData {
  title: string;
  message: string;
  channels: Array<"in_app" | "email" | "sms" | "push">;
  status?: "confirmed" | "pending" | "cancelled" | "rejected" | "waitlisted";
}

export interface NotificationStatsResponse {
  overview: {
    total: number;
    read: number;
    unread: number;
  };
  byType: Array<{
    _id: string;
    count: number;
  }>;
  byChannel: Array<{
    _id: "in_app" | "email" | "sms" | "push";
    count: number;
  }>;
  delivery: {
    emailDelivered: number;
    smsDelivered: number;
    emailFailed: number;
    smsFailed: number;
  };
}

export const notificationsApi = {
  // Get my notifications
  getMyNotifications: async (filters?: NotificationFilters) => {
    return apiClient.get<NotificationsResponse>("/notifications/my", filters);
  },

  // Get notification preferences
  getPreferences: async () => {
    return apiClient.get<NotificationPreferences>("/notifications/preferences");
  },

  // Update notification preferences
  updatePreferences: async (preferences: Partial<NotificationPreferences>) => {
    return apiClient.put<NotificationPreferences>(
      "/notifications/preferences",
      preferences
    );
  },

  // Mark notification as read
  markAsRead: async (id: string) => {
    return apiClient.put<Notification>(`/notifications/${id}/read`);
  },

  // Mark all notifications as read
  markAllAsRead: async () => {
    return apiClient.put("/notifications/read-all");
  },

  // Delete notification
  deleteNotification: async (id: string) => {
    return apiClient.delete(`/notifications/${id}`);
  },

  // Delete all notifications
  deleteAllNotifications: async () => {
    return apiClient.delete("/notifications/");
  },

  // Create notification (organizer+)
  createNotification: async (data: CreateNotificationData) => {
    return apiClient.post<Notification[]>("/notifications", data);
  },

  // Bulk notify event participants (organizer+)
  bulkNotifyEvent: async (eventId: string, data: BulkNotifyEventData) => {
    return apiClient.post<{ sent: number }>(
      `/notifications/bulk/event/${eventId}`,
      data
    );
  },

  // Get sent notifications (organizer+)
  getSentNotifications: async (page?: number, limit?: number) => {
    return apiClient.get<{ data: Notification[]; pagination: Pagination }>(
      "/notifications/sent",
      { page, limit }
    );
  },

  // Resend failed notifications (organizer+)
  resendFailed: async () => {
    return apiClient.post("/notifications/resend-failed");
  },

  // Get notification stats (admin)
  getStats: async (startDate?: string, endDate?: string) => {
    return apiClient.get<NotificationStatsResponse>("/notifications/stats", {
      startDate,
      endDate,
    });
  },
};
