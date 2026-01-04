/**
 * Dashboard Component Type Definitions
 * Fixes FE-001: Dashboard components untyped
 *
 * Purpose: Type-safe dashboard analytics, stats, and data visualization
 */

import { z } from "zod";

// ============================================================================
// Dashboard Analytics Types
// ============================================================================

/**
 * Overview statistics schema
 */
export const DashboardOverviewSchema = z.object({
  totalEvents: z.number().int().min(0),
  totalUsers: z.number().int().min(0),
  totalRegistrations: z.number().int().min(0),
  activeEvents: z.number().int().min(0),
  upcomingEvents: z.number().int().min(0),
  completedEvents: z.number().int().min(0),
  totalRevenue: z.number().min(0).optional(),
  pendingApprovals: z.number().int().min(0).optional(),
});

export type DashboardOverview = z.infer<typeof DashboardOverviewSchema>;

/**
 * Event statistics by category
 */
export const EventStatsByCategorySchema = z.object({
  category: z.enum([
    "technical",
    "non-technical",
    "cultural",
    "sports",
    "academic",
    "other",
  ]),
  count: z.number().int().min(0),
  registrations: z.number().int().min(0),
  revenue: z.number().min(0).optional(),
});

export type EventStatsByCategory = z.infer<typeof EventStatsByCategorySchema>;

/**
 * Event statistics by status
 */
export const EventStatsByStatusSchema = z.object({
  status: z.enum(["draft", "published", "ongoing", "completed", "cancelled"]),
  count: z.number().int().min(0),
  percentage: z.number().min(0).max(100),
});

export type EventStatsByStatus = z.infer<typeof EventStatsByStatusSchema>;

/**
 * User engagement metrics
 */
export const UserEngagementSchema = z.object({
  totalUsers: z.number().int().min(0),
  activeUsers: z.number().int().min(0),
  newUsersThisMonth: z.number().int().min(0),
  usersByRole: z.record(z.string(), z.number().int().min(0)),
  averageEventsPerUser: z.number().min(0),
});

export type UserEngagement = z.infer<typeof UserEngagementSchema>;

/**
 * Registration trends over time
 */
export const RegistrationTrendSchema = z.object({
  date: z.string(),
  count: z.number().int().min(0),
  revenue: z.number().min(0).optional(),
});

export type RegistrationTrend = z.infer<typeof RegistrationTrendSchema>;

/**
 * Revenue metrics
 */
export const RevenueMetricsSchema = z.object({
  totalRevenue: z.number().min(0),
  pendingPayments: z.number().min(0),
  completedPayments: z.number().min(0),
  refundedAmount: z.number().min(0),
  averageTicketPrice: z.number().min(0),
  revenueByMonth: z.array(
    z.object({
      month: z.string(),
      revenue: z.number().min(0),
    })
  ),
});

export type RevenueMetrics = z.infer<typeof RevenueMetricsSchema>;

/**
 * Popular events list
 */
export const PopularEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  registrations: z.number().int().min(0),
  capacity: z.number().int().min(0).optional(),
  attendanceRate: z.number().min(0).max(100).optional(),
  revenue: z.number().min(0).optional(),
});

export type PopularEvent = z.infer<typeof PopularEventSchema>;

/**
 * Complete dashboard analytics data
 */
export const DashboardAnalyticsSchema = z.object({
  overview: DashboardOverviewSchema,
  eventsByCategory: z.array(EventStatsByCategorySchema),
  eventsByStatus: z.array(EventStatsByStatusSchema),
  userEngagement: UserEngagementSchema,
  registrationTrends: z.array(RegistrationTrendSchema),
  revenueMetrics: RevenueMetricsSchema.optional(),
  popularEvents: z.array(PopularEventSchema),
  lastUpdated: z.string().datetime(),
});

export type DashboardAnalytics = z.infer<typeof DashboardAnalyticsSchema>;

// ============================================================================
// Dashboard Widget Types
// ============================================================================

/**
 * Stat card data
 */
export const StatCardSchema = z.object({
  title: z.string(),
  value: z.union([z.string(), z.number()]),
  change: z.number().optional(),
  changeType: z.enum(["increase", "decrease", "neutral"]).optional(),
  icon: z.string().optional(),
  trend: z.array(z.number()).optional(),
  subtitle: z.string().optional(),
});

export type StatCard = z.infer<typeof StatCardSchema>;

/**
 * Chart data point
 */
export const ChartDataPointSchema = z.object({
  label: z.string(),
  value: z.number(),
  color: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type ChartDataPoint = z.infer<typeof ChartDataPointSchema>;

/**
 * Chart configuration
 */
export const ChartConfigSchema = z.object({
  type: z.enum(["line", "bar", "pie", "doughnut", "area", "scatter"]),
  data: z.array(ChartDataPointSchema),
  title: z.string().optional(),
  xAxisLabel: z.string().optional(),
  yAxisLabel: z.string().optional(),
  showLegend: z.boolean().default(true),
  showGrid: z.boolean().default(true),
  colors: z.array(z.string()).optional(),
});

export type ChartConfig = z.infer<typeof ChartConfigSchema>;

// ============================================================================
// Dashboard Filter Types
// ============================================================================

/**
 * Date range filter
 */
export const DateRangeFilterSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  preset: z
    .enum([
      "today",
      "yesterday",
      "last7days",
      "last30days",
      "thisMonth",
      "lastMonth",
      "thisYear",
      "custom",
    ])
    .optional(),
});

export type DateRangeFilter = z.infer<typeof DateRangeFilterSchema>;

/**
 * Dashboard filters
 */
export const DashboardFiltersSchema = z.object({
  dateRange: DateRangeFilterSchema.optional(),
  eventCategory: z.string().optional(),
  eventStatus: z.string().optional(),
  userRole: z.string().optional(),
  departmentId: z.string().optional(),
  clubId: z.string().optional(),
});

export type DashboardFilters = z.infer<typeof DashboardFiltersSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate dashboard analytics data
 */
export const validateDashboardAnalytics = (data: unknown) => {
  return DashboardAnalyticsSchema.parse(data);
};

/**
 * Validate stat card data
 */
export const validateStatCard = (data: unknown) => {
  return StatCardSchema.parse(data);
};

/**
 * Validate chart configuration
 */
export const validateChartConfig = (data: unknown) => {
  return ChartConfigSchema.parse(data);
};

/**
 * Type guards
 */
export const isDashboardAnalytics = (
  data: unknown
): data is DashboardAnalytics => {
  return DashboardAnalyticsSchema.safeParse(data).success;
};

export const isStatCard = (data: unknown): data is StatCard => {
  return StatCardSchema.safeParse(data).success;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate percentage change
 */
export const calculatePercentageChange = (
  current: number,
  previous: number
): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

/**
 * Format stat value for display
 */
export const formatStatValue = (
  value: number,
  type: "number" | "currency" | "percentage"
): string => {
  switch (type) {
    case "currency":
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
      }).format(value);
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "number":
    default:
      return new Intl.NumberFormat("en-IN").format(value);
  }
};

/**
 * Get trend direction
 */
export const getTrendDirection = (
  change: number
): "increase" | "decrease" | "neutral" => {
  if (change > 0) return "increase";
  if (change < 0) return "decrease";
  return "neutral";
};
