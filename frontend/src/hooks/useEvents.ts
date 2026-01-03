import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { eventsApi, type EventFilters, type CreateEventData } from "@/api";
import { QUERY_KEYS } from "@/constants";

export function useEvents(filters?: EventFilters) {
  return useQuery({
    queryKey: [QUERY_KEYS.EVENTS, filters],
    queryFn: () => eventsApi.getEvents(filters),
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.EVENT_DETAIL, id],
    queryFn: () => eventsApi.getEvent(id),
    enabled: !!id,
  });
}

export function useMyEvents(page?: number, limit?: number) {
  return useQuery({
    queryKey: [QUERY_KEYS.MY_EVENTS, page, limit],
    queryFn: () => eventsApi.getMyEvents(page, limit),
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      data,
      images,
    }: {
      data: CreateEventData | FormData;
      images?: File[];
    }) => {
      if (data instanceof FormData) {
        return eventsApi.createEvent(data as any);
      }
      return eventsApi.createEvent(data, images);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EVENTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MY_EVENTS] });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
      images,
    }: {
      id: string;
      data: Partial<CreateEventData> | FormData;
      images?: File[];
    }) => {
      if (data instanceof FormData) {
        return eventsApi.updateEvent(id, data as any);
      }
      return eventsApi.updateEvent(id, data, images);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EVENTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MY_EVENTS] });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.EVENT_DETAIL, variables.id],
      });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => eventsApi.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EVENTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MY_EVENTS] });
    },
  });
}

export function usePublishEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => eventsApi.publishEvent(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EVENTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MY_EVENTS] });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.EVENT_DETAIL, id],
      });
    },
  });
}
