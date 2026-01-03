import { useMyRegistrations } from "@/hooks/useRegistrations";
import { useCancelRegistration } from "@/hooks/useRegistrations";
import { paymentsApi } from "@/api/payments";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Calendar,
  MapPin,
  Eye,
  X,
  Clock,
  Users,
  DollarSign,
  Tag,
  User,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { formatDate, formatDateRange } from "@/utils/date";
import { formatCurrency } from "@/utils/helpers";
import { REGISTRATION_STATUS, EVENT_TYPES } from "@/constants";
import { toast } from "sonner";

export default function MyRegistrationsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
  const { data: registrations, isLoading } = useMyRegistrations(
    statusFilter === "all" ? {} : { status: statusFilter }
  );
  const cancelRegistration = useCancelRegistration();

  const handleCancel = async (registrationId: string) => {
    try {
      await cancelRegistration.mutateAsync({ id: registrationId });
      toast.success("Registration cancelled successfully");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to cancel registration"
      );
    }
  };

  const handlePayment = async (registrationId: string, eventTitle: string) => {
    try {
      setPaymentLoading(registrationId);
      const response = await paymentsApi.initiatePayment({
        registrationId,
        paymentMethod: "razorpay",
      });

      console.log("Payment Response:", response);

      if (!response.data) {
        throw new Error("Invalid payment response");
      }

      const { orderId, amount, currency, key } = response.data;

      console.log("Payment Details:", { orderId, amount, currency, key });

      if (!key) {
        throw new Error(
          "Razorpay key not configured. Please contact administrator."
        );
      }

      // Check if Razorpay script already loaded
      if (typeof (window as any).Razorpay !== "undefined") {
        openRazorpay(key, amount, currency, orderId, eventTitle);
      } else {
        // Load Razorpay script
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        document.body.appendChild(script);

        script.onload = () => {
          openRazorpay(key, amount, currency, orderId, eventTitle);
        };

        script.onerror = () => {
          setPaymentLoading(null);
          toast.error(
            "Failed to load payment gateway. Please check your internet connection."
          );
        };
      }
    } catch (error: any) {
      setPaymentLoading(null);
      console.error("Payment Error:", error);
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to initiate payment"
      );
    }
  };

  const openRazorpay = (
    key: string,
    amount: number,
    currency: string,
    orderId: string,
    eventTitle: string
  ) => {
    const options = {
      key: key,
      amount: amount,
      currency: currency,
      name: "Event Management System",
      description: `Payment for ${eventTitle}`,
      order_id: orderId,
      handler: function (response: any) {
        console.log("Payment Success:", response);
        toast.success("Payment successful!");
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      },
      prefill: {
        name: "",
        email: "",
        contact: "",
      },
      theme: {
        color: "#3b82f6",
      },
      modal: {
        ondismiss: function () {
          setPaymentLoading(null);
          toast.info("Payment cancelled");
        },
        escape: true,
        backdropclose: false,
      },
    };

    try {
      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
      console.log("Razorpay opened successfully");
    } catch (error) {
      setPaymentLoading(null);
      console.error("Failed to open Razorpay:", error);
      toast.error("Failed to open payment gateway");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            My Registrations
          </h1>
          <p className="text-muted-foreground">
            View and manage your event registrations
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {REGISTRATION_STATUS.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : registrations?.data?.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No registrations found</h3>
          <p className="text-muted-foreground">
            You haven't registered for any events yet
          </p>
          <Button asChild className="mt-4">
            <Link to="/events">Browse Events</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {registrations?.data?.map((registration: any) => (
            <Card key={registration._id} className="overflow-hidden">
              <CardHeader className="bg-muted/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-2xl">
                      {registration.event.title}
                    </CardTitle>
                    <CardDescription className="mt-2 text-base">
                      {registration.event.description ||
                        "No description available"}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={
                      registration.status === "confirmed"
                        ? "default"
                        : registration.status === "cancelled"
                        ? "destructive"
                        : registration.status === "waitlist"
                        ? "secondary"
                        : "outline"
                    }
                    className="text-sm px-3 py-1"
                  >
                    {
                      REGISTRATION_STATUS.find(
                        (s) => s.value === registration.status
                      )?.label
                    }
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column - Event Details */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-sm text-muted-foreground mb-3">
                        Event Details
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="font-medium">
                              {registration.event.startDate &&
                              registration.event.endDate
                                ? formatDateRange(
                                    registration.event.startDate,
                                    registration.event.endDate
                                  )
                                : formatDate(
                                    registration.event.startDate || new Date()
                                  )}
                            </p>
                            {registration.event.startDate &&
                              registration.event.endDate && (
                                <p className="text-sm text-muted-foreground">
                                  Duration:{" "}
                                  {(() => {
                                    const duration = Math.ceil(
                                      (new Date(
                                        registration.event.endDate
                                      ).getTime() -
                                        new Date(
                                          registration.event.startDate
                                        ).getTime()) /
                                        (1000 * 60 * 60 * 24)
                                    );
                                    return duration > 0
                                      ? `${duration} day(s)`
                                      : "Same day";
                                  })()}
                                </p>
                              )}
                          </div>
                        </div>

                        {registration.event.venue && (
                          <div className="flex items-start gap-3">
                            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="font-medium">
                                {registration.event.venue}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {registration.event.eventMode === "offline"
                                  ? "In-person event"
                                  : registration.event.eventMode === "online"
                                  ? "Online event"
                                  : "Hybrid event"}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-3">
                          <Tag className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="font-medium">
                              {EVENT_TYPES.find(
                                (t) => t.value === registration.event.eventType
                              )?.label || registration.event.eventType}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Event type
                            </p>
                          </div>
                        </div>

                        {registration.event.organizer && (
                          <div className="flex items-start gap-3">
                            <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="font-medium">
                                {registration.event.organizer.fullName ||
                                  registration.event.organizer.email}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Organized by
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-3">
                          <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="font-medium">
                              {registration.event.maxParticipants
                                ? `${
                                    registration.event.registeredCount || 0
                                  } / ${
                                    registration.event.maxParticipants
                                  } registered`
                                : `${
                                    registration.event.registeredCount || 0
                                  } registered`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Participants
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Registration Details */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-sm text-muted-foreground mb-3">
                        Registration Details
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="font-medium">
                              {formatDate(registration.createdAt)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Registration date
                            </p>
                          </div>
                        </div>

                        {registration.event.isPaid && (
                          <div className="flex items-start gap-3">
                            <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="font-medium">
                                {formatCurrency(
                                  registration.event.registrationFee || 0
                                )}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge
                                  variant={
                                    registration.paymentStatus === "completed"
                                      ? "default"
                                      : registration.paymentStatus === "pending"
                                      ? "secondary"
                                      : "destructive"
                                  }
                                  className="text-xs"
                                >
                                  {registration.paymentStatus ===
                                    "completed" && (
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                  )}
                                  {registration.paymentStatus === "pending" && (
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                  )}
                                  {registration.paymentStatus || "Unpaid"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        )}

                        {registration.checkInTime && (
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                            <div>
                              <p className="font-medium">
                                {formatDate(registration.checkInTime)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Checked in
                              </p>
                            </div>
                          </div>
                        )}

                        {registration.event.requiresApproval && (
                          <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="font-medium">Approval Required</p>
                              <p className="text-sm text-muted-foreground">
                                Waiting for organizer approval
                              </p>
                            </div>
                          </div>
                        )}

                        {registration.event.maxTeamSize > 1 && (
                          <div className="p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
                            <div className="flex items-start gap-3">
                              <Users className="h-5 w-5 text-primary mt-0.5" />
                              <div className="flex-1">
                                <p className="font-semibold text-primary mb-1">
                                  Team Event (
                                  {registration.event.minTeamSize || 1} -{" "}
                                  {registration.event.maxTeamSize} members)
                                </p>
                                <p className="text-sm text-muted-foreground mb-3">
                                  This is a team event. You need to be part of a
                                  team to participate.
                                </p>
                                <div className="space-y-2 text-sm">
                                  <p className="font-medium">
                                    How to participate:
                                  </p>
                                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-2">
                                    <li>
                                      Create a new team or join an existing team
                                    </li>
                                    <li>Get your team to the required size</li>
                                    <li>
                                      Team leader locks the team when ready
                                    </li>
                                  </ol>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {registration.event.eligibility && (
                      <div className="p-3 rounded-lg bg-muted/50 border">
                        <p className="text-sm font-medium mb-1">Eligibility</p>
                        <p className="text-sm text-muted-foreground">
                          {registration.event.eligibility}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
              <Separator />
              <CardFooter className="flex gap-2 pt-4">
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/events/${registration.event._id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Full Event Details
                  </Link>
                </Button>
                {registration.event.maxTeamSize > 1 && (
                  <Button variant="default" size="sm" asChild>
                    <Link to="/teams">
                      <Users className="mr-2 h-4 w-4" />
                      Create/Join Team
                    </Link>
                  </Button>
                )}
                {registration.event.isPaid &&
                  registration.paymentStatus === "pending" && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() =>
                        handlePayment(
                          registration._id,
                          registration.event.title
                        )
                      }
                      disabled={paymentLoading === registration._id}
                    >
                      <DollarSign className="mr-2 h-4 w-4" />
                      {paymentLoading === registration._id
                        ? "Loading..."
                        : "Pay Now"}
                    </Button>
                  )}
                {registration.status === "confirmed" &&
                  new Date(registration.event.startDate) > new Date() &&
                  registration.event.registrationsOpen !== false && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="ml-auto"
                        >
                          <X className="mr-2 h-4 w-4" />
                          Cancel Registration
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Cancel Registration?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to cancel your registration
                            for {registration.event.title}?
                            {registration.event.isPaid &&
                              registration.paymentStatus === "completed" && (
                                <span className="block mt-2 text-yellow-600 dark:text-yellow-500">
                                  Note: Refund processing may take 5-7 business
                                  days.
                                </span>
                              )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>No, keep it</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => handleCancel(registration._id)}
                          >
                            Yes, cancel
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
