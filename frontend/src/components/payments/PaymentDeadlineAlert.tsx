import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, CreditCard, Clock } from "lucide-react";
import { CountdownTimer } from "@/components/shared/CountdownTimer";
import { addHours } from "date-fns";

interface PaymentDeadlineAlertProps {
  registrationDate: Date | string;
  paymentDeadlineHours?: number;
  onPayNow: () => void;
  onExpire?: () => void;
  amount?: number;
  currency?: string;
  className?: string;
}

export function PaymentDeadlineAlert({
  registrationDate,
  paymentDeadlineHours = 24,
  onPayNow,
  onExpire,
  amount,
  currency = "INR",
  className,
}: PaymentDeadlineAlertProps) {
  const deadline = addHours(new Date(registrationDate), paymentDeadlineHours);

  return (
    <Alert
      variant="destructive"
      className={`border-2 border-red-500 bg-red-50 dark:bg-red-950/20 ${
        className || ""
      }`}
    >
      <AlertCircle className="h-5 w-5" />
      <AlertTitle className="text-lg font-bold text-red-700 dark:text-red-400 mb-3">
        Payment Required Within {paymentDeadlineHours} Hours
      </AlertTitle>
      <AlertDescription className="space-y-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border-2 border-red-200">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Clock className="h-4 w-4" />
            <span>Time Remaining:</span>
          </div>
          <CountdownTimer
            targetDate={deadline}
            onExpire={onExpire}
            variant="urgent"
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
            ⚠️ Your registration will be automatically cancelled if payment is
            not completed in time.
          </p>
          {amount && (
            <p className="text-sm text-muted-foreground">
              Amount to pay: {currency} {amount.toFixed(2)}
            </p>
          )}
        </div>

        <Button
          size="lg"
          variant="default"
          className="w-full"
          onClick={onPayNow}
        >
          <CreditCard className="mr-2 h-5 w-5" />
          Complete Payment Now
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Registration created: {new Date(registrationDate).toLocaleString()}
        </p>
      </AlertDescription>
    </Alert>
  );
}

// Compact version for cards
export function PaymentDeadlineBadge({
  registrationDate,
  paymentDeadlineHours = 24,
  className,
}: {
  registrationDate: Date | string;
  paymentDeadlineHours?: number;
  className?: string;
}) {
  const deadline = addHours(new Date(registrationDate), paymentDeadlineHours);
  const now = new Date();
  const hoursRemaining = Math.max(
    0,
    (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
  );

  if (hoursRemaining === 0) {
    return (
      <div className="text-xs text-red-600 font-semibold animate-pulse">
        Payment Expired
      </div>
    );
  }

  return (
    <div className={className}>
      <CountdownTimer targetDate={deadline} variant="compact" />
      {hoursRemaining < 6 && (
        <p className="text-xs text-red-600 font-semibold mt-1">
          Payment deadline approaching!
        </p>
      )}
    </div>
  );
}
