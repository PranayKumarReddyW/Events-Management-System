import { apiClient } from "./client";
import type { EventRegistration, Pagination } from "@/types";
import type { BulkCheckinData } from "./attendance";

export interface RegistrationFilters {
  status?: string;
  paymentStatus?: string;
  eventMode?: string;
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  yearOfStudy?: number;
}

export interface CreateRegistrationData {
  eventId: string;
  teamId?: string;
  emergencyContact?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
  specialRequirements?: string;
  participantInfo?: Record<string, any>;
}

export interface UpdateRegistrationStatusData {
  status: "pending" | "confirmed" | "waitlisted" | "cancelled" | "rejected";
  notes?: string;
}

export interface CancelRegistrationData {
  reason?: string;
}

// Backend API response for event registrations
export interface RegistrationsApiResponse {
  success: boolean;
  data: EventRegistration[];
  pagination: Pagination;
  stats?: {
    totalRegistrations: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    checkedIn: number;
    paidCount: number;
  };
}

export const registrationsApi = {
  // Get my registrations
  getMyRegistrations: async (filters?: RegistrationFilters) => {
    return apiClient.get<EventRegistration[]>("/registrations/my", filters);
  },

  // Register for event
  createRegistration: async (data: CreateRegistrationData) => {
    return apiClient.post<EventRegistration>("/registrations", data);
  },

  // Get registration by ID
  getRegistration: async (id: string) => {
    return apiClient.get<EventRegistration>(`/registrations/${id}`);
  },

  // Cancel registration
  cancelRegistration: async (id: string, data?: CancelRegistrationData) => {
    return apiClient.put<EventRegistration>(
      `/registrations/${id}/cancel`,
      data
    );
  },

  // Get event registrations (organizer+)
  getEventRegistrations: async (
    eventId: string,
    filters?: RegistrationFilters
  ) => {
    return apiClient.get<RegistrationsApiResponse>(
      `/registrations/event/${eventId}`,
      filters
    );
  },

  // Update registration status (organizer+)
  updateRegistrationStatus: async (
    id: string,
    data: UpdateRegistrationStatusData
  ) => {
    return apiClient.put<EventRegistration>(
      `/registrations/${id}/status`,
      data
    );
  },

  // Check-in participant (organizer+)
  checkinParticipant: async (id: string) => {
    return apiClient.post<EventRegistration>(`/registrations/${id}/checkin`);
  },

  // Bulk check-in (organizer+)
  bulkCheckin: async (data: BulkCheckinData) => {
    return apiClient.post<{ checkedInCount: number }>(
      "/registrations/bulk-checkin",
      data
    );
  },

  // Export registrations (organizer+)
  exportRegistrations: async (
    eventId: string,
    format: "json" | "csv" = "json"
  ) => {
    if (format === "csv") {
      return apiClient.downloadFile(
        `/registrations/event/${eventId}/export?format=csv`,
        `registrations-${eventId}.csv`
      );
    }
    return apiClient.get<EventRegistration[]>(
      `/registrations/event/${eventId}/export`,
      { format }
    );
  },
};
