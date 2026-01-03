import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  notificationsApi,
  type NotificationFilters,
  type CreateNotificationData,
  type BulkNotifyEventData,
} from "@/api";
import { QUERY_KEYS } from "@/constants";

export function useMyNotifications(filters?: NotificationFilters) {
  return useQuery({
    queryKey: [QUERY_KEYS.NOTIFICATIONS, filters],
    queryFn: () => notificationsApi.getMyNotifications(filters),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: [QUERY_KEYS.NOTIFICATION_PREFERENCES],
    queryFn: () => notificationsApi.getPreferences(),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notificationsApi.updatePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.NOTIFICATION_PREFERENCES],
      });
    },
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATIONS] });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATIONS] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationsApi.deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATIONS] });
    },
  });
}

export function useCreateNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateNotificationData) =>
      notificationsApi.createNotification(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.SENT_NOTIFICATIONS],
      });
    },
  });
}

export function useBulkNotifyEvent() {
  return useMutation({
    mutationFn: ({
      eventId,
      data,
    }: {
      eventId: string;
      data: BulkNotifyEventData;
    }) => notificationsApi.bulkNotifyEvent(eventId, data),
  });
}
