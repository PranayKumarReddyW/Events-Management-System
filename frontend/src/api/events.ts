import { apiClient } from "./client";
import type { Event, Pagination } from "@/types";

// EDGE CASE: Transform function with null checks
const transformEvent = (event: any): Event => {
  if (!event) return event;

  return {
    ...event,
    startDate: event.startDateTime || event.startDate,
    endDate: event.endDateTime || event.endDate,
    registrationFee: event.amount || event.registrationFee || 0,
    registrationCount: event.registeredCount || event.registrationCount || 0,
    teamEvent: (event.maxTeamSize || 0) > 1,
    organizer: event.organizerId || event.organizer,
  };
};

export interface EventFilters {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  eventType?: string;
  status?: string;
  visibility?: string;
  eventMode?: "online" | "offline" | "hybrid";
  mode?: "online" | "offline" | "hybrid";
  registrationStatus?: "open" | "closed";
  teamType?: "solo" | "team";
  isPaid?: boolean;
  startDate?: string;
  endDate?: string;
  departmentId?: string;
  clubId?: string;
  sortBy?: string;
  order?: "asc" | "desc";
}

export interface CreateEventData {
  title: string;
  description: string;
  rules?: string;
  registrationDeadline: string;
  startDateTime: string;
  endDateTime: string;
  venue?: string;
  eventMode: "online" | "offline" | "hybrid";
  meetingLink?: string;
  eventType: string;
  minTeamSize: number;
  maxTeamSize: number;
  requiresApproval?: boolean;
  isPaid?: boolean;
  amount?: number;
  currency?: string;
  eligibility?: string;
  maxParticipants?: number;
  clubId?: string;
  departmentId?: string;
  visibility: string;
  certificateProvided?: boolean;
  registrationsOpen?: boolean;
}

export interface EventsResponse {
  events: Event[];
  pagination: Pagination;
}

export const eventsApi = {
  // Get all events (public)
  getEvents: async (filters?: EventFilters) => {
    const response = await apiClient.get<EventsResponse>("/events", filters);

    // NULL CHECK: Handle empty or missing data
    if (!response.data || !response.data.events) {
      return {
        ...response,
        data: {
          events: [],
          pagination: response.data?.pagination || {
            total: 0,
            page: 1,
            pages: 0,
            limit: 10,
          },
        },
      };
    }

    return {
      ...response,
      data: {
        ...response.data,
        events: response.data.events.map(transformEvent),
      },
    };
  },

  // Get event by ID or slug (public)
  getEvent: async (id: string) => {
    const response = await apiClient.get<{ event: Event }>(`/events/${id}`);

    // NULL CHECK: Handle missing event data
    if (!response.data || !response.data.event) {
      return response;
    }

    return {
      ...response,
      data: {
        event: transformEvent(response.data.event),
      },
    };
  },

  // Get my events (protected)
  getMyEvents: async (page?: number, limit?: number) => {
    const response = await apiClient.get<EventsResponse>("/events/my/events", {
      page,
      limit,
    });
    if (!response.data) return response;
    return {
      ...response,
      data: {
        ...response.data,
        events: response.data.events.map(transformEvent),
      },
    };
  },

  // Create event (organizer+)
  createEvent: async (data: CreateEventData | FormData, images?: File[]) => {
    // If data is already FormData, use it directly
    if (data instanceof FormData) {
      return apiClient.postFormData<Event>("/events", data);
    }

    const formData = new FormData();

    // Append all event data
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(
          key,
          typeof value === "object" ? JSON.stringify(value) : String(value)
        );
      }
    });

    // Append images if any
    if (images && images.length > 0) {
      images.forEach((image) => {
        formData.append("images", image);
      });
    }

    return apiClient.postFormData<Event>("/events", formData);
  },

  // Update event (protected)
  updateEvent: async (
    id: string,
    data: Partial<CreateEventData> | FormData,
    images?: File[]
  ) => {
    // If data is already FormData, use it directly
    if (data instanceof FormData) {
      return apiClient.putFormData<Event>(`/events/${id}`, data);
    }

    const formData = new FormData();

    // Append all event data
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(
          key,
          typeof value === "object" ? JSON.stringify(value) : String(value)
        );
      }
    });

    // Append images if any
    if (images && images.length > 0) {
      images.forEach((image) => {
        formData.append("images", image);
      });
    }

    return apiClient.putFormData<Event>(`/events/${id}`, formData);
  },

  // Delete event (protected)
  deleteEvent: async (id: string) => {
    return apiClient.delete(`/events/${id}`);
  },

  // Publish event (protected)
  publishEvent: async (id: string) => {
    return apiClient.post<{ event: Event }>(`/events/${id}/publish`);
  },

  // Round management
  addRound: async (eventId: string, roundData: any) => {
    console.log("[API] Adding round to event:", eventId);
    console.log("[API] Round data:", roundData);
    const response = await apiClient.post(
      `/events/${eventId}/rounds`,
      roundData
    );
    console.log("[API] Add round response:", response);
    return response;
  },

  updateRound: async (eventId: string, roundId: string, roundData: any) => {
    return apiClient.put(`/events/${eventId}/rounds/${roundId}`, roundData);
  },

  deleteRound: async (eventId: string, roundId: string) => {
    return apiClient.delete(`/events/${eventId}/rounds/${roundId}`);
  },

  advanceParticipants: async (
    eventId: string,
    roundNumber: number,
    participantIds: string[]
  ) => {
    return apiClient.post(`/events/${eventId}/rounds/${roundNumber}/advance`, {
      participantIds,
    });
  },

  getRoundParticipants: async (eventId: string, roundNumber: number) => {
    return apiClient.get(
      `/events/${eventId}/rounds/${roundNumber}/participants`
    );
  },

  getRoundStats: async (eventId: string) => {
    return apiClient.get(`/events/${eventId}/rounds/stats`);
  },

  // Result management
  addResults: async (eventId: string, results: any[]) => {
    return apiClient.post(`/events/${eventId}/results`, { results });
  },

  getResults: async (eventId: string) => {
    return apiClient.get(`/events/${eventId}/results`);
  },

  publishResults: async (eventId: string) => {
    return apiClient.post(`/events/${eventId}/results/publish`, {});
  },

  deleteResult: async (eventId: string, resultId: string) => {
    return apiClient.delete(`/events/${eventId}/results/${resultId}`);
  },
};
