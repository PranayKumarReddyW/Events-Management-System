import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface CapacityIndicatorProps {
  current: number;
  max: number;
  variant?: "default" | "compact" | "detailed";
  showWaitlistWarning?: boolean;
  className?: string;
}

export function CapacityIndicator({
  current,
  max,
  variant = "default",
  showWaitlistWarning = true,
  className,
}: CapacityIndicatorProps) {
  const percentage = (current / max) * 100;
  const remaining = Math.max(0, max - current);
  const isFull = current >= max;
  const isAlmostFull = percentage > 80 && !isFull;

  if (variant === "compact") {
    return (
      <Badge
        variant={isFull ? "destructive" : isAlmostFull ? "default" : "outline"}
        className={cn("gap-1", className)}
      >
        <Users className="h-3 w-3" />
        {current}/{max}
      </Badge>
    );
  }

  if (variant === "detailed") {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="font-semibold">Registration Capacity</span>
          </div>
          <Badge
            variant={
              isFull ? "destructive" : isAlmostFull ? "default" : "outline"
            }
            className="text-base px-3 py-1"
          >
            {current} / {max}
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{current} registered</span>
            <span>{percentage.toFixed(0)}% filled</span>
          </div>
          <Progress
            value={percentage}
            className={cn(
              "h-3",
              percentage > 90 && "bg-red-200",
              percentage > 80 && percentage <= 90 && "bg-orange-200"
            )}
          />
        </div>

        {isFull && showWaitlistWarning && (
          <Alert
            variant="default"
            className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Event is full. New registrations will be added to the waitlist.
            </AlertDescription>
          </Alert>
        )}

        {isAlmostFull && !isFull && (
          <p className="text-sm text-orange-600 font-medium">
            ⚠️ Only {remaining} {remaining === 1 ? "spot" : "spots"} remaining!
          </p>
        )}

        {percentage <= 50 && (
          <p className="text-sm text-green-600">
            ✓ {remaining} spots available
          </p>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between text-sm">
        <span className="font-medium">
          {current} / {max} registered
        </span>
        <span className="text-muted-foreground">{percentage.toFixed(0)}%</span>
      </div>
      <Progress
        value={percentage}
        className={cn(
          percentage > 90 && "bg-red-200",
          percentage > 80 && percentage <= 90 && "bg-orange-200"
        )}
      />
      {isAlmostFull && !isFull && (
        <p className="text-xs text-orange-600">
          Only {remaining} {remaining === 1 ? "spot" : "spots"} left!
        </p>
      )}
    </div>
  );
}

// Badge variant for event cards
export function CapacityBadge({
  current,
  max,
  className,
}: {
  current: number;
  max: number;
  className?: string;
}) {
  const remaining = Math.max(0, max - current);
  const isFull = current >= max;
  const percentage = (current / max) * 100;
  const isAlmostFull = percentage > 80 && !isFull;

  if (isFull) {
    return (
      <Badge variant="destructive" className={cn("font-semibold", className)}>
        FULL
      </Badge>
    );
  }

  if (isAlmostFull) {
    return (
      <Badge
        variant="default"
        className={cn("bg-orange-500 hover:bg-orange-600", className)}
      >
        {remaining} {remaining === 1 ? "spot" : "spots"} left
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={className}>
      <Users className="h-3 w-3 mr-1" />
      {current}/{max}
    </Badge>
  );
}

// Circular gauge variant
export function CapacityGauge({
  current,
  max,
  size = 100,
  strokeWidth = 8,
  className,
}: {
  current: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const percentage = Math.min((current / max) * 100, 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (percentage >= 100) return "#ef4444"; // red
    if (percentage >= 80) return "#f97316"; // orange
    if (percentage >= 50) return "#eab308"; // yellow
    return "#22c55e"; // green
  };

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className
      )}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor()}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-lg font-bold">{current}</span>
        <span className="text-xs text-muted-foreground">/ {max}</span>
      </div>
    </div>
  );
}
