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

// Placeholder exports for missing hooks
export const useAnalytics = () => ({
  data: {
    data: {
      totalEvents: 0,
      totalRegistrations: 0,
      totalRevenue: 0,
      attendanceRate: 0,
      activeUsers: 0,
      certificatesIssued: 0,
      topEvents: [],
      revenueByType: [],
    },
  },
  isLoading: false,
});
export const useMarkNotificationAsRead = () => ({
  mutateAsync: async (_id: string) => {},
  isPending: false,
});
