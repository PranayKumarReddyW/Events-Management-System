import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, Info, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamCapacityIndicatorProps {
  currentMembers: number;
  maxSize: number;
  minRequired: number;
  isLocked?: boolean;
  className?: string;
}

export function TeamCapacityIndicator({
  currentMembers,
  maxSize,
  minRequired,
  isLocked = false,
  className,
}: TeamCapacityIndicatorProps) {
  const percentage = (currentMembers / maxSize) * 100;
  const remaining = Math.max(0, maxSize - currentMembers);
  const needsMore = currentMembers < minRequired;
  const meetsRequirement =
    currentMembers >= minRequired && currentMembers <= maxSize;
  const isFull = currentMembers >= maxSize;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Capacity
          </span>
          <Badge
            variant={
              isFull ? "destructive" : meetsRequirement ? "default" : "outline"
            }
            className={cn(
              "text-lg px-3 py-1",
              meetsRequirement && "bg-green-600"
            )}
          >
            {currentMembers} / {maxSize}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress
            value={percentage}
            className={cn(
              "h-3",
              isFull && "bg-red-200",
              meetsRequirement && !isFull && "bg-green-200",
              needsMore && "bg-orange-200"
            )}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Min: {minRequired}</span>
            <span>{percentage.toFixed(0)}% filled</span>
            <span>Max: {maxSize}</span>
          </div>
        </div>

        {/* Status Alerts */}
        {needsMore && (
          <Alert
            variant="default"
            className="border-orange-500 bg-orange-50 dark:bg-orange-950/20"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <span className="font-semibold">
                Need {minRequired - currentMembers} more{" "}
                {minRequired - currentMembers === 1 ? "member" : "members"}
              </span>{" "}
              to meet minimum requirement ({minRequired})
            </AlertDescription>
          </Alert>
        )}

        {meetsRequirement && !isFull && !isLocked && (
          <Alert
            variant="default"
            className="border-green-500 bg-green-50 dark:bg-green-950/20"
          >
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700 dark:text-green-400">
              <span className="font-semibold">Team meets requirements!</span>
              {remaining > 0 && (
                <>
                  {" "}
                  You can add {remaining} more{" "}
                  {remaining === 1 ? "member" : "members"}.
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {isFull && (
          <Alert
            variant="default"
            className="border-blue-500 bg-blue-50 dark:bg-blue-950/20"
          >
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700 dark:text-blue-400">
              Team is full. No more members can join.
            </AlertDescription>
          </Alert>
        )}

        {isLocked && (
          <Alert
            variant="default"
            className="border-purple-500 bg-purple-50 dark:bg-purple-950/20"
          >
            <Info className="h-4 w-4 text-purple-600" />
            <AlertDescription className="text-purple-700 dark:text-purple-400">
              Team is locked. No changes can be made to the roster.
            </AlertDescription>
          </Alert>
        )}

        {/* Requirements Summary */}
        <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Minimum members:</span>
            <span className="font-semibold">{minRequired}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Maximum members:</span>
            <span className="font-semibold">{maxSize}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Current members:</span>
            <span className="font-semibold">{currentMembers}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-1 mt-1">
            <span className="text-muted-foreground">Can add:</span>
            <span className="font-semibold">{remaining}</span>
          </div>
        </div>

        {/* Validation Status */}
        <div className="flex items-center gap-2">
          {meetsRequirement ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-600">
                Ready to compete
              </span>
            </>
          ) : needsMore ? (
            <>
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <span className="text-sm font-medium text-orange-600">
                Needs {minRequired - currentMembers} more
              </span>
            </>
          ) : (
            <>
              <Info className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-600">
                Team at capacity
              </span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Compact badge for team cards
export function TeamCapacityBadge({
  currentMembers,
  maxSize,
  minRequired,
  className,
}: {
  currentMembers: number;
  maxSize: number;
  minRequired: number;
  className?: string;
}) {
  const meetsRequirement =
    currentMembers >= minRequired && currentMembers <= maxSize;
  const isFull = currentMembers >= maxSize;
  const needsMore = currentMembers < minRequired;

  return (
    <Badge
      variant={
        isFull
          ? "destructive"
          : meetsRequirement
          ? "default"
          : needsMore
          ? "outline"
          : "outline"
      }
      className={cn(
        meetsRequirement && "bg-green-600 hover:bg-green-700",
        className
      )}
    >
      <Users className="h-3 w-3 mr-1" />
      {currentMembers}/{maxSize}
      {needsMore && ` (Need ${minRequired - currentMembers} more)`}
      {isFull && " (Full)"}
    </Badge>
  );
}

// Progress ring variant
export function TeamCapacityRing({
  currentMembers,
  maxSize,
  minRequired,
  size = 80,
}: {
  currentMembers: number;
  maxSize: number;
  minRequired: number;
  size?: number;
}) {
  const percentage = (currentMembers / maxSize) * 100;
  const meetsRequirement = currentMembers >= minRequired;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (currentMembers >= maxSize) return "#ef4444"; // red
    if (meetsRequirement) return "#22c55e"; // green
    return "#f97316"; // orange
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
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
        <span className="text-lg font-bold">{currentMembers}</span>
        <span className="text-xs text-muted-foreground">/ {maxSize}</span>
      </div>
    </div>
  );
}
