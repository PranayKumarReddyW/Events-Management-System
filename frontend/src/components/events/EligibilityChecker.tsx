import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Check, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface EligibilityCheckerProps {
  user: {
    department: string;
    yearOfStudy: number;
    isOutsideCollege?: boolean;
  };
  event: {
    eligibleDepartments: string[];
    eligibleYears: number[];
    allowExternalStudents: boolean;
  };
  className?: string;
}

interface EligibilityCheck {
  label: string;
  userValue: string;
  requiredValues: string[];
  eligible: boolean;
}

export function EligibilityChecker({
  user,
  event,
  className,
}: EligibilityCheckerProps) {
  const checks: EligibilityCheck[] = [
    {
      label: "Department",
      userValue: user.department,
      requiredValues: event.eligibleDepartments,
      eligible: event.eligibleDepartments.includes(user.department),
    },
    {
      label: "Year of Study",
      userValue: `Year ${user.yearOfStudy}`,
      requiredValues: event.eligibleYears.map((y) => `Year ${y}`),
      eligible: event.eligibleYears.includes(user.yearOfStudy),
    },
  ];

  // Add external student check if relevant
  if (user.isOutsideCollege !== undefined) {
    checks.push({
      label: "External Students",
      userValue: user.isOutsideCollege ? "External Student" : "College Student",
      requiredValues: [
        event.allowExternalStudents ? "Allowed" : "Only College Students",
      ],
      eligible: !user.isOutsideCollege || event.allowExternalStudents,
    });
  }

  const isFullyEligible = checks.every((check) => check.eligible);

  return (
    <Card
      className={cn(
        "border-l-4",
        isFullyEligible ? "border-l-green-500" : "border-l-red-500",
        className
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4" />
          Eligibility Check
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {checks.map((check, index) => (
          <EligibilityRow key={index} {...check} />
        ))}

        <Separator className="my-2" />

        {/* Overall result */}
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">Status:</span>
          {isFullyEligible ? (
            <Badge
              variant="default"
              className="bg-green-600 hover:bg-green-700 px-3 py-1"
            >
              <Check className="h-3 w-3 mr-1" />
              Eligible
            </Badge>
          ) : (
            <Badge variant="destructive" className="px-3 py-1">
              <X className="h-3 w-3 mr-1" />
              Not Eligible
            </Badge>
          )}
        </div>

        {!isFullyEligible && (
          <div className="flex items-start gap-2 p-2 bg-red-50 rounded-lg text-xs text-red-700">
            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <p>You don't meet the eligibility requirements for this event.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EligibilityRow({
  label,
  userValue,
  requiredValues,
  eligible,
}: EligibilityCheck) {
  return (
    <div className="flex items-center justify-between p-1.5 hover:bg-muted/50 rounded transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-xs text-muted-foreground truncate">
          You: {userValue}
        </p>
        <div className="flex flex-wrap gap-1 mt-0.5">
          <span className="text-xs text-muted-foreground">Required:</span>
          {requiredValues.slice(0, 2).map((value, idx) => (
            <Badge key={idx} variant="outline" className="text-xs px-1 py-0">
              {value}
            </Badge>
          ))}
          {requiredValues.length > 2 && (
            <span className="text-xs text-muted-foreground">
              +{requiredValues.length - 2}
            </span>
          )}
        </div>
      </div>
      <div className="ml-2 flex-shrink-0">
        {eligible ? (
          <Badge
            variant="default"
            className="bg-green-600 hover:bg-green-700 text-xs px-2 py-0.5"
          >
            <Check className="h-3 w-3" />
          </Badge>
        ) : (
          <Badge variant="destructive" className="text-xs px-2 py-0.5">
            <X className="h-3 w-3" />
          </Badge>
        )}
      </div>
    </div>
  );
}

// Compact version for use in cards
export function EligibilityBadge({ isEligible }: { isEligible: boolean }) {
  if (isEligible) {
    return (
      <Badge variant="default" className="bg-green-600 hover:bg-green-700">
        <Check className="h-3 w-3 mr-1" />
        Eligible
      </Badge>
    );
  }

  return (
    <Badge variant="destructive">
      <X className="h-3 w-3 mr-1" />
      Not Eligible
    </Badge>
  );
}
