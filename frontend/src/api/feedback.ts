import { apiClient } from "./client";
import type { Feedback, Pagination } from "@/types";

export interface CreateFeedbackData {
  eventId: string;
  overallRating: number;
  contentQuality?: number;
  organizationRating?: number;
  venueRating?: number;
  speakerRating?: number;
  comment?: string;
  suggestions?: string;
  wouldRecommend?: boolean;
  anonymous?: boolean;
  isAnonymous?: boolean;
}

export interface UpdateFeedbackData {
  overallRating?: number;
  contentQuality?: number;
  organizationRating?: number;
  venueRating?: number;
  speakerRating?: number;
  comment?: string;
  suggestions?: string;
  wouldRecommend?: boolean;
}

export interface FeedbackFilters {
  status?: string;
  minRating?: number;
  page?: number;
  limit?: number;
}

export interface FeedbackResponse {
  data: Feedback[];
  pagination: Pagination;
  stats?: {
    totalFeedback: number;
    avgOverallRating: number;
    avgContentQuality: number;
    avgOrganizationRating: number;
    avgVenueRating: number;
    avgSpeakerRating: number;
    wouldRecommendCount: number;
    wouldRecommendPercentage: number;
  };
  ratingDistribution?: Array<{
    _id: number;
    count: number;
  }>;
}

export interface FeedbackSummaryResponse {
  totalFeedback: number;
  avgOverallRating: number;
  avgContentQuality: number;
  avgOrganizationRating: number;
  avgVenueRating: number;
  avgSpeakerRating: number;
  ratingDistribution: Array<{
    rating: number;
    count: number;
  }>;
  wouldRecommendCount: number;
  wouldRecommendPercentage: number;
  recentComments: Array<{
    comment: string;
    rating: number;
    submittedBy: string;
    submittedAt: string;
  }>;
}

export const feedbackApi = {
  // Get public feedback for event (public)
  getPublicEventFeedback: async (eventId: string) => {
    return apiClient.get<Feedback[]>(`/feedback/event/${eventId}/public`);
  },

  // Submit feedback
  createFeedback: async (data: CreateFeedbackData) => {
    return apiClient.post<Feedback>("/feedback", data);
  },

  // Get my feedback
  getMyFeedback: async () => {
    return apiClient.get<Feedback[]>("/feedback/my");
  },

  // Get feedback by ID
  getFeedback: async (id: string) => {
    return apiClient.get<Feedback>(`/feedback/${id}`);
  },

  // Update feedback
  updateFeedback: async (id: string, data: UpdateFeedbackData) => {
    return apiClient.put<Feedback>(`/feedback/${id}`, data);
  },

  // Delete feedback
  deleteFeedback: async (id: string) => {
    return apiClient.delete(`/feedback/${id}`);
  },

  // Get event feedback (organizer+)
  getEventFeedback: async (eventId: string, filters?: FeedbackFilters) => {
    return apiClient.get<FeedbackResponse>(
      `/feedback/event/${eventId}`,
      filters
    );
  },

  // Get feedback summary (organizer+)
  getFeedbackSummary: async (eventId: string) => {
    return apiClient.get<FeedbackSummaryResponse>(
      `/feedback/event/${eventId}/summary`
    );
  },

  // Export feedback (organizer+)
  exportFeedback: async (eventId: string, format: "json" | "csv" = "json") => {
    if (format === "csv") {
      return apiClient.downloadFile(
        `/feedback/event/${eventId}/export?format=csv`,
        `feedback-${eventId}.csv`
      );
    }
    return apiClient.get(`/feedback/event/${eventId}/export`, { format });
  },

  // Update feedback status (organizer+)
  updateFeedbackStatus: async (
    id: string,
    status: "pending" | "approved" | "rejected" | "flagged"
  ) => {
    return apiClient.put<Feedback>(`/feedback/${id}/status`, { status });
  },
};
