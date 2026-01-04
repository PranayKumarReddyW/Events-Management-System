import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, Users, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface WaitlistTrackerProps {
  position: number;
  totalWaitlisted: number;
  maxCapacity: number;
  currentRegistered: number;
  className?: string;
}

export function WaitlistTracker({
  position,
  totalWaitlisted,
  maxCapacity,
  currentRegistered,
  className,
}: WaitlistTrackerProps) {
  // Calculate how many spots needed to open up for this user
  const spotsNeeded = position;

  // Calculate progress (closer to position 1 is better)
  const progressValue = Math.max(0, (1 - position / totalWaitlisted) * 100);

  return (
    <Alert
      variant="default"
      className={cn(
        "border-blue-500 border-2 bg-blue-50 dark:bg-blue-950/20",
        className
      )}
    >
      <Clock className="h-5 w-5 text-blue-600" />
      <AlertTitle className="text-lg font-bold text-blue-700 dark:text-blue-400">
        You're on the Waitlist
      </AlertTitle>
      <AlertDescription className="space-y-4 mt-3">
        {/* Position Badge */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Your Position:</span>
          <Badge
            variant="outline"
            className="text-2xl px-6 py-2 border-blue-500 text-blue-700 dark:text-blue-400"
          >
            #{position}
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Position {totalWaitlisted}</span>
            <span>Position 1</span>
          </div>
          <Progress value={progressValue} className="h-2 bg-blue-100" />
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-2">
          <InfoCard
            icon={<Users className="h-4 w-4" />}
            label="Current Capacity"
            value={`${currentRegistered}/${maxCapacity}`}
          />
          <InfoCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Total Waitlisted"
            value={totalWaitlisted.toString()}
          />
        </div>

        {/* Spots Needed */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-blue-200">
          <p className="text-sm text-center">
            <span className="font-semibold text-blue-700 dark:text-blue-400">
              {spotsNeeded} {spotsNeeded === 1 ? "person needs" : "people need"}
            </span>{" "}
            to cancel for you to get in
          </p>
        </div>

        {/* Instructions */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>✓ We'll notify you immediately if a spot opens up</p>
          <p>✓ You have 2 hours to confirm once promoted</p>
          <p>✓ Check your email and notifications regularly</p>
        </div>

        {/* Position Interpretation */}
        {position <= 5 && (
          <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
            <TrendingUp className="h-4 w-4" />
            Good chance of getting in! You're near the front of the waitlist.
          </div>
        )}

        {position > 5 && position <= 15 && (
          <div className="text-sm text-blue-600">
            You're in a decent position. Keep an eye on your notifications.
          </div>
        )}

        {position > 15 && (
          <div className="text-sm text-orange-600">
            You're further back in the waitlist. Consider registering for
            similar events.
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-blue-200">
      <div className="flex items-center gap-2 text-blue-600 mb-1">{icon}</div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

// Badge variant for compact display
export function WaitlistBadge({
  position,
  className,
}: {
  position: number;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("border-blue-500 text-blue-700", className)}
    >
      <Clock className="h-3 w-3 mr-1" />
      Waitlist #{position}
    </Badge>
  );
}
