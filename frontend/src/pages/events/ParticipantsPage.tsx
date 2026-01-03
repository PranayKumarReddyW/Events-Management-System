import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { registrationsApi } from "@/api/registrations";
import { eventsApi } from "@/api/events";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  DollarSign,
  ArrowRight,
  Trophy,
  TrendingUp,
  UserCheck,
  UserX,
  MoreVertical,
} from "lucide-react";
import type { EventRegistration, Event } from "@/types";

export default function ParticipantsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [roundStats, setRoundStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRound, setSelectedRound] = useState<number>(0);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    []
  );
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState({
    status: "all",
    paymentStatus: "all",
    search: "",
    page: 1,
    limit: 100,
  });

  const fetchEvent = useCallback(async () => {
    try {
      const response = await eventsApi.getEvent(eventId!);
      setEvent(response.data?.event || null);
    } catch (error: any) {
      toast.error("Failed to fetch event");
    }
  }, [eventId]);

  const fetchRoundStats = useCallback(async () => {
    try {
      const response: any = await eventsApi.getRoundStats(eventId!);
      setRoundStats(response.data);
    } catch (error: any) {
      console.error("Failed to fetch round stats:", error);
    }
  }, [eventId]);

  const fetchRegistrations = useCallback(async () => {
    try {
      setLoading(true);

      // If viewing a specific round
      if (selectedRound > 0) {
        const response: any = await eventsApi.getRoundParticipants(
          eventId!,
          selectedRound
        );
        const responseData = response.data;
        setRegistrations(responseData?.participants || []);
        setStats({
          totalRegistrations: responseData?.count || 0,
          confirmed: responseData?.count || 0,
        });
      } else {
        // Viewing all registrations
        const response: any = await registrationsApi.getEventRegistrations(
          eventId!,
          {
            status: filters.status === "all" ? undefined : filters.status,
            paymentStatus:
              filters.paymentStatus === "all"
                ? undefined
                : filters.paymentStatus,
            search: filters.search,
            page: filters.page,
            limit: filters.limit,
          }
        );
        setRegistrations(response.data || []);
        setStats(response.stats);
      }
    } catch (error: any) {
      toast.error("Failed to fetch registrations");
    } finally {
      setLoading(false);
    }
  }, [eventId, selectedRound, filters]);

  useEffect(() => {
    if (eventId) {
      fetchEvent();
      fetchRoundStats();
    }
  }, [eventId, fetchEvent, fetchRoundStats]);

  useEffect(() => {
    if (eventId) {
      fetchRegistrations();
    }
  }, [eventId, fetchRegistrations]);

  const handleAdvanceSelected = async () => {
    if (selectedParticipants.length === 0) {
      toast.error("Please select participants to advance");
      return;
    }

    try {
      setSubmitting(true);
      const nextRound = (event?.currentRound || 0) + 1;

      await eventsApi.advanceParticipants(
        eventId!,
        nextRound,
        selectedParticipants
      );

      toast.success(
        `Advanced ${selectedParticipants.length} participants to Round ${nextRound}`
      );
      setShowAdvanceDialog(false);
      setSelectedParticipants([]);
      fetchRegistrations();
      fetchRoundStats();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to advance participants"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckin = async (registration: EventRegistration) => {
    try {
      await registrationsApi.checkinParticipant(registration._id);
      toast.success("Checked in successfully");

      // OPTIMIZATION: Update local state instead of refetching all
      setRegistrations((prev) =>
        prev.map((reg) =>
          reg._id === registration._id
            ? { ...reg, checkInTime: new Date().toISOString() }
            : reg
        )
      );
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to check in");
    }
  };

  const toggleParticipant = (id: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedParticipants.length === registrations.length) {
      setSelectedParticipants([]);
    } else {
      setSelectedParticipants(registrations.map((r) => r._id));
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

  const handleExport = async () => {
    try {
      await registrationsApi.exportRegistrations(eventId!, "csv");
      toast.success("Export started");
    } catch (error: any) {
      toast.error("Export failed");
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Event Participants</h1>
            {event && (
              <p className="text-muted-foreground">
                Managing participants for "{event.title}"
              </p>
            )}
          </div>
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Round Navigation */}
      {event && event.rounds && event.rounds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Round Management
            </CardTitle>
            <CardDescription>
              Select a round to view participants or advance them to the next
              round
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                variant={selectedRound === 0 ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedRound(0);
                  setSelectedParticipants([]);
                }}
              >
                All Registrations
              </Button>
              {roundStats?.stats?.map((round: any) => (
                <Button
                  key={round.round}
                  variant={
                    selectedRound === round.round ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => {
                    setSelectedRound(round.round);
                    setSelectedParticipants([]);
                  }}
                >
                  {round.name} ({round.participantCount})
                </Button>
              ))}
            </div>

            {roundStats && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>Current Round: {roundStats.currentRound || 0}</span>
                </div>
                <div>Total Rounds: {roundStats.totalRounds || 0}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      {stats && selectedRound === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                  {stats.totalRegistrations || 0}
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
                <span className="text-2xl font-bold">
                  {stats.confirmed || 0}
                </span>
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
                <span className="text-2xl font-bold">{stats.pending || 0}</span>
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
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold">
                  {stats.checkedIn || 0}
                </span>
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
                <span className="text-2xl font-bold">
                  {stats.paidCount || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Participants Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>
                {selectedRound > 0
                  ? `Round ${selectedRound} Participants`
                  : "All Participants"}
              </CardTitle>
              <CardDescription>
                {selectedRound > 0
                  ? `Participants currently in Round ${selectedRound}`
                  : "View and manage all event registrations"}
              </CardDescription>
            </div>
            {selectedRound > 0 && selectedParticipants.length > 0 && (
              <Button onClick={() => setShowAdvanceDialog(true)}>
                <ArrowRight className="h-4 w-4 mr-2" />
                Advance {selectedParticipants.length} to Next Round
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          {selectedRound === 0 && (
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
                  <SelectValue placeholder="Status" />
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
                  <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="not_required">Free</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading participants...
            </div>
          ) : registrations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No participants found
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    {selectedRound > 0 && (
                      <TableHead className="w-12">
                        <Checkbox
                          checked={
                            selectedParticipants.length === registrations.length
                          }
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                    )}
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    {selectedRound === 0 && <TableHead>Status</TableHead>}
                    {selectedRound === 0 && event?.isPaid && (
                      <TableHead>Payment</TableHead>
                    )}
                    {event?.maxTeamSize && event.maxTeamSize > 1 && (
                      <TableHead>Team</TableHead>
                    )}
                    {selectedRound === 0 && <TableHead>Check-in</TableHead>}
                    {selectedRound > 0 && <TableHead>Current Round</TableHead>}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map((registration: any) => (
                    <TableRow key={registration._id}>
                      {selectedRound > 0 && (
                        <TableCell>
                          <Checkbox
                            checked={selectedParticipants.includes(
                              registration._id
                            )}
                            onCheckedChange={() =>
                              toggleParticipant(registration._id)
                            }
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        {registration.user?.fullName || "N/A"}
                      </TableCell>
                      <TableCell>{registration.user?.email || "N/A"}</TableCell>
                      <TableCell>{registration.user?.phone || "N/A"}</TableCell>
                      {selectedRound === 0 && (
                        <TableCell>
                          {getStatusBadge(registration.status)}
                        </TableCell>
                      )}
                      {selectedRound === 0 && event?.isPaid && (
                        <TableCell>
                          <Badge
                            variant={
                              registration.paymentStatus === "paid"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {registration.paymentStatus}
                          </Badge>
                        </TableCell>
                      )}
                      {event?.maxTeamSize && event.maxTeamSize > 1 && (
                        <TableCell>
                          {registration.team?.name || "No Team"}
                        </TableCell>
                      )}
                      {selectedRound === 0 && (
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
                      )}
                      {selectedRound > 0 && (
                        <TableCell>
                          <Badge>Round {registration.currentRound || 0}</Badge>
                        </TableCell>
                      )}
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
                              onClick={() =>
                                navigate(`/registrations/${registration._id}`)
                              }
                            >
                              View Details
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

      {/* Advance Confirmation Dialog */}
      <AlertDialog open={showAdvanceDialog} onOpenChange={setShowAdvanceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Advance Participants to Next Round?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to advance {selectedParticipants.length}{" "}
              participant(s) to Round {(event?.currentRound || 0) + 1}.
              Participants not selected will be marked as eliminated from Round{" "}
              {selectedRound}.
              <br />
              <br />
              This action cannot be undone. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAdvanceSelected}
              disabled={submitting}
            >
              {submitting ? "Advancing..." : "Advance Participants"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
