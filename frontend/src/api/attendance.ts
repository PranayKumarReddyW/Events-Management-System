import { apiClient } from "./client";
import type { Attendance, Pagination } from "@/types";

export interface AttendanceFilters {
  page?: number;
  limit?: number;
}

export interface MyAttendanceResponse {
  data: Attendance[];
  stats: {
    totalEvents: number;
    totalDuration: number;
    avgDuration: number;
  };
  pagination: Pagination;
}

export interface SelfCheckinData {
  qrData: string;
  location?: string;
}

export interface CheckinData {
  eventId: string;
  userId: string;
  method?: "manual" | "qr";
  location?: string;
  deviceInfo?: Record<string, any>;
  qrCode?: string;
}

export interface CheckoutData {
  eventId: string;
  userId: string;
}

export interface BulkCheckinData {
  eventId: string;
  userIds: string[];
}

export interface BulkCheckinResponse {
  success: string[];
  failed: Array<{
    userId: string;
    reason: string;
  }>;
}

export interface EventAttendanceResponse {
  data: Attendance[];
  stats: {
    totalCheckIns: number;
    activeCheckIns: number;
    completedSessions: number;
    avgDuration: number;
  };
  methodStats: Array<{
    _id: "manual" | "qr";
    count: number;
  }>;
  pagination: Pagination;
}

export interface QRCodeResponse {
  qrCode: string;
  qrData: string;
  event: {
    id: string;
    title: string;
  };
}

export interface AttendanceReportResponse {
  summary: {
    eventTitle: string;
    totalRegistrations: number;
    totalAttendance: number;
    attendanceRate: string;
    avgDuration: number;
  };
  attendance: Array<{
    name: string;
    email: string;
    phone: string;
    department: string;
    rollNumber: string;
    checkInTime: string;
    checkOutTime: string | "";
    duration: number;
    method: "manual" | "qr";
  }>;
}

export interface UpdateAttendanceData {
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
}

export interface AttendanceStatsResponse {
  overall: {
    totalCheckIns: number;
    avgDuration: number;
    totalDuration: number;
  };
  byMethod: Array<{
    _id: "manual" | "qr";
    count: number;
  }>;
  topEvents: Array<{
    eventTitle: string;
    count: number;
  }>;
}

export const attendanceApi = {
  // Get my attendance
  getMyAttendance: async (filters?: AttendanceFilters) => {
    return apiClient.get<MyAttendanceResponse>("/attendance/my", filters);
  },

  // Self check-in with QR
  selfCheckin: async (data: SelfCheckinData) => {
    return apiClient.post<Attendance>("/attendance/self-checkin", data);
  },

  // Check-in participant (organizer+)
  checkin: async (data: CheckinData) => {
    return apiClient.post<Attendance>("/attendance/checkin", data);
  },

  // Check-out participant (organizer+)
  checkout: async (data: CheckoutData) => {
    return apiClient.post<Attendance>("/attendance/checkout", data);
  },

  // Bulk check-in (organizer+)
  bulkCheckin: async (data: BulkCheckinData) => {
    return apiClient.post<BulkCheckinResponse>(
      "/attendance/bulk-checkin",
      data
    );
  },

  // Get event attendance (organizer+)
  getEventAttendance: async (eventId: string, filters?: AttendanceFilters) => {
    return apiClient.get<EventAttendanceResponse>(
      `/attendance/event/${eventId}`,
      filters
    );
  },

  // Generate event QR code (organizer+)
  generateQRCode: async (eventId: string) => {
    return apiClient.get<QRCodeResponse>(`/attendance/event/${eventId}/qrcode`);
  },

  // Get attendance report (organizer+)
  getAttendanceReport: async (
    eventId: string,
    format: "json" | "csv" = "json"
  ) => {
    if (format === "csv") {
      return apiClient.downloadFile(
        `/attendance/event/${eventId}/report?format=csv`,
        `attendance-${eventId}.csv`
      );
    }
    return apiClient.get<AttendanceReportResponse>(
      `/attendance/event/${eventId}/report`,
      { format }
    );
  },

  // Update attendance record (organizer+)
  updateAttendance: async (id: string, data: UpdateAttendanceData) => {
    return apiClient.put<Attendance>(`/attendance/${id}`, data);
  },

  // Delete attendance record (admin)
  deleteAttendance: async (id: string) => {
    return apiClient.delete(`/attendance/${id}`);
  },

  // Get attendance stats (admin)
  getStats: async (startDate?: string, endDate?: string) => {
    return apiClient.get<AttendanceStatsResponse>("/attendance/stats", {
      startDate,
      endDate,
    });
  },
};
