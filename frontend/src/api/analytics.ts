import { apiClient } from "./client";
import type { Analytics } from "@/types";

export interface TrackAnalyticsData {
  eventType: string;
  metricType: string;
  metricValue: number;
  metadata?: Record<string, any>;
  relatedEvent?: string;
}

export interface EventAnalyticsResponse {
  event: any;
  registrations: {
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    checkedIn: number;
  };
  registrationTimeline: Array<{
    date: string;
    count: number;
  }>;
  payments: {
    totalRevenue: number;
    totalTransactions: number;
    avgTransaction: number;
  };
  paymentTimeline: Array<{
    date: string;
    revenue: number;
  }>;
  feedback: {
    avgRating: number;
    count: number;
  };
  feedbackDistribution: Array<{
    rating: number;
    count: number;
  }>;
  demographics: {
    byDepartment: Array<{
      departmentId: string;
      departmentName: string;
      count: number;
    }>;
    byYear: Array<{
      year: number;
      count: number;
    }>;
  };
  certificates: {
    totalGenerated: number;
    totalDownloaded: number;
  };
  metrics: {
    attendanceRate: number;
    conversionRate: number;
    revenuePerParticipant: number;
  };
}

export interface CompareEventsResponse {
  eventId: string;
  title: string;
  eventType: string;
  date: string;
  capacity: number | null;
  registrations: number;
  revenue: number;
  feedback: number;
  attendanceRate: number;
}

export interface DashboardAnalyticsResponse {
  overview: {
    totalEvents: number;
    totalUsers: number;
    totalRegistrations: number;
    totalRevenue: number;
  };
  trends: {
    eventsGrowth: number;
    usersGrowth: number;
    registrationsGrowth: number;
    revenueGrowth: number;
  };
  topEvents: Array<{
    title: string;
    registrations: number;
    revenue: number;
  }>;
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: string;
  }>;
}

export interface UserAnalyticsResponse {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  byRole: Array<{
    role: string;
    count: number;
  }>;
  byDepartment: Array<{
    department: string;
    count: number;
  }>;
  engagementMetrics: {
    avgEventsPerUser: number;
    avgRegistrationsPerUser: number;
  };
}

export interface PerformanceAnalyticsResponse {
  period: string;
  events: {
    totalEvents: number;
    publishedEvents: number;
    completedEvents: number;
    cancelledEvents: number;
  };
  registrations: {
    total: number;
    confirmed: number;
    cancelled: number;
  };
  payments: {
    total: number;
    successful: number;
    failed: number;
  };
  rates: {
    confirmationRate: number;
    paymentSuccessRate: number;
    eventCompletionRate: number;
  };
}

export interface ExportFilters {
  type?: "events" | "registrations" | "payments" | "feedback" | string;
  startDate?: string;
  endDate?: string;
  format?: "json" | "csv";
}

export const analyticsApi = {
  // Track analytics event
  track: async (data: TrackAnalyticsData) => {
    return apiClient.post<Analytics>("/analytics/track", data);
  },

  // Get event analytics (organizer+)
  getEventAnalytics: async (eventId: string) => {
    return apiClient.get<EventAnalyticsResponse>(
      `/analytics/events/${eventId}`
    );
  },

  // Compare events (organizer+)
  compareEvents: async (eventIds: string[]) => {
    return apiClient.get<CompareEventsResponse[]>("/analytics/compare", {
      eventIds: eventIds.join(","),
    });
  },

  // Export analytics (admin)
  exportAnalytics: async (filters?: ExportFilters) => {
    const format = filters?.format || "json";
    if (format === "csv") {
      return apiClient.downloadFile(
        `/analytics/export?${new URLSearchParams(filters as any).toString()}`,
        `analytics-export.csv`
      );
    }
    return apiClient.get<any[]>("/analytics/export", filters);
  },

  // Get dashboard analytics (admin)
  getDashboardAnalytics: async () => {
    return apiClient.get<DashboardAnalyticsResponse>("/analytics/dashboard");
  },

  // Get user analytics (admin)
  getUserAnalytics: async () => {
    return apiClient.get<UserAnalyticsResponse>("/analytics/users");
  },

  // Get performance analytics (admin)
  getPerformanceAnalytics: async (
    period: "7d" | "30d" | "90d" | "1y" = "30d"
  ) => {
    return apiClient.get<PerformanceAnalyticsResponse>(
      "/analytics/performance",
      { period }
    );
  },
};
