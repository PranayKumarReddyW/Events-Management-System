/**
 * Analytics Charts Component Type Definitions
 * Fixes FE-006: Analytics charts untyped
 *
 * Purpose: Type-safe analytics charts and data visualization
 */

import { z } from "zod";

// ============================================================================
// Chart Data Types
// ============================================================================

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
 * Time series data point
 */
export const TimeSeriesDataPointSchema = z.object({
  timestamp: z.string().datetime(),
  value: z.number(),
  label: z.string().optional(),
});

export type TimeSeriesDataPoint = z.infer<typeof TimeSeriesDataPointSchema>;

/**
 * Multi-series data point
 */
export const MultiSeriesDataPointSchema = z.object({
  label: z.string(),
  series: z.record(z.string(), z.number()),
});

export type MultiSeriesDataPoint = z.infer<typeof MultiSeriesDataPointSchema>;

// ============================================================================
// Chart Configuration Types
// ============================================================================

/**
 * Chart type enum
 */
export const ChartTypeSchema = z.enum([
  "line",
  "bar",
  "pie",
  "doughnut",
  "area",
  "scatter",
  "radar",
  "histogram",
]);

export type ChartType = z.infer<typeof ChartTypeSchema>;

/**
 * Chart axis configuration
 */
export const ChartAxisConfigSchema = z.object({
  label: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  showGrid: z.boolean().default(true),
  showTicks: z.boolean().default(true),
  tickFormat: z.string().optional(),
  position: z.enum(["left", "right", "top", "bottom"]).optional(),
});

export type ChartAxisConfig = z.infer<typeof ChartAxisConfigSchema>;

/**
 * Chart legend configuration
 */
export const ChartLegendConfigSchema = z.object({
  show: z.boolean().default(true),
  position: z.enum(["top", "bottom", "left", "right"]).default("bottom"),
  align: z.enum(["start", "center", "end"]).default("center"),
});

export type ChartLegendConfig = z.infer<typeof ChartLegendConfigSchema>;

/**
 * Chart tooltip configuration
 */
export const ChartTooltipConfigSchema = z.object({
  enabled: z.boolean().default(true),
  format: z.string().optional(),
  showLabel: z.boolean().default(true),
  showValue: z.boolean().default(true),
});

export type ChartTooltipConfig = z.infer<typeof ChartTooltipConfigSchema>;

/**
 * Full chart configuration
 */
export const ChartConfigSchema = z.object({
  type: ChartTypeSchema,
  title: z.string().optional(),
  subtitle: z.string().optional(),
  xAxis: ChartAxisConfigSchema.optional(),
  yAxis: ChartAxisConfigSchema.optional(),
  legend: ChartLegendConfigSchema.optional(),
  tooltip: ChartTooltipConfigSchema.optional(),
  colors: z.array(z.string()).optional(),
  responsive: z.boolean().default(true),
  animation: z.boolean().default(true),
  stacked: z.boolean().default(false),
});

export type ChartConfig = z.infer<typeof ChartConfigSchema>;

// ============================================================================
// Analytics Chart Types
// ============================================================================

/**
 * Registration trend chart data
 */
export const RegistrationTrendChartSchema = z.object({
  type: z.literal("line"),
  data: z.array(TimeSeriesDataPointSchema),
  config: ChartConfigSchema,
});

export type RegistrationTrendChart = z.infer<
  typeof RegistrationTrendChartSchema
>;

/**
 * Event category distribution chart
 */
export const CategoryDistributionChartSchema = z.object({
  type: z.literal("pie"),
  data: z.array(ChartDataPointSchema),
  config: ChartConfigSchema,
});

export type CategoryDistributionChart = z.infer<
  typeof CategoryDistributionChartSchema
>;

/**
 * Revenue trend chart
 */
export const RevenueTrendChartSchema = z.object({
  type: z.literal("bar"),
  data: z.array(TimeSeriesDataPointSchema),
  config: ChartConfigSchema,
});

export type RevenueTrendChart = z.infer<typeof RevenueTrendChartSchema>;

/**
 * User engagement chart (multi-series)
 */
export const UserEngagementChartSchema = z.object({
  type: z.literal("line"),
  data: z.array(MultiSeriesDataPointSchema),
  config: ChartConfigSchema,
});

export type UserEngagementChart = z.infer<typeof UserEngagementChartSchema>;

// ============================================================================
// Export Configuration
// ============================================================================

