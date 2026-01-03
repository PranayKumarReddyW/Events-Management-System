import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentsApi } from "@/api/payments";
import type { PaymentFilters } from "@/api/payments";

export const usePayments = (filters?: PaymentFilters) => {
  return useQuery({
    queryKey: ["payments", filters],
    queryFn: () => paymentsApi.getMyPayments(filters),
  });
};

export const usePayment = (id: string) => {
  return useQuery({
    queryKey: ["payment", id],
    queryFn: () => paymentsApi.getPayment(id),
    enabled: !!id,
  });
};

export const useRequestRefund = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      paymentsApi.requestRefund(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
    },
  });
};

export const useEventPayments = (eventId: string, filters?: PaymentFilters) => {
  return useQuery({
    queryKey: ["eventPayments", eventId, filters],
    queryFn: () => paymentsApi.getEventPayments(eventId, filters),
    enabled: !!eventId,
  });
};
