import { apiClient } from "./client";
import type {
  User,
  Event,
  AuditLog,
  Settings,
  RolePermission,
  Pagination,
} from "@/types";

export interface AdminDashboardResponse {
  overview: {
    totalUsers: number;
    totalEvents: number;
    totalRegistrations: number;
    totalRevenue: number;
  };
  distributions: {
    eventsByStatus: Array<{
      _id: string;
      count: number;
    }>;
    usersByRole: Array<{
      _id: string;
      count: number;
    }>;
  };
  recent: {
    users: User[];
    events: Event[];
    payments: any[];
  };
}

export interface UsersFilters {
  role?: string;
  department?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface EventsFilters {
  status?: string;
  eventType?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogsFilters {
  action?: string;
  resource?: string;
  performedBy?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface UpdateUserRoleData {
  role: string;
}

export interface UpdateUserStatusData {
  isActive: boolean;
}

export interface UpdateSettingData {
  value: any;
  category?: string;
  description?: string;
}

export interface UpdatePermissionsData {
  role?: string;
  permissions: string[];
  description?: string;
}

export interface AdminStatisticsResponse {
  period: string;
  users: {
    new: number;
    total: number;
    growthRate: number;
  };
  events: {
    new: number;
    total: number;
    active: number;
  };
  registrations: {
    new: number;
    total: number;
  };
  revenue: {
    amount: number;
    transactions: number;
  };
  certificates: number;
  feedback: {
    count: number;
    avgRating: number;
  };
  dailyActivity: Array<{
    _id: string;
    newUsers: number;
  }>;
}

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  services: {
    database: {
      status: string;
      readyState: number;
    };
    redis: {
      status: string;
    };
  };
  system: {
    uptime: number;
    memory: any;
    nodeVersion: string;
  };
}

export interface GenerateReportFilters {
  startDate: string;
  endDate: string;
  format?: "json";
}

export interface ReportResponse {
  generatedAt: string;
  period: {
    startDate: string;
    endDate: string;
  };
  users: any;
  events: any;
  registrations: any;
  revenue: any;
  certificates: any;
  feedback: any;
}

export const adminApi = {
  // Get admin dashboard
  getDashboard: async () => {
    return apiClient.get<AdminDashboardResponse>("/admin/dashboard");
  },

  // User management
  getAllUsers: async (filters?: UsersFilters) => {
    return apiClient.get<{ users: User[]; pagination: Pagination }>(
      "/admin/users",
      filters
    );
  },

  getUsers: async (filters?: UsersFilters) => {
    return apiClient.get<{ data: User[]; pagination: Pagination }>(
      "/admin/users",
      filters
    );
  },

  updateUser: async (id: string, data: any) => {
    return apiClient.put<{ user: User }>(`/admin/users/${id}`, data);
  },

  updateUserRole: async (id: string, data: UpdateUserRoleData) => {
    return apiClient.put<User>(`/admin/users/${id}/role`, data);
  },

  updateUserStatus: async (id: string, data: UpdateUserStatusData) => {
    return apiClient.put<User>(`/admin/users/${id}/status`, data);
  },

  deleteUser: async (id: string) => {
    return apiClient.delete(`/admin/users/${id}`);
  },

  cleanupInactiveUsers: async (daysInactive: number = 365) => {
    return apiClient.delete("/admin/users/inactive/cleanup", {
      params: { daysInactive },
    });
  },

  // Event management
  getEvents: async (filters?: EventsFilters) => {
    return apiClient.get<{ data: Event[]; pagination: Pagination }>(
      "/admin/events",
      filters
    );
  },

  deleteEvent: async (id: string) => {
    return apiClient.delete(`/admin/events/${id}`);
  },

  // Audit logs
  getAuditLogs: async (filters?: AuditLogsFilters) => {
    return apiClient.get<{ data: AuditLog[]; pagination: Pagination }>(
      "/admin/audit-logs",
      filters
    );
  },

  // Settings management
  getSettings: async (category?: string) => {
    return apiClient.get<Record<string, Record<string, any>>>(
      "/admin/settings",
      category ? { category } : undefined
    );
  },

  updateSetting: async (key: string, data: UpdateSettingData) => {
    return apiClient.put<Settings>(`/admin/settings/${key}`, data);
  },

  // Permissions management
  getPermissions: async () => {
    return apiClient.get<RolePermission[]>("/admin/permissions");
  },

  updatePermissions: async (roleId: string, data: UpdatePermissionsData) => {
    return apiClient.put<RolePermission>(`/admin/permissions/${roleId}`, data);
  },

  // Statistics
  getStatistics: async (period: "7d" | "30d" | "90d" | "1y" = "30d") => {
    return apiClient.get<AdminStatisticsResponse>("/admin/statistics", {
      period,
    });
  },

  // Health check
  getHealth: async () => {
    return apiClient.get<HealthCheckResponse>("/admin/health");
  },

  // Cache management
  clearCache: async () => {
    return apiClient.post("/admin/cache/clear");
  },

  // Generate reports
  generateReport: async (filters: GenerateReportFilters) => {
    return apiClient.get<ReportResponse>("/admin/reports/generate", filters);
  },
};
