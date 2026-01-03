import { useMyRegistrations } from "@/hooks/useRegistrations";
import { useCancelRegistration } from "@/hooks/useRegistrations";
import { useAuth } from "@/hooks/useAuth";
import { paymentsApi } from "@/api/payments";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Users,
  CheckCircle2,
  AlertCircle,
  CreditCard,
} from "lucide-react";
import { formatDate } from "@/utils/date";
import { formatCurrency } from "@/utils/helpers";
import { toast } from "sonner";

const MyRegistrationsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    status: "",
    paymentStatus: "",
    eventMode: "",
    page: 1,
    limit: 20,
  });
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);

  const { data: registrations, isLoading } = useMyRegistrations(filters);
  const cancelRegistration = useCancelRegistration();

  // Debug: Log registrations data
  console.log("Registrations data:", registrations);
  console.log("Registrations.data:", registrations?.data);

  const handleCancelRegistration = async (registrationId: string) => {
    // NULL CHECK: Validate registrationId
    if (!registrationId) {
      toast.error("Invalid registration");
      return;
    }

    // DOUBLE-CLICK PREVENTION: Check pending state
    if (cancelRegistration.isPending) {
      return;
    }

    try {
      const result = await cancelRegistration.mutateAsync({
        id: registrationId,
      });
      const message =
        (result as any)?.message || "Registration cancelled successfully";
      toast.success(message);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to cancel registration"
      );
    }
  };

  const handlePayNow = async (registrationId: string) => {
    // NULL CHECK: Validate registrationId
    if (!registrationId) {
      toast.error("Invalid registration");
      return;
    }

    // DOUBLE-CLICK PREVENTION: Check if already processing
    if (paymentLoading) {
      return;
    }

    try {
      setPaymentLoading(registrationId);

      // Load Razorpay script if not already loaded
      if (typeof (window as any).Razorpay === "undefined") {
        await loadRazorpayScript();
      }

      const { data } = await paymentsApi.initiatePayment({
        registrationId,
        paymentMethod: "razorpay",
      });

      // NULL CHECK: Validate payment data
      if (!data) {
        setPaymentLoading(null);
        toast.error("Failed to create payment order");
        return;
      }

      const { orderId, amount: payAmount, currency: payCurrency, key } = data;

      // NULL CHECK: Validate Razorpay key
      if (!key) {
        setPaymentLoading(null);
        toast.error(
          "Razorpay key not configured. Please contact administrator."
        );
        return;
      }

      // NULL CHECK: Validate payment object
      if (!data.payment?._id) {
        setPaymentLoading(null);
        toast.error("Payment initialization failed");
        return;
      }

      const options = {
        key: key,
        amount: payAmount,
        currency: payCurrency,
        name: "Event Management System",
        description: `Payment for registration`,
        order_id: orderId,
        handler: function (response: any) {
          verifyPayment(
            data.payment._id,
            response.razorpay_payment_id,
            response.razorpay_order_id,
            response.razorpay_signature
          );
        },
        prefill: {
          name: "",
          email: "",
        },
        theme: {
          color: "#3399cc",
        },
        modal: {
          ondismiss: function () {
            setPaymentLoading(null);
            toast.info("Payment cancelled");
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (error: any) {
      setPaymentLoading(null);
      console.error("Payment initiation failed:", error);
      toast.error(
        error?.response?.data?.message ||
          "Failed to initiate payment. Please try again."
      );
    }
  };

  const loadRazorpayScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Failed to load Razorpay script"));
      document.body.appendChild(script);
    });
  };

  const verifyPayment = async (
    paymentId: string,
    razorpay_payment_id: string,
    razorpay_order_id: string,
    razorpay_signature: string
  ) => {
    try {
      await paymentsApi.verifyPayment({
        paymentId,
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
      });
      setPaymentLoading(null);
      toast.success("Payment successful! Your registration is now confirmed.");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      setPaymentLoading(null);
      console.error("Payment verification failed:", error);
      toast.error(
        error?.response?.data?.message ||
          "Payment verification failed. Please contact support."
      );
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      confirmed: "default",
      pending: "secondary",
      cancelled: "destructive",
      waitlisted: "outline",
    };
    return (
      <Badge variant={variants[status] || "default"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Paid
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <AlertCircle className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <X className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case "not_required":
        return <Badge variant="outline">Free Event</Badge>;
      default:
        return <Badge variant="outline">N/A</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-100 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">My Registrations</h1>
        <p className="text-muted-foreground">
          View and manage all your event registrations
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Select
          value={filters.status}
          onValueChange={(value) =>
            setFilters({
              ...filters,
              status: value === "all" ? "" : value,
              page: 1,
            })
          }
        >
          <SelectTrigger className="w-full sm:w-50">
            <SelectValue placeholder="Registration Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="waitlisted">Waitlisted</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.paymentStatus}
          onValueChange={(value) =>
            setFilters({
              ...filters,
              paymentStatus: value === "all" ? "" : value,
              page: 1,
            })
          }
        >
          <SelectTrigger className="w-full sm:w-50">
            <SelectValue placeholder="Payment Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="not_required">Not Required</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.eventMode}
          onValueChange={(value) =>
            setFilters({
              ...filters,
              eventMode: value === "all" ? "" : value,
              page: 1,
            })
          }
        >
          <SelectTrigger className="w-full sm:w-50">
            <SelectValue placeholder="Event Mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modes</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
            <SelectItem value="hybrid">Hybrid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-50">Event</TableHead>
              <TableHead className="min-w-30">Date</TableHead>
              <TableHead className="min-w-37.5">Venue</TableHead>
              <TableHead className="min-w-30">Status</TableHead>
              <TableHead className="min-w-30">Payment</TableHead>
              <TableHead className="min-w-25">Amount</TableHead>
              <TableHead className="min-w-25">Team</TableHead>
              <TableHead className="text-right min-w-50">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!registrations?.data || registrations.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Calendar className="w-12 h-12 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No registrations found
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => navigate("/events")}
                    >
                      Browse Events
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              registrations.data.map((registration: any) => (
                <TableRow key={registration._id}>
                  {/* Event Title */}
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold">
                        {registration.event.title}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="w-3 h-3" />
                        <span>
                          {registration.event.category} •{" "}
                          {registration.event.eventType}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Date */}
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {formatDate(registration.event.startDateTime)}
                      </span>
                    </div>
                  </TableCell>

                  {/* Venue */}
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="truncate max-w-37.5">
                        {registration.event.venue}
                      </span>
                    </div>
                  </TableCell>

                  {/* Registration Status */}
                  <TableCell>{getStatusBadge(registration.status)}</TableCell>

                  {/* Payment Status */}
                  <TableCell>
                    {registration.event.isPaid ? (
                      getPaymentStatusBadge(registration.paymentStatus)
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Free
                      </span>
                    )}
                  </TableCell>

                  {/* Amount */}
                  <TableCell>
                    {registration.event.isPaid ? (
                      <span className="text-sm font-medium">
                        {formatCurrency(
                          registration.event.amount,
                          registration.event.currency
                        )}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Free
                      </span>
                    )}
                  </TableCell>

                  {/* Team */}
                  <TableCell>
                    {registration.event.maxTeamSize > 1 ||
                    registration.event.isTeamEvent ? (
                      registration.team || registration.teamId ? (
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="text-xs">
                            <Users className="w-3 h-3 mr-1" />
                            {registration.team?.name || "Team"}
                          </Badge>
                          {registration.team?.teamCode && (
                            <span className="text-xs text-muted-foreground">
                              Code: {registration.team.teamCode}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          No Team
                        </Badge>
                      )
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          navigate(`/events/${registration.event._id}`)
                        }
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>

                      {registration.event.isTeamEvent &&
                        !registration.teamId &&
                        registration.status === "confirmed" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              navigate(
                                `/events/${registration.event._id}/teams`
                              )
                            }
                          >
                            <Users className="w-4 h-4 mr-1" />
                            Team
                          </Button>
                        )}

                      {registration.event.isPaid &&
                        registration.paymentStatus === "pending" &&
                        // TEAM PAYMENT: Only show pay button for solo events or team leader
                        (!registration.team ||
                          registration.team.leader === user._id ||
                          registration.team.leader?._id === user._id) && (
                          <Button
                            size="sm"
                            onClick={() => handlePayNow(registration._id)}
                            disabled={paymentLoading === registration._id}
                          >
                            <CreditCard className="w-4 h-4 mr-1" />
                            {paymentLoading === registration._id
                              ? "Processing..."
                              : "Pay Now"}
                          </Button>
                        )}

                      {/* Team member waiting for leader payment */}
                      {registration.event.isPaid &&
                        registration.paymentStatus === "pending" &&
                        registration.team &&
                        registration.team.leader !== user._id &&
                        registration.team.leader?._id !== user._id && (
                          <span className="text-xs text-muted-foreground px-2">
                            Waiting for team leader payment
                          </span>
                        )}

                      {(registration.status === "confirmed" ||
                        registration.status === "pending") && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={cancelRegistration.isPending}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Cancel
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Cancel Registration?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to cancel your
                                registration for "{registration.event.title}"?
                                This action cannot be undone.
                                {registration.event.isPaid &&
                                  registration.paymentStatus === "paid" &&
                                  " A refund will be initiated according to the refund policy."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>
                                Keep Registration
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  handleCancelRegistration(registration._id)
                                }
                                className="bg-destructive text-destructive-foreground"
                              >
                                Yes, Cancel
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {registrations?.pagination && registrations.pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
            disabled={filters.page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4">
            Page {filters.page} of {registrations.pagination.pages}
          </span>
          <Button
            variant="outline"
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            disabled={filters.page >= registrations.pagination.pages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default MyRegistrationsPage;