/**
 * Chart export format
 */
export const ChartExportFormatSchema = z.enum([
  "png",
  "jpg",
  "svg",
  "pdf",
  "csv",
]);

export type ChartExportFormat = z.infer<typeof ChartExportFormatSchema>;

/**
 * Chart export options
 */
export const ChartExportOptionsSchema = z.object({
  format: ChartExportFormatSchema,
  filename: z.string(),
  width: z.number().int().min(100).optional(),
  height: z.number().int().min(100).optional(),
  includeTitle: z.boolean().default(true),
  includeLegend: z.boolean().default(true),
});

export type ChartExportOptions = z.infer<typeof ChartExportOptionsSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate default chart colors
 */
export const getDefaultChartColors = (): string[] => {
  return [
    "#3b82f6", // blue
    "#10b981", // green
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#f97316", // orange
  ];
};

/**
 * Format chart value based on type
 */
export const formatChartValue = (
  value: number,
  type: "number" | "currency" | "percentage"
): string => {
  switch (type) {
    case "currency":
      return `₹${value.toLocaleString("en-IN")}`;
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "number":
    default:
      return value.toLocaleString();
  }
};

/**
 * Convert time series data to chart format
 */
export const convertToTimeSeriesChart = (
  data: TimeSeriesDataPoint[],
  config?: Partial<ChartConfig>
): RegistrationTrendChart => {
  return {
    type: "line",
    data,
    config: {
      type: "line" as const,
      responsive: true,
      animation: true,
      stacked: false,
      colors: getDefaultChartColors(),
      ...config,
    },
  };
};

/**
 * Convert category data to pie chart format
 */
export const convertToPieChart = (
  data: ChartDataPoint[],
  config?: Partial<ChartConfig>
): CategoryDistributionChart => {
  return {
    type: "pie",
    data,
    config: {
      type: "pie" as const,
      responsive: true,
      animation: true,
      stacked: false,
      colors: getDefaultChartColors(),
      ...config,
    },
  };
};

/**
 * Calculate chart dimensions based on container
 */
export const calculateChartDimensions = (
  containerWidth: number,
  containerHeight: number,
  aspectRatio: number = 2
): { width: number; height: number } => {
  const width = containerWidth;
  const height = Math.min(containerHeight, width / aspectRatio);
  return { width, height };
};

/**
 * Aggregate data by time period
 */
export const aggregateByTimePeriod = (
  data: TimeSeriesDataPoint[],
  period: "hour" | "day" | "week" | "month"
): TimeSeriesDataPoint[] => {
  const grouped = new Map<string, number>();

  data.forEach((point) => {
    const date = new Date(point.timestamp);
    let key: string;

    switch (period) {
      case "hour":
        key = `${date.toISOString().slice(0, 13)}:00:00.000Z`;
        break;
      case "day":
        key = date.toISOString().slice(0, 10) + "T00:00:00.000Z";
        break;
      case "week": {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().slice(0, 10) + "T00:00:00.000Z";
        break;
      }
      case "month":
        key = date.toISOString().slice(0, 7) + "-01T00:00:00.000Z";
        break;
      default:
        key = date.toISOString();
    }

    grouped.set(key, (grouped.get(key) || 0) + point.value);
  });

  return Array.from(grouped.entries())
    .map(([timestamp, value]) => ({
      timestamp,
      value,
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
};

/**
 * Calculate moving average
 */
export const calculateMovingAverage = (
  data: TimeSeriesDataPoint[],
  windowSize: number = 7
): TimeSeriesDataPoint[] => {
  if (data.length < windowSize) return data;

  return data.map((_, index) => {
    if (index < windowSize - 1) {
      return data[index];
    }

    const window = data.slice(index - windowSize + 1, index + 1);
    const average =
      window.reduce((sum, point) => sum + point.value, 0) / windowSize;

    return {
      ...data[index],
      value: Number(average.toFixed(2)),
    };
  });
};

/**
 * Type guard for chart data point
 */
export const isChartDataPoint = (obj: unknown): obj is ChartDataPoint => {
  try {
    ChartDataPointSchema.parse(obj);
    return true;
  } catch {
    return false;
  }
};

/**
 * Type guard for time series data point
 */
export const isTimeSeriesDataPoint = (
  obj: unknown
): obj is TimeSeriesDataPoint => {
  try {
    TimeSeriesDataPointSchema.parse(obj);
    return true;
  } catch {
    return false;
  }
};
