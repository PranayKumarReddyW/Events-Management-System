import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { registrationsApi } from "@/api/registrations";
import { eventsApi } from "@/api/events";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  Download,
  MoreVertical,
  UserCheck,
  UserX,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  DollarSign,
} from "lucide-react";
import type { EventRegistration, Event } from "@/types";

export default function ParticipantsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "all",
    paymentStatus: "all",
    search: "",
    page: 1,
    limit: 50,
  });
  const [selectedRegistration, setSelectedRegistration] =
    useState<EventRegistration | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (eventId) {
      fetchEvent();
      fetchRegistrations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    eventId,
    filters.status,
    filters.paymentStatus,
    filters.search,
    filters.page,
    filters.limit,
  ]);

  const fetchEvent = async () => {
    try {
      const response = await eventsApi.getEvent(eventId!);
      setEvent(response.data?.event || null);
    } catch (error: any) {
      toast.error("Failed to fetch event", {
        description: error.response?.data?.message || "Please try again",
      });
    }
  };

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      const response = await registrationsApi.getEventRegistrations(eventId!, {
        ...filters,
        status: filters.status === "all" ? undefined : filters.status,
        paymentStatus:
          filters.paymentStatus === "all" ? undefined : filters.paymentStatus,
      });
      console.log("API Response:", response);
      console.log("Registrations:", response.data?.data);
      console.log("Stats:", response.data?.stats);
      setRegistrations(response.data?.data || []);
      setStats(response.data?.stats);
    } catch (error: any) {
      console.error("Error fetching registrations:", error);
      toast.error("Failed to fetch registrations", {
        description: error.response?.data?.message || "Please try again",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedRegistration || !newStatus) return;

    try {
      setSubmitting(true);
      await registrationsApi.updateRegistrationStatus(
        selectedRegistration._id,
        {
          status: newStatus as any,
        }
      );
      toast.success("Status updated", {
        description: "Registration status has been updated successfully",
      });
      setShowStatusDialog(false);
      setSelectedRegistration(null);
      fetchRegistrations();
    } catch (error: any) {
      toast.error("Update failed", {
        description: error.response?.data?.message || "Please try again",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckin = async (registration: EventRegistration) => {
    try {
      await registrationsApi.checkinParticipant(registration._id);
      toast.success("Checked in", {
        description: "Participant has been checked in successfully",
      });
      fetchRegistrations();
    } catch (error: any) {
      toast.error("Check-in failed", {
        description: error.response?.data?.message || "Please try again",
      });
    }
  };

  const handleExport = async () => {
    try {
      await registrationsApi.exportRegistrations(eventId!, "csv");
      toast.success("Export started", {
        description: "Your export will be downloaded shortly",
      });
    } catch (error: any) {
      toast.error("Export failed", {
        description: error.response?.data?.message || "Please try again",
      });
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
      rejected: "destructive",
    };

    const icons = {
      confirmed: <CheckCircle2 className="h-3 w-3 mr-1" />,
      pending: <Clock className="h-3 w-3 mr-1" />,
      cancelled: <XCircle className="h-3 w-3 mr-1" />,
      waitlisted: <Clock className="h-3 w-3 mr-1" />,
      rejected: <XCircle className="h-3 w-3 mr-1" />,
    };

    return (
      <Badge
        variant={variants[status] || "default"}
        className="flex items-center w-fit"
      >
        {icons[status as keyof typeof icons]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPaymentBadge = (status: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      completed: "default",
      pending: "secondary",
      failed: "destructive",
      not_required: "outline",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status === "not_required" ? "Free" : status.replace("_", " ")}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Event Participants</h1>
        {event && (
          <p className="text-muted-foreground">
            Managing participants for "{event.title}"
          </p>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Registrations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">
                  {stats.totalRegistrations}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Confirmed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">{stats.confirmed}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <span className="text-2xl font-bold">{stats.pending}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Checked In
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold">{stats.checkedIn}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Paid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">{stats.paidCount}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Participants List</CardTitle>
              <CardDescription>
                View and manage event registrations
              </CardDescription>
            </div>
            <Button onClick={handleExport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value, page: 1 })
                }
                className="pl-10"
              />
            </div>
            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilters({ ...filters, status: value, page: 1 })
              }
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="waitlisted">Waitlisted</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.paymentStatus}
              onValueChange={(value) =>
                setFilters({ ...filters, paymentStatus: value, page: 1 })
              }
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Payment Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="not_required">Free</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading participants...
            </div>
          ) : registrations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No registrations found
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participant</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Registration Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Checked In</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map((registration) => (
                    <TableRow key={registration._id}>
                      <TableCell className="font-medium">
                        {typeof registration.user === "object"
                          ? registration.user.fullName
                          : "Unknown"}
                      </TableCell>
                      <TableCell>
                        {typeof registration.user === "object"
                          ? registration.user.email
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        {registration.team
                          ? typeof registration.team === "object"
                            ? registration.team.name
                            : "Team"
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {format(
                          new Date(registration.registrationDate),
                          "MMM d, yyyy"
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(registration.status)}
                      </TableCell>
                      <TableCell>
                        {getPaymentBadge(registration.paymentStatus)}
                      </TableCell>
                      <TableCell>
                        {registration.checkInTime ? (
                          <Badge variant="default">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <UserX className="h-3 w-3 mr-1" />
                            No
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedRegistration(registration);
                                setNewStatus(registration.status);
                                setShowStatusDialog(true);
                              }}
                            >
                              Change Status
                            </DropdownMenuItem>
                            {!registration.checkInTime && (
                              <DropdownMenuItem
                                onClick={() => handleCheckin(registration)}
                              >
                                <UserCheck className="h-4 w-4 mr-2" />
                                Check In
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Update Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Registration Status</DialogTitle>
            <DialogDescription>
              Change the status of this registration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedRegistration && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Participant</p>
                <p className="text-sm text-muted-foreground">
                  {typeof selectedRegistration.user === "object"
                    ? selectedRegistration.user.fullName
                    : "Unknown"}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">New Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="waitlisted">Waitlisted</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowStatusDialog(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleStatusUpdate} disabled={submitting}>
              {submitting ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
