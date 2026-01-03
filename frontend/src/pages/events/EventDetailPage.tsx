import { useParams, useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import {
  useEvent,
  usePublishEvent,
  useDeleteEvent,
  useUpdateEvent,
} from "@/hooks/useEvents";
import {
  useCreateRegistration,
  useEventRegistrations,
  useUpdateRegistrationStatus,
  useMyRegistrations,
} from "@/hooks/useRegistrations";
import { useAuth } from "@/hooks/useAuth";
import { useCreateTeam, useJoinTeam, useMyTeams } from "@/hooks/useTeams";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar,
  MapPin,
  Users,
  ArrowLeft,
  Edit,
  Trash2,
  Award,
  Video,
  Globe,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  UserPlus,
  Plus,
  Search,
  ArrowUpDown,
  Mail,
  Phone,
} from "lucide-react";
import {
  formatDate,
  formatDateRange,
  formatDuration,
  getEventStatus,
} from "@/utils/date";
import { formatCurrency } from "@/utils/helpers";
import { EVENT_TYPES, API_BASE_URL } from "@/constants";
import { toast } from "sonner";
import { paymentsApi } from "@/api/payments";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: eventResponse, isLoading, isError } = useEvent(id!);
  const createRegistration = useCreateRegistration();
  const publishEvent = usePublishEvent();
  const deleteEvent = useDeleteEvent();
  const updateEvent = useUpdateEvent();

  // Team state
  const [createTeamDialogOpen, setCreateTeamDialogOpen] = useState(false);
  const [joinTeamDialogOpen, setJoinTeamDialogOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  // Payment state
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Table state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "email" | "status" | "date">(
    "date"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Team mutation hooks
  const createTeam = useCreateTeam();
  const joinTeam = useJoinTeam();

  // Unwrap event data from API response
  const event = eventResponse?.data?.event;
  const isOrganizer =
    event?.organizer?._id === user?._id || event?.organizerId === user?._id;
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isStudent = user?.role === "student";
  // Organizers can only manage their own events, admins can manage all
  const canManageEvent = isOrganizer || isAdmin;

  // Get user's teams for this event
  const { data: myTeamsData } = useMyTeams(!!id && isStudent);
  const myTeamsArray = Array.isArray(myTeamsData?.data) ? myTeamsData.data : [];
  const myTeamsForEvent = myTeamsArray.filter(
    (team: any) => team.event?._id === id || team.event === id
  );

  // Get registrations ONLY if organizer or admin
  const { data: registrationsData } = useEventRegistrations(
    id || "",
    undefined,
    canManageEvent
  );
  const registrations = registrationsData?.data || [];
  const updateRegistrationStatus = useUpdateRegistrationStatus();

  // Check if current user has already registered (exclude cancelled/rejected)
  // Prioritize the isRegistered field from the event API response if available
  const { data: myRegistrationsData, refetch: refetchMyRegistrations } =
    useMyRegistrations({ status: "all" });
  const myRegistrations = myRegistrationsData?.data || [];

  // Use isRegistered from event if available (from backend), otherwise fall back to checking myRegistrations
  const hasAlreadyRegistered =
    event?.isRegistered === true ||
    myRegistrations.some(
      (reg: any) =>
        (reg.event?._id === id || reg.event === id) &&
        !["cancelled", "rejected"].includes(reg.status)
    );

  // Find the active registration for this event
  const myActiveRegistration = myRegistrations.find(
    (reg: any) =>
      (reg.event?._id === id || reg.event === id) &&
      !["cancelled", "rejected"].includes(reg.status)
  );

  // Debug logging
  console.log("Debug EventDetailPage:", {
    eventId: id,
    isStudent,
    eventStatus: event?.status,
    hasAlreadyRegistered,
    eventIsRegisteredField: event?.isRegistered,
    myRegistrationsCount: myRegistrations.length,
    myRegistrations: myRegistrations.map((r: any) => ({
      regId: r._id,
      eventId: r.event?._id || r.event,
      status: r.status,
      matches: r.event?._id === id || r.event === id,
    })),
    myActiveRegistration: myActiveRegistration
      ? {
          id: myActiveRegistration._id,
          status: myActiveRegistration.status,
          paymentStatus: myActiveRegistration.paymentStatus,
        }
      : null,
  });

  const handleRegister = async () => {
    if (!id) return;

    // EDGE CASE: Prevent double-click registration
    if (createRegistration.isPending) {
      return;
    }

    // For team events, require team selection
    if ((event?.maxTeamSize || 1) > 1) {
      if (!selectedTeamId) {
        toast.error("Please select a team before registering");
        return;
      }

      // NULL CHECK: Find the selected team
      const selectedTeam = myTeamsForEvent.find(
        (t: any) => t && t._id === selectedTeamId
      );

      if (!selectedTeam) {
        toast.error("Selected team not found");
        return;
      }

      if (selectedTeam.status !== "locked") {
        toast.error("Team must be locked by the leader before registration");
        return;
      }
    }

    try {
      const registrationData: any = {
        eventId: id,
      };

      // Add teamId if it's a team event
      if ((event?.maxTeamSize || 1) > 1 && selectedTeamId) {
        registrationData.teamId = selectedTeamId;
      }

      const response = await createRegistration.mutateAsync(registrationData);

      // NULL CHECK: Verify response data
      const registration = response?.data;

      if (!registration) {
        toast.error("Registration failed - no data received");
        return;
      }

      // Refetch registrations to update UI state
      await refetchMyRegistrations();

      // If event is paid, trigger payment immediately
      if (event?.isPaid && registration) {
        toast.info("Please complete payment to confirm your registration");
        setTimeout(() => {
          initiatePayment(registration._id, event.title);
        }, 500);
      } else {
        toast.success("Registration successful!");
        setTimeout(() => {
          navigate("/registrations");
        }, 1000);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Registration failed");
    }
  };

  const initiatePayment = async (
    registrationId: string,
    eventTitle: string
  ) => {
    try {
      setPaymentLoading(true);
      const response = await paymentsApi.initiatePayment({
        registrationId,
        paymentMethod: "razorpay",
      });

      console.log("Payment Response:", response);

      if (!response.data) {
        throw new Error("Invalid payment response");
      }

      const { payment, orderId, amount, currency, key } = response.data;

      console.log("Payment Details:", {
        paymentId: payment._id,
        orderId,
        amount,
        currency,
        key,
      });

      if (!key) {
        throw new Error(
          "Razorpay key not configured. Please contact administrator."
        );
      }

      // Load and open Razorpay with payment ID
      loadRazorpayScript(() => {
        openRazorpay(payment._id, key, amount, currency, orderId, eventTitle);
      });
    } catch (error: any) {
      setPaymentLoading(false);
      console.error("Payment Error:", error);
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to initiate payment. Please try from My Registrations page."
      );
      // Redirect to registrations page on payment error
      setTimeout(() => navigate("/registrations"), 2000);
    }
  };

  const loadRazorpayScript = (callback: () => void) => {
    // Check if Razorpay script already loaded
    if (typeof (window as any).Razorpay !== "undefined") {
      callback();
      return;
    }

    // Load Razorpay script
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      console.log("Razorpay script loaded successfully");
      callback();
    };

    script.onerror = () => {
      setPaymentLoading(false);
      toast.error(
        "Failed to load payment gateway. Please check your internet connection."
      );
      setTimeout(() => navigate("/registrations"), 2000);
    };
  };

  const openRazorpay = (
    paymentId: string,
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
      handler: async function (response: any) {
        console.log("Payment Success:", response);
        try {
          // EDGE CASE: Prevent navigation during verification
          setPaymentLoading(true);

          // Verify payment with backend
          const paymentData = await paymentsApi.verifyPayment({
            paymentId: paymentId,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          });

          console.log("Payment Verified:", paymentData);

          // Refetch registrations to update UI
          await refetchMyRegistrations();

          setPaymentLoading(false);
          toast.success(
            "Payment successful! Your registration is now confirmed."
          );

          // EDGE CASE: Delayed navigation to allow toast to show
          setTimeout(() => {
            navigate("/registrations");
          }, 1500);
        } catch (error: any) {
          console.error("Payment verification failed:", error);
          setPaymentLoading(false);
          toast.error(
            error.response?.data?.message ||
              "Payment verification failed. Please contact support."
          );
        }
      },
      prefill: {
        name: user?.fullName || "",
        email: user?.email || "",
        contact: user?.phone || "",
      },
      theme: {
        color: "#3b82f6",
      },
      modal: {
        ondismiss: function () {
          setPaymentLoading(false);
          toast.info(
            "Payment cancelled. You can complete payment from My Registrations page."
          );
          setTimeout(() => navigate("/registrations"), 2000);
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
      setPaymentLoading(false);
      console.error("Failed to open Razorpay:", error);
      toast.error("Failed to open payment gateway");
      setTimeout(() => navigate("/registrations"), 2000);
    }
  };

  const handlePublishToggle = async () => {
    if (!id) return;

    try {
      await publishEvent.mutateAsync(id);
      toast.success(
        event?.status === "published"
          ? "Event unpublished successfully"
          : "Event published successfully"
      );
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to update event status"
      );
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    try {
      await deleteEvent.mutateAsync(id);
      toast.success("Event deleted successfully");
      navigate("/events");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete event");
    }
  };

  const handleApproveRegistration = async (registrationId: string) => {
    // NULL CHECK: Validate registrationId
    if (!registrationId) {
      toast.error("Invalid registration");
      return;
    }

    // DOUBLE-CLICK PREVENTION: Check pending state
    if (updateRegistrationStatus.isPending) {
      return;
    }

    try {
      await updateRegistrationStatus.mutateAsync({
        id: registrationId,
        data: { status: "confirmed" },
      });
      toast.success("Registration approved");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to approve registration"
      );
    }
  };

  const handleRejectRegistration = async (registrationId: string) => {
    // NULL CHECK: Validate registrationId
    if (!registrationId) {
      toast.error("Invalid registration");
      return;
    }

    // DOUBLE-CLICK PREVENTION: Check pending state
    if (updateRegistrationStatus.isPending) {
      return;
    }

    try {
      await updateRegistrationStatus.mutateAsync({
        id: registrationId,
        data: { status: "rejected" },
      });
      toast.success("Registration rejected");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to reject registration"
      );
    }
  };

  const handleToggleRegistrations = async () => {
    // DOUBLE-CLICK PREVENTION: Check pending state
    if (updateEvent.isPending) {
      return;
    }

    try {
      await updateEvent.mutateAsync({
        id: id!,
        data: { registrationsOpen: !event?.registrationsOpen },
      });
      toast.success(
        event?.registrationsOpen
          ? "Registrations locked"
          : "Registrations opened"
      );
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to update registrations status"
      );
    }
  };

  const handleCreateTeam = async () => {
    // VALIDATION: Check team name
    if (!teamName.trim()) {
      toast.error("Please enter a team name");
      return;
    }

    // NULL CHECK: Validate event ID
    if (!id) {
      toast.error("Invalid event");
      return;
    }

    // DOUBLE-CLICK PREVENTION: Check pending state
    if (createTeam.isPending) {
      return;
    }

    try {
      const response = await createTeam.mutateAsync({
        name: teamName.trim(),
        eventId: id,
        description: teamDescription.trim() || undefined,
      });

      // NULL CHECK: Validate response and inviteCode
      const inviteCodeValue = (response?.data as any)?.inviteCode;
      toast.success(
        inviteCodeValue
          ? `Team created! Invite code: ${inviteCodeValue}`
          : "Team created successfully!"
      );
      setTeamName("");
      setTeamDescription("");
      setCreateTeamDialogOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create team");
    }
  };

  const handleJoinTeam = async () => {
    // VALIDATION: Check invite code
    if (!inviteCode.trim()) {
      toast.error("Please enter an invite code");
      return;
    }

    // DOUBLE-CLICK PREVENTION: Check pending state
    if (joinTeam.isPending) {
      return;
    }

    try {
      console.log(
        "[handleJoinTeam] Attempting to join with code:",
        inviteCode.trim().toUpperCase()
      );
      await joinTeam.mutateAsync({
        inviteCode: inviteCode.trim().toUpperCase(),
      });
      toast.success("Successfully joined team!");
      setInviteCode("");
      setJoinTeamDialogOpen(false);
    } catch (error: any) {
      console.error("[handleJoinTeam] Error:", error);
      console.error("[handleJoinTeam] Error response:", error.response?.data);
      toast.error(error.response?.data?.message || "Failed to join team");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-destructive font-medium">Event not found</p>
          <Button
            variant="outline"
            onClick={() => navigate("/events")}
            className="mt-4"
          >
            Back to Events
          </Button>
        </div>
      </div>
    );
  }

  const eventStatus = getEventStatus(
    event.startDate,
    event.endDate,
    event.status
  );

  // Use backend's registeredCount for consistency
  const actualRegistrationCount = event.registeredCount || 0;
  const isBeforeDeadline = new Date(event.registrationDeadline) > new Date();
  const registrationsClosed = !event.registrationsOpen || !isBeforeDeadline;

  const canRegister =
    isStudent &&
    eventStatus.label === "Upcoming" &&
    event.status === "published" &&
    !registrationsClosed &&
    !hasAlreadyRegistered &&
    (!event.maxParticipants || actualRegistrationCount < event.maxParticipants);

  const canShowRegisterButton =
    isStudent &&
    eventStatus.label === "Upcoming" &&
    event.status === "published" &&
    !registrationsClosed;

  // Always show button section if student and either can register OR already registered
  const showButtonSection =
    isStudent &&
    event.status === "published" &&
    (canShowRegisterButton || hasAlreadyRegistered);

  console.log("Button visibility debug:", {
    isStudent,
    eventStatus: event.status,
    canShowRegisterButton,
    hasAlreadyRegistered,
    showButtonSection,
    maxTeamSize: event.maxTeamSize,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/events")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Events
        </Button>
        {canManageEvent && (
          <div className="flex gap-2">
            <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
              {event.status === "published" ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
              <span className="text-sm">
                {event.status === "published" ? "Published" : "Draft"}
              </span>
              <Switch
                checked={event.status === "published"}
                onCheckedChange={handlePublishToggle}
                disabled={publishEvent.isPending}
              />
            </div>
            <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
              {event.registrationsOpen ? (
                <Unlock className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              <span className="text-sm">
                {event.registrationsOpen ? "Open" : "Locked"}
              </span>
              <Switch
                checked={event.registrationsOpen}
                onCheckedChange={handleToggleRegistrations}
                disabled={updateEvent.isPending}
              />
            </div>
            <Button variant="outline" asChild>
              <Link to={`/events/${id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/events/${id}/teams`}>
                <Users className="mr-2 h-4 w-4" />
                Teams
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/events/${id}/participants`}>
                <Users className="mr-2 h-4 w-4" />
                Participants
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/events/${id}/results`}>
                <Award className="mr-2 h-4 w-4" />
                Results
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete
                    the event.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={handleDelete}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {isStudent && registrationsClosed && event.status === "published" && (
        <div className="p-4 rounded-lg border-2 border-orange-500/30 bg-orange-50 dark:bg-orange-950/20">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-900 dark:text-orange-100">
                Registrations Closed
              </p>
              <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">
                {!event.registrationsOpen
                  ? "The organizer has closed registrations for this event."
                  : "The registration deadline has passed."}
              </p>
            </div>
          </div>
        </div>
      )}

      {event.bannerImage && (
        <div className="relative h-48 sm:h-64 md:h-80 lg:h-96 w-full overflow-hidden rounded-lg bg-muted">
          <img
            src={
              event.bannerImage.startsWith("data:image")
                ? event.bannerImage
                : `${API_BASE_URL}${event.bannerImage}`
            }
            alt={event.title}
            className="object-cover w-full h-full"
            onError={(e) => {
              console.error("Image failed to load:", event.bannerImage);
              e.currentTarget.style.display = "none";
            }}
          />
          {/* Fallback if image fails only if it's not a base64 image */}
          {!event.bannerImage.startsWith("data:image") && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <Calendar className="h-16 w-16 sm:h-20 sm:w-20" />
            </div>
          )}
        </div>
      )}

      {/* Additional Images Gallery */}
      {event.images && event.images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
          {event.images.map((image: string, index: number) => (
            <div
              key={index}
              className="relative h-32 sm:h-40 overflow-hidden rounded-lg bg-muted"
            >
              <img
                src={
                  image.startsWith("data:image")
                    ? image
                    : `${API_BASE_URL}${image}`
                }
                alt={`${event.title} - Image ${index + 1}`}
                className="object-cover w-full h-full hover:scale-105 transition-transform cursor-pointer"
                onClick={() =>
                  window.open(
                    image.startsWith("data:image")
                      ? image
                      : `${API_BASE_URL}${image}`,
                    "_blank"
                  )
                }
              />
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
                <div className="space-y-2 w-full">
                  <CardTitle className="text-2xl sm:text-3xl wrap-break-word">
                    {event.title}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={eventStatus.variant}>
                      {eventStatus.label}
                    </Badge>
                    <Badge variant="outline">
                      {
                        EVENT_TYPES.find((t) => t.value === event.eventType)
                          ?.label
                      }
                    </Badge>
                    {event.isPaid && (
                      <Badge variant="secondary">
                        {formatCurrency(event.registrationFee || 0)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <Tabs defaultValue="description" className="w-full">
                <TabsList className="w-full sm:w-auto flex h-fit justify-around">
                  <TabsTrigger
                    value="description"
                    className="flex-1 sm:flex-none min-h-11 text-sm sm:text-base"
                  >
                    Description
                  </TabsTrigger>
                  <TabsTrigger
                    value="rules"
                    className="flex-1 sm:flex-none min-h-11 text-sm sm:text-base"
                  >
                    Rules
                  </TabsTrigger>
                  {event.agenda && (
                    <TabsTrigger
                      value="agenda"
                      className="flex-1 sm:flex-none min-h-11 text-sm sm:text-base"
                    >
                      Agenda
                    </TabsTrigger>
                  )}
                  {event.schedule && event.schedule.length > 0 && (
                    <TabsTrigger
                      value="schedule"
                      className="flex-1 sm:flex-none min-h-11 text-sm sm:text-base"
                    >
                      Schedule
                    </TabsTrigger>
                  )}
                </TabsList>
                <TabsContent value="description" className="space-y-4">
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: event.description }}
                  />
                </TabsContent>
                <TabsContent value="rules" className="space-y-4">
                  {event.rules ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: event.rules }}
                    />
                  ) : (
                    <p className="text-muted-foreground">No specific rules</p>
                  )}
                </TabsContent>
                {event.agenda && (
                  <TabsContent value="agenda" className="space-y-4">
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: event.agenda }}
                    />
                  </TabsContent>
                )}
                {event.schedule && event.schedule.length > 0 && (
                  <TabsContent value="schedule" className="space-y-4">
                    <div className="space-y-3">
                      {event.schedule.map((item: any, index: number) => (
                        <Card key={index} className="overflow-hidden">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <CardTitle className="text-base font-semibold">
                                  {item.title}
                                </CardTitle>
                                <CardDescription className="mt-1 text-xs">
                                  {new Date(item.startTime).toLocaleString(
                                    "en-US",
                                    {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    }
                                  )}
                                  {" → "}
                                  {new Date(item.endTime).toLocaleString(
                                    "en-US",
                                    {
                                      timeStyle: "short",
                                    }
                                  )}
                                </CardDescription>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-2">
                            {item.description && (
                              <p className="text-sm text-muted-foreground">
                                {item.description}
                              </p>
                            )}
                            {item.venue && (
                              <p className="text-xs text-muted-foreground">
                                📍 {item.venue}
                              </p>
                            )}
                            {item.speakers && item.speakers.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {item.speakers.map(
                                  (speaker: string, idx: number) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                                    >
                                      {speaker}
                                    </span>
                                  )
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Date & Time</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateRange(event.startDate, event.endDate)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Duration:{" "}
                    {formatDuration(
                      Math.ceil(
                        (new Date(event.endDate).getTime() -
                          new Date(event.startDate).getTime()) /
                          (1000 * 60)
                      )
                    )}
                  </p>
                </div>
              </div>

              {event.venue && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Venue</p>
                    <p className="text-sm text-muted-foreground">
                      {event.venue}
                    </p>
                  </div>
                </div>
              )}

              {event.meetingLink && (
                <div className="flex items-start gap-3">
                  <Video className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Meeting Link</p>
                    <a
                      href={event.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Join Online
                    </a>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Participants</p>
                  <p className="text-sm text-muted-foreground">
                    {actualRegistrationCount} registered
                    {event.maxParticipants && ` / ${event.maxParticipants} max`}
                  </p>
                  {event.maxParticipants && (
                    <div className="mt-2">
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            actualRegistrationCount >= event.maxParticipants
                              ? "bg-red-500"
                              : actualRegistrationCount >=
                                event.maxParticipants * 0.8
                              ? "bg-yellow-500"
                              : "bg-green-500"
                          }`}
                          style={{
                            width: `${Math.min(
                              (actualRegistrationCount /
                                event.maxParticipants) *
                                100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      {actualRegistrationCount >= event.maxParticipants && (
                        <p className="text-xs text-red-500 mt-1 font-medium">
                          Event is full
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {event.teamEvent && (
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Team Size</p>
                    <p className="text-sm text-muted-foreground">
                      {event.minTeamSize} - {event.maxTeamSize} members
                    </p>
                  </div>
                </div>
              )}

              {event.certificateProvided && (
                <div className="flex items-start gap-3">
                  <Award className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Certificate</p>
                    <p className="text-sm text-muted-foreground">Provided</p>
                  </div>
                </div>
              )}

              {event.eligibility && (
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Eligibility Criteria</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {event.eligibility}
                    </p>
                  </div>
                </div>
              )}

              {event.eligibleYears && event.eligibleYears.length > 0 && (
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Eligible Years</p>
                    <p className="text-sm text-muted-foreground">
                      Year {event.eligibleYears.sort().join(", Year ")}
                    </p>
                  </div>
                </div>
              )}

              {event.eligibleDepartments &&
                event.eligibleDepartments.length > 0 && (
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        Eligible Departments
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {event.eligibleDepartments.join(", ")}
                      </p>
                    </div>
                  </div>
                )}

              {event.allowExternalStudents !== undefined && (
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">External Students</p>
                    <p className="text-sm text-muted-foreground">
                      {event.allowExternalStudents ? "Allowed" : "Not Allowed"}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Organizer</p>
                  <p className="text-sm text-muted-foreground">
                    {event.organizer.fullName}
                  </p>
                </div>
              </div>
            </CardContent>
            {event.maxTeamSize && event.maxTeamSize > 1 && isStudent && (
              <CardFooter className="flex-col gap-3 items-stretch">
                <div className="p-3 rounded-lg border-2 border-blue-500/20 bg-blue-50 dark:bg-blue-950/20">
                  <div className="flex items-start gap-2 text-blue-900 dark:text-blue-100">
                    <Users className="h-5 w-5 mt-0.5" />
                    <div>
                      <p className="font-semibold">Team Event</p>
                      <p className="text-sm mt-1">
                        This event requires a team of {event.maxTeamSize}{" "}
                        members.{" "}
                        {registrationsClosed
                          ? "Registrations are closed."
                          : "Create or join a team to register."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Team Selection for Registration */}
                {!hasAlreadyRegistered &&
                  !registrationsClosed &&
                  myTeamsForEvent.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="team-select">Select Your Team</Label>
                      <Select
                        value={selectedTeamId}
                        onValueChange={setSelectedTeamId}
                      >
                        <SelectTrigger id="team-select">
                          <SelectValue placeholder="Choose a team to register with" />
                        </SelectTrigger>
                        <SelectContent>
                          {myTeamsForEvent.map((team: any) => (
                            <SelectItem key={team._id} value={team._id}>
                              {team.name} ({team.members?.length || 0} members)
                              {team.status === "locked" && " - Locked ✓"}
                              {team.status === "active" && " - Active"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedTeamId &&
                        (() => {
                          const team = myTeamsForEvent.find(
                            (t: any) => t._id === selectedTeamId
                          );
                          return (
                            team?.status !== "locked" && (
                              <p className="text-sm text-amber-600">
                                ⚠ Team must be locked by the leader before
                                registration
                              </p>
                            )
                          );
                        })()}
                    </div>
                  )}

                {/* Register Button for Team Events */}
                {!hasAlreadyRegistered &&
                  !registrationsClosed &&
                  myTeamsForEvent.length > 0 &&
                  selectedTeamId && (
                    <Button
                      className="w-full min-h-11"
                      onClick={handleRegister}
                      disabled={createRegistration.isPending || paymentLoading}
                    >
                      {paymentLoading
                        ? "Processing Payment..."
                        : createRegistration.isPending
                        ? "Registering..."
                        : event.isPaid
                        ? `Register Team & Pay ${formatCurrency(
                            event.amount,
                            event.currency
                          )}`
                        : "Register Team"}
                    </Button>
                  )}

                {hasAlreadyRegistered && (
                  <div className="w-full space-y-2">
                    {myActiveRegistration?.paymentStatus === "pending" ? (
                      <>
                        <Button
                          className="w-full min-h-11 bg-amber-600 hover:bg-amber-700"
                          onClick={() => navigate("/registrations")}
                        >
                          ⚠ Payment Pending - Click to Pay
                        </Button>
                        <p className="text-xs text-center text-muted-foreground">
                          Complete payment to confirm your registration
                        </p>
                      </>
                    ) : (
                      <>
                        <Button
                          className="w-full min-h-11 bg-green-600 hover:bg-green-700"
                          disabled
                        >
                          ✓ Already Registered
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => navigate("/registrations")}
                        >
                          View My Registrations
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {!registrationsClosed && (
                  <div className="flex gap-2">
                    <Dialog
                      open={createTeamDialogOpen}
                      onOpenChange={setCreateTeamDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" className="flex-1">
                          <Plus className="mr-2 h-4 w-4" />
                          Create Team
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create Team</DialogTitle>
                          <DialogDescription>
                            Create a new team for this event. Share the invite
                            code with your teammates.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="teamName">Team Name</Label>
                            <Input
                              id="teamName"
                              placeholder="Enter team name"
                              value={teamName}
                              onChange={(e) => setTeamName(e.target.value)}
                              onKeyPress={(e) =>
                                e.key === "Enter" && handleCreateTeam()
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="teamDescription">
                              Description (Optional)
                            </Label>
                            <Textarea
                              id="teamDescription"
                              placeholder="Enter team description"
                              value={teamDescription}
                              onChange={(e) =>
                                setTeamDescription(e.target.value)
                              }
                              rows={3}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setCreateTeamDialogOpen(false);
                              setTeamName("");
                              setTeamDescription("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleCreateTeam}
                            disabled={createTeam.isPending}
                          >
                            {createTeam.isPending
                              ? "Creating..."
                              : "Create Team"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog
                      open={joinTeamDialogOpen}
                      onOpenChange={setJoinTeamDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="flex-1 min-h-11 w-full sm:w-auto"
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Join with Code
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Join Team</DialogTitle>
                          <DialogDescription>
                            Enter the invite code shared by your team leader.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="inviteCode">Invite Code</Label>
                            <Input
                              id="inviteCode"
                              placeholder="Enter 6-character code"
                              value={inviteCode}
                              onChange={(e) =>
                                setInviteCode(e.target.value.toUpperCase())
                              }
                              onKeyPress={(e) =>
                                e.key === "Enter" && handleJoinTeam()
                              }
                              className="font-mono text-lg tracking-wider"
                              maxLength={10}
                              autoComplete="off"
                            />
                            <p className="text-sm text-muted-foreground">
                              Ask your team leader for the invite code
                            </p>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setJoinTeamDialogOpen(false);
                              setInviteCode("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleJoinTeam}
                            disabled={joinTeam.isPending}
                          >
                            {joinTeam.isPending ? "Joining..." : "Join Team"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
                {!registrationsClosed && (
                  <Button
                    variant="outline"
                    onClick={() => navigate("/teams")}
                    className="w-full min-h-11"
                  >
                    View My Teams
                  </Button>
                )}
              </CardFooter>
            )}
            {(!event.maxTeamSize || event.maxTeamSize === 1) &&
              showButtonSection && (
                <CardFooter className="p-4 sm:p-6">
                  {hasAlreadyRegistered ? (
                    <div className="w-full space-y-2">
                      {myActiveRegistration?.paymentStatus === "pending" ? (
                        <>
                          <Button
                            className="w-full min-h-11 bg-amber-600 hover:bg-amber-700"
                            onClick={() => navigate("/registrations")}
                          >
                            ⚠ Payment Pending - Click to Pay
                          </Button>
                          <p className="text-xs text-center text-muted-foreground">
                            Complete payment to confirm your registration
                          </p>
                        </>
                      ) : (
                        <>
                          <Button
                            className="w-full min-h-11 bg-green-600 hover:bg-green-700"
                            disabled
                          >
                            ✓ Already Registered
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => navigate("/registrations")}
                          >
                            View My Registrations
                          </Button>
                        </>
                      )}
                    </div>
                  ) : canRegister ? (
                    <Button
                      className="w-full min-h-11"
                      onClick={handleRegister}
                      disabled={createRegistration.isPending || paymentLoading}
                    >
                      {paymentLoading
                        ? "Processing Payment..."
                        : createRegistration.isPending
                        ? "Registering..."
                        : event.isPaid
                        ? `Register & Pay ${formatCurrency(
                            event.amount,
                            event.currency
                          )}`
                        : "Register Now"}
                    </Button>
                  ) : null}
                </CardFooter>
              )}
            {!isStudent && !canManageEvent && (
              <CardFooter>
                <p className="text-sm text-muted-foreground text-center w-full">
                  Only students can register for events
                </p>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>

      {/* Registrations Section - Below All Event Data */}
      {canManageEvent &&
        Array.isArray(registrations) &&
        registrations.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Registered Participants</h2>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {registrations.length} Total
              </Badge>
            </div>

            {/* Search and Filter Bar */}
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 min-h-11"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48 min-h-11">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="waitlisted">Waitlisted</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={sortBy}
                  onValueChange={(val: any) => setSortBy(val)}
                >
                  <SelectTrigger className="w-full sm:w-48 min-h-11">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="date">Registration Date</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                  }
                  className="min-h-11 min-w-11"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Participants Table */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">
                  Showing{" "}
                  {(() => {
                    const filtered = registrations.filter((reg: any) => {
                      const user = reg.user || reg.userId;
                      const matchesSearch =
                        searchQuery === "" ||
                        user?.fullName
                          ?.toLowerCase()
                          .includes(searchQuery.toLowerCase()) ||
                        user?.email
                          ?.toLowerCase()
                          .includes(searchQuery.toLowerCase()) ||
                        user?.phone?.includes(searchQuery) ||
                        user?.department
                          ?.toLowerCase()
                          .includes(searchQuery.toLowerCase());
                      const matchesStatus =
                        statusFilter === "all" || reg.status === statusFilter;
                      return matchesSearch && matchesStatus;
                    });
                    return filtered.length;
                  })()}{" "}
                  of {registrations.length} participants
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                <div className="overflow-x-auto">
                  <div className="rounded-md border min-w-200">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Registration Date</TableHead>
                          {event.requiresApproval && (
                            <TableHead className="text-right">
                              Actions
                            </TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          // Filter registrations
                          let filtered = registrations.filter((reg: any) => {
                            const user = reg.user || reg.userId;
                            const matchesSearch =
                              searchQuery === "" ||
                              user?.fullName
                                ?.toLowerCase()
                                .includes(searchQuery.toLowerCase()) ||
                              user?.email
                                ?.toLowerCase()
                                .includes(searchQuery.toLowerCase()) ||
                              user?.phone?.includes(searchQuery);
                            const matchesStatus =
                              statusFilter === "all" ||
                              reg.status === statusFilter;
                            return matchesSearch && matchesStatus;
                          });

                          // Sort registrations
                          filtered = [...filtered].sort((a: any, b: any) => {
                            const userA = a.user || a.userId;
                            const userB = b.user || b.userId;
                            let compareA: any, compareB: any;

                            switch (sortBy) {
                              case "name":
                                compareA = userA?.fullName?.toLowerCase() || "";
                                compareB = userB?.fullName?.toLowerCase() || "";
                                break;
                              case "email":
                                compareA = userA?.email?.toLowerCase() || "";
                                compareB = userB?.email?.toLowerCase() || "";
                                break;
                              case "status":
                                compareA = a.status;
                                compareB = b.status;
                                break;
                              case "date":
                                compareA = new Date(a.createdAt).getTime();
                                compareB = new Date(b.createdAt).getTime();
                                break;
                              default:
                                compareA = a.createdAt;
                                compareB = b.createdAt;
                            }

                            if (sortOrder === "asc") {
                              return compareA > compareB ? 1 : -1;
                            } else {
                              return compareA < compareB ? 1 : -1;
                            }
                          });

                          if (filtered.length === 0) {
                            return (
                              <TableRow>
                                <TableCell
                                  colSpan={event.requiresApproval ? 8 : 7}
                                  className="text-center py-8 text-muted-foreground"
                                >
                                  No participants found
                                </TableCell>
                              </TableRow>
                            );
                          }

                          return filtered.map(
                            (registration: any, index: number) => {
                              const user =
                                registration.user || registration.userId;
                              return (
                                <TableRow key={registration._id}>
                                  <TableCell className="font-medium">
                                    {index + 1}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <span className="text-sm font-semibold text-primary">
                                          {user?.fullName
                                            ?.charAt(0)
                                            .toUpperCase()}
                                        </span>
                                      </div>
                                      <span className="font-medium">
                                        {user?.fullName || "N/A"}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Mail className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-sm">
                                        {user?.email || "N/A"}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Phone className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-sm">
                                        {user?.phone || "N/A"}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-sm">
                                      {user?.department || "N/A"}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        registration.status === "confirmed"
                                          ? "default"
                                          : registration.status ===
                                              "rejected" ||
                                            registration.status === "cancelled"
                                          ? "destructive"
                                          : registration.status === "waitlisted"
                                          ? "secondary"
                                          : "outline"
                                      }
                                    >
                                      {registration.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-sm text-muted-foreground">
                                      {formatDate(registration.createdAt)}
                                    </span>
                                  </TableCell>
                                  {event.requiresApproval && (
                                    <TableCell className="text-right">
                                      {registration.status === "pending" ? (
                                        <div className="flex flex-col sm:flex-row justify-end gap-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                              handleApproveRegistration(
                                                registration._id
                                              )
                                            }
                                            disabled={
                                              updateRegistrationStatus.isPending
                                            }
                                            className="min-h-11 sm:min-h-0 w-full sm:w-auto"
                                          >
                                            <CheckCircle className="h-4 w-4 sm:mr-1" />
                                            <span className="sm:inline">
                                              Approve
                                            </span>
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                              handleRejectRegistration(
                                                registration._id
                                              )
                                            }
                                            disabled={
                                              updateRegistrationStatus.isPending
                                            }
                                            className="min-h-11 sm:min-h-0 w-full sm:w-auto"
                                          >
                                            <XCircle className="h-4 w-4 sm:mr-1" />
                                            <span className="sm:inline">
                                              Reject
                                            </span>
                                          </Button>
                                        </div>
                                      ) : (
                                        <span className="text-sm text-muted-foreground">
                                          -
                                        </span>
                                      )}
                                    </TableCell>
                                  )}
                                </TableRow>
                              );
                            }
                          );
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
    </div>
  );
}
