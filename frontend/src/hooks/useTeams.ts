import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  teamsApi,
  type TeamFilters,
  type CreateTeamData,
  type UpdateTeamData,
  type JoinTeamData,
  type AddMemberData,
  type TransferLeadershipData,
} from "@/api";
import { QUERY_KEYS } from "@/constants";

export function useTeam(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.TEAM_DETAIL, id],
    queryFn: () => teamsApi.getTeam(id),
    enabled: !!id,
  });
}

export function useEventTeams(eventId: string, filters?: TeamFilters) {
  return useQuery({
    queryKey: [QUERY_KEYS.EVENT_TEAMS, eventId, filters],
    queryFn: () => teamsApi.getEventTeams(eventId, filters),
    enabled: !!eventId,
  });
}

export function useMyTeams(enabled: boolean = true) {
  return useQuery({
    queryKey: [QUERY_KEYS.MY_TEAMS],
    queryFn: () => teamsApi.getMyTeams(),
    enabled,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTeamData) => teamsApi.createTeam(data),
    onSuccess: () => {
      // Invalidate my teams query - removing exact flag to ensure it works
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.MY_TEAMS],
      });
    },
  });
}

export function useJoinTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: JoinTeamData) => teamsApi.joinTeam(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.MY_TEAMS],
      });
    },
  });
}

export function useLeaveTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => teamsApi.leaveTeam(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.MY_TEAMS],
      });
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTeamData }) =>
      teamsApi.updateTeam(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.MY_TEAMS],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TEAM_DETAIL, variables.id],
      });
    },
  });
}

export function useAddTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AddMemberData }) =>
      teamsApi.addMember(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TEAM_DETAIL, variables.id],
      });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MY_TEAMS] });
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      teamsApi.removeMember(id, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TEAM_DETAIL, variables.id],
      });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MY_TEAMS] });
    },
  });
}

export function useTransferLeadership() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransferLeadershipData }) =>
      teamsApi.transferLeadership(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.TEAM_DETAIL, variables.id],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.MY_TEAMS],
      });
    },
  });
}

export function useLockTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => teamsApi.lockTeam(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TEAM_DETAIL, id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MY_TEAMS] });
    },
  });
}

export function useUnlockTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => teamsApi.unlockTeam(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TEAM_DETAIL, id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MY_TEAMS] });
    },
  });
}

export function useDisbandTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => teamsApi.disbandTeam(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.MY_TEAMS],
      });
    },
  });
}
