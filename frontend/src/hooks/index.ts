// Centralized hooks exports
export * from "./useAuth";
export * from "./useEvents";
export * from "./useRegistrations";
export * from "./useTeams";
export * from "./useNotifications";
export * from "./useFeedback";
export * from "./useTheme";
export * from "./usePayments";
export * from "./useCertificates";

// Admin analytics hook
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api";
import { QUERY_KEYS } from "@/constants";

export const useAnalytics = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.ADMIN_DASHBOARD],
    queryFn: () => adminApi.getDashboard(),
  });
};

export const useMarkNotificationAsRead = () => ({
  mutateAsync: async (_id: string) => {},
  isPending: false,
});
