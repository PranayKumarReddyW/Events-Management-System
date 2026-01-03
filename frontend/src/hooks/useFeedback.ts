import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  feedbackApi,
  type CreateFeedbackData,
  type UpdateFeedbackData,
  type FeedbackFilters,
} from "@/api/feedback";
import { QUERY_KEYS } from "@/constants";

export function useMyFeedback() {
  return useQuery({
    queryKey: [QUERY_KEYS.MY_FEEDBACK],
    queryFn: () => feedbackApi.getMyFeedback(),
  });
}

export function useFeedback(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.FEEDBACK_DETAIL, id],
    queryFn: () => feedbackApi.getFeedback(id),
    enabled: !!id,
  });
}

export function useEventFeedback(eventId: string, filters?: FeedbackFilters) {
  return useQuery({
    queryKey: [QUERY_KEYS.EVENT_FEEDBACK, eventId, filters],
    queryFn: () => feedbackApi.getEventFeedback(eventId, filters),
    enabled: !!eventId,
  });
}

export function useCreateFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFeedbackData) => feedbackApi.createFeedback(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MY_FEEDBACK] });
    },
  });
}

export function useUpdateFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFeedbackData }) =>
      feedbackApi.updateFeedback(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MY_FEEDBACK] });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.FEEDBACK_DETAIL, variables.id],
      });
    },
  });
}

export function useDeleteFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => feedbackApi.deleteFeedback(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MY_FEEDBACK] });
    },
  });
}
