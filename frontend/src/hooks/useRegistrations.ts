import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  registrationsApi,
  type RegistrationFilters,
  type CreateRegistrationData,
  type UpdateRegistrationStatusData,
  type CancelRegistrationData,
  type BulkCheckinData,
} from "@/api";
import { QUERY_KEYS } from "@/constants";

export function useMyRegistrations(filters?: RegistrationFilters) {
  return useQuery({
    queryKey: [QUERY_KEYS.MY_REGISTRATIONS, filters],
    queryFn: () => registrationsApi.getMyRegistrations(filters),
  });
}

export function useRegistration(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.REGISTRATION_DETAIL, id],
    queryFn: () => registrationsApi.getRegistration(id),
    enabled: !!id,
  });
}

export function useEventRegistrations(
  eventId: string,
  filters?: RegistrationFilters,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: [QUERY_KEYS.EVENT_REGISTRATIONS, eventId, filters],
    queryFn: () => registrationsApi.getEventRegistrations(eventId, filters),
    enabled: !!eventId && enabled,
  });
}

export function useCreateRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRegistrationData) =>
      registrationsApi.createRegistration(data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.MY_REGISTRATIONS],
      });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EVENTS] });
      // Only invalidate the specific event that was registered for
      if (variables.eventId) {
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.EVENT_DETAIL, variables.eventId],
        });
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.EVENT_REGISTRATIONS, variables.eventId],
        });
      }
    },
  });
}

export function useCancelRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: CancelRegistrationData }) =>
      registrationsApi.cancelRegistration(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.MY_REGISTRATIONS],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.REGISTRATION_DETAIL, variables.id],
      });
    },
  });
}

export function useUpdateRegistrationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateRegistrationStatusData;
    }) => registrationsApi.updateRegistrationStatus(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.EVENT_REGISTRATIONS],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.REGISTRATION_DETAIL, variables.id],
      });
    },
  });
}

export function useCheckinParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => registrationsApi.checkinParticipant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.EVENT_REGISTRATIONS],
      });
    },
  });
}

export function useBulkCheckin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BulkCheckinData) => registrationsApi.bulkCheckin(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.EVENT_REGISTRATIONS],
      });
    },
  });
}
