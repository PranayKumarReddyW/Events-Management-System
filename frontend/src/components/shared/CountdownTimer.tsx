import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  targetDate: Date | string;
  onExpire?: () => void;
  variant?: "default" | "urgent" | "compact";
  className?: string;
  showIcon?: boolean;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

export function CountdownTimer({
  targetDate,
  onExpire,
  variant = "default",
  className,
  showIcon = true,
}: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(
    calculateTimeRemaining(targetDate)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = calculateTimeRemaining(targetDate);
      setTimeRemaining(remaining);

      if (remaining.total <= 0 && onExpire) {
        clearInterval(timer);
        onExpire();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, onExpire]);

  if (timeRemaining.total <= 0) {
    return (
      <div className={cn("text-red-600 font-semibold", className)}>Expired</div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-1 text-sm", className)}>
        {showIcon && <Clock className="h-3 w-3" />}
        <span>
          {timeRemaining.days > 0 && `${timeRemaining.days}d `}
          {timeRemaining.hours}h {timeRemaining.minutes}m
        </span>
      </div>
    );
  }

  if (variant === "urgent") {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 p-4 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white",
          timeRemaining.hours < 6 && "animate-pulse",
          className
        )}
      >
        {showIcon && <Clock className="h-5 w-5" />}
        <div className="flex gap-2">
          <TimeUnit value={timeRemaining.days} label="Days" />
          <TimeUnit value={timeRemaining.hours} label="Hours" />
          <TimeUnit value={timeRemaining.minutes} label="Min" />
          <TimeUnit value={timeRemaining.seconds} label="Sec" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("text-center", className)}>
      <div className="flex justify-center gap-3">
        {timeRemaining.days > 0 && (
          <TimeBlock value={timeRemaining.days} label="Days" />
        )}
        <TimeBlock value={timeRemaining.hours} label="Hours" />
        <TimeBlock value={timeRemaining.minutes} label="Minutes" />
        <TimeBlock value={timeRemaining.seconds} label="Seconds" />
      </div>
      {timeRemaining.total < 6 * 60 * 60 * 1000 && (
        <p className="text-sm text-orange-600 mt-2 animate-pulse">
          ⚠️ Hurry! Time is running out
        </p>
      )}
    </div>
  );
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center bg-muted rounded-lg p-3 min-w-[60px]">
      <span className="text-2xl font-bold">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xl font-bold">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-xs opacity-90">{label}</span>
    </div>
  );
}

function calculateTimeRemaining(targetDate: Date | string): TimeRemaining {
  const target = new Date(targetDate).getTime();
  const now = new Date().getTime();
  const total = target - now;

  if (total <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }

  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));

  return { days, hours, minutes, seconds, total };
}
