import { apiClient } from "./client";
import type { Team, Pagination } from "@/types";

export interface TeamFilters {
  status?: "active" | "locked" | "disbanded";
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateTeamData {
  name: string;
  eventId: string;
  description?: string;
}

export interface UpdateTeamData {
  name?: string;
  description?: string;
}

export interface JoinTeamData {
  inviteCode: string;
}

export interface AddMemberData {
  userId: string;
}

export interface TransferLeadershipData {
  newLeaderId: string;
}

export interface TeamsResponse {
  success: boolean;
  data: Team[];
  pagination?: Pagination;
}

export interface TeamResponse {
  success: boolean;
  data: Team;
  message?: string;
}

export const teamsApi = {
  // Get team by ID (public)
  getTeam: async (id: string) => {
    return apiClient.get<TeamResponse>(`/teams/${id}`);
  },

  // Get teams for event (public)
  getEventTeams: async (eventId: string, filters?: TeamFilters) => {
    return apiClient.get<TeamsResponse>(`/teams/event/${eventId}`, filters);
  },

  // Create team (protected)
  createTeam: async (data: CreateTeamData) => {
    return apiClient.post<TeamResponse>("/teams", data);
  },

  // Get my teams (protected)
  getMyTeams: async () => {
    return apiClient.get<TeamsResponse>("/teams/my");
  },

  // Join team with invite code (protected)
  joinTeam: async (data: JoinTeamData) => {
    return apiClient.post<TeamResponse>("/teams/join", data);
  },

  // Leave team (protected)
  leaveTeam: async (id: string) => {
    return apiClient.post(`/teams/${id}/leave`);
  },

  // Update team (leader only)
  updateTeam: async (id: string, data: UpdateTeamData) => {
    return apiClient.put<TeamResponse>(`/teams/${id}`, data);
  },

  // Add team member (leader only)
  addMember: async (id: string, data: AddMemberData) => {
    return apiClient.post<TeamResponse>(`/teams/${id}/members`, data);
  },

  // Remove team member (leader or self)
  removeMember: async (id: string, userId: string) => {
    return apiClient.delete<TeamResponse>(`/teams/${id}/members/${userId}`);
  },

  // Transfer leadership (leader only)
  transferLeadership: async (id: string, data: TransferLeadershipData) => {
    return apiClient.put<TeamResponse>(
      `/teams/${id}/transfer-leadership`,
      data
    );
  },

  // Lock team (leader only)
  lockTeam: async (id: string) => {
    return apiClient.put<TeamResponse>(`/teams/${id}/lock`);
  },

  // Unlock team (leader only)
  unlockTeam: async (id: string) => {
    return apiClient.put<TeamResponse>(`/teams/${id}/unlock`);
  },

  // Disband team (leader only)
  disbandTeam: async (id: string) => {
    return apiClient.delete(`/teams/${id}`);
  },

  // Get event teams with full details (public)
  getEventTeamsWithDetails: async (
    eventId: string,
    filters?: {
      status?: string;
      round?: number;
      eliminated?: boolean;
      sortBy?: "rank" | "score" | "round" | "createdAt";
      order?: "asc" | "desc";
    }
  ) => {
    return apiClient.get(`/teams/event/${eventId}/details`, filters);
  },

  // Advance teams to next round (organizer only)
  advanceTeamsToNextRound: async (
    eventId: string,
    data: {
      teamIds: string[];
      eliminate?: boolean;
    }
  ) => {
    return apiClient.post(`/teams/event/${eventId}/advance-round`, data);
  },

  // Update team scores (organizer only)
  updateTeamScores: async (
    eventId: string,
    data: {
      scores: Array<{ teamId: string; score?: number; rank?: number }>;
    }
  ) => {
    return apiClient.post(`/teams/event/${eventId}/update-scores`, data);
  },

  // Update event current round (organizer only)
  updateEventCurrentRound: async (
    eventId: string,
    data: {
      roundNumber: number;
    }
  ) => {
    return apiClient.put(`/teams/event/${eventId}/current-round`, data);
  },
};
