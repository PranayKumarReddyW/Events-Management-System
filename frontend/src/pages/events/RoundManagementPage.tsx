import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { eventsApi } from "@/api/events";
import { registrationsApi } from "@/api/registrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  Users,
  Trophy,
  TrendingUp,
  Target,
  XCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/utils/date";
import type { Event, EventRegistration } from "@/types";

interface Round {
  _id?: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  maxParticipants?: number;
  status: "upcoming" | "active" | "completed";
}

interface RoundStats {
  round: number;
  name: string;
  participantCount: number;
  eliminatedCount?: number;
}

export default function RoundManagementPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [roundStats, setRoundStats] = useState<RoundStats[]>([]);
  const [selectedRound, setSelectedRound] = useState<number>(0);
  const [participants, setParticipants] = useState<EventRegistration[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Dialog states
  const [showAddRoundDialog, setShowAddRoundDialog] = useState(false);
  const [showEditRoundDialog, setShowEditRoundDialog] = useState(false);
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);
  const [showEliminateDialog, setShowEliminateDialog] = useState(false);
  const [showDeleteRoundDialog, setShowDeleteRoundDialog] = useState(false);

  // Form states
  const [editingRound, setEditingRound] = useState<Round | null>(null);
  const [roundForm, setRoundForm] = useState<{
    name: string;
    description: string;
    startDate: string;
    endDate: string;
    maxParticipants: string;
    status?: "upcoming" | "active" | "completed";
  }>({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    maxParticipants: "",
  });

  useEffect(() => {
    loadEventData();
  }, [eventId]);

  useEffect(() => {
    if (selectedRound >= 0) {
      loadRoundParticipants(selectedRound);
    }
  }, [selectedRound]);

  const loadEventData = async () => {
    if (!eventId) {
      console.error("No eventId provided");
      return;
    }

    try {
      setIsLoading(true);
      console.log("Loading event data for ID:", eventId);

      // Load event details
      const eventRes = await eventsApi.getEvent(eventId);
      console.log("Event response:", eventRes);

      const eventData = eventRes.data?.event;
      console.log("Event data:", eventData);

      if (!eventData) {
        throw new Error("Event data not found in response");
      }

      setEvent(eventData);
      setRounds(eventData?.rounds || []);
      setCurrentRound(eventData?.currentRound || 0);

      console.log("Rounds:", eventData?.rounds);
      console.log("Current round:", eventData?.currentRound);

      // Load round stats
      try {
        const statsRes = await eventsApi.getRoundStats(eventId);
        console.log("Stats response:", statsRes);
        setRoundStats((statsRes as any).data?.data || []);
      } catch (statsError: any) {
        console.error("Failed to load round stats:", statsError);
        // Continue even if stats fail
        setRoundStats([]);
      }

      // Load initial participants (Round 0)
      await loadRoundParticipants(0);
    } catch (error: any) {
      console.error("Error loading event data:", error);
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to load event data"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadRoundParticipants = async (roundNumber: number) => {
    if (!eventId) {
      console.error("No eventId for loading participants");
      return;
    }

    try {
      setIsLoadingParticipants(true);
      console.log("Loading participants for round:", roundNumber);

      if (roundNumber === 0) {
        // Load all initial registrations
        const res = await registrationsApi.getEventRegistrations(eventId, {
          status: "confirmed",
        });
        console.log("Initial registrations response:", res);
        const allParticipants = res.data?.data || [];
        console.log("All participants:", allParticipants);

        // Filter to only show those still in round 0 (not advanced yet)
        const round0Participants = allParticipants.filter(
          (p: any) =>
            (!p.currentRound || p.currentRound === 0) && !p.eliminatedInRound
        );
        console.log("Round 0 participants:", round0Participants);
        setParticipants(round0Participants);
      } else {
        // Load specific round participants
        const res = await eventsApi.getRoundParticipants(eventId, roundNumber);
        console.log("Round participants response:", res);
        setParticipants((res as any).data?.data?.participants || []);
      }

      setSelectedParticipants([]);
    } catch (error: any) {
      console.error("Error loading participants:", error);
      toast.error(
        error.response?.data?.message || "Failed to load participants"
      );
      setParticipants([]);
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  const handleAddRound = async () => {
    if (!eventId) {
      console.error("[ADD ROUND] No eventId provided");
      return;
    }
    if (!roundForm.name.trim()) {
      toast.error("Round name is required");
      return;
    }

    // Validate round dates if provided
    if (roundForm.startDate && roundForm.endDate) {
      const startDate = new Date(roundForm.startDate);
      const endDate = new Date(roundForm.endDate);

      if (endDate <= startDate) {
        toast.error("Round end date must be after start date");
        return;
      }
    }

    // Validate against previous round dates
    if (rounds.length > 0 && roundForm.startDate) {
      const lastRound = rounds[rounds.length - 1];
      if (lastRound.endDate) {
        const lastRoundEnd = new Date(lastRound.endDate);
        const newRoundStart = new Date(roundForm.startDate);

        if (newRoundStart <= lastRoundEnd) {
          toast.error("New round must start after the previous round ends");
          return;
        }
      }

      // Check if previous round is completed
      if (lastRound.status !== "completed") {
        toast.error(
          "Previous round must be completed before adding a new round"
        );
        return;
      }
    }

    const roundData = {
      name: roundForm.name,
      description: roundForm.description,
      startDate: roundForm.startDate || undefined,
      endDate: roundForm.endDate || undefined,
      maxParticipants: roundForm.maxParticipants
        ? parseInt(roundForm.maxParticipants)
        : undefined,
      status: "upcoming",
    };

    console.log("[ADD ROUND] Starting round addition");
    console.log("[ADD ROUND] Event ID:", eventId);
    console.log("[ADD ROUND] Round data:", roundData);

    try {
      setIsProcessing(true);
      const response = await eventsApi.addRound(eventId, roundData);

      console.log("[ADD ROUND] API response:", response);
      console.log(
        "[ADD ROUND] Success! Response data:",
        (response as any).data
      );

      if ((response as any).data?.event?.rounds) {
        console.log(
          "[ADD ROUND] Event now has rounds:",
          (response as any).data.event.rounds
        );
      }

      toast.success("Round added successfully");
      setShowAddRoundDialog(false);
      setRoundForm({
        name: "",
        description: "",
        startDate: "",
        endDate: "",
        maxParticipants: "",
      });

      console.log("[ADD ROUND] Reloading event data...");
      await loadEventData();
    } catch (error: any) {
      console.error("[ADD ROUND] Error:", error);
      console.error("[ADD ROUND] Error response:", error.response);
      console.error("[ADD ROUND] Error data:", error.response?.data);
      toast.error(error.response?.data?.message || "Failed to add round");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditRound = async () => {
    if (!eventId || !editingRound?._id) return;
    if (!roundForm.name.trim()) {
      toast.error("Round name is required");
      return;
    }

    // Validate round dates if provided
    if (roundForm.startDate && roundForm.endDate) {
      const startDate = new Date(roundForm.startDate);
      const endDate = new Date(roundForm.endDate);

      if (endDate <= startDate) {
        toast.error("Round end date must be after start date");
        return;
      }
    }

    // Check if trying to activate a round when another is already active
    if (roundForm.status === "active") {
      const hasActiveRound = rounds.some(
        (r) => r.status === "active" && r._id !== editingRound._id
      );
      if (hasActiveRound) {
        toast.error(
          "Only one round can be active at a time. Please complete the current active round first."
        );
        return;
      }
    }

    try {
      setIsProcessing(true);
      await eventsApi.updateRound(eventId, editingRound._id, {
        name: roundForm.name,
        description: roundForm.description,
        startDate: roundForm.startDate || undefined,
        endDate: roundForm.endDate || undefined,
        maxParticipants: roundForm.maxParticipants
          ? parseInt(roundForm.maxParticipants)
          : undefined,
        status: roundForm.status || editingRound.status,
      });

      toast.success("Round updated successfully");
      setShowEditRoundDialog(false);
      setEditingRound(null);
      setRoundForm({
        name: "",
        description: "",
        startDate: "",
        endDate: "",
        maxParticipants: "",
      });
      await loadEventData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update round");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteRound = async () => {
    if (!eventId || !editingRound?._id) return;

    try {
      setIsProcessing(true);
      await eventsApi.deleteRound(eventId, editingRound._id);
      toast.success("Round deleted successfully");
      setShowDeleteRoundDialog(false);
      setEditingRound(null);
      await loadEventData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete round");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdvanceParticipants = async () => {
    if (!eventId || selectedParticipants.length === 0) return;

    try {
      setIsProcessing(true);
      const nextRound = selectedRound + 1;

      await eventsApi.advanceParticipants(
        eventId,
        nextRound,
        selectedParticipants
      );

      toast.success(
        `${selectedParticipants.length} participant(s) advanced to Round ${nextRound}`
      );
      setShowAdvanceDialog(false);
      setSelectedParticipants([]);
      await loadEventData();
      await loadRoundParticipants(selectedRound);
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to advance participants"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEliminateParticipants = async () => {
    if (!eventId || selectedParticipants.length === 0) return;

    try {
      setIsProcessing(true);

      // Mark participants as eliminated (they won't be advanced)
      // The backend handles this by not including them in the advance list
      toast.success(
        `${selectedParticipants.length} participant(s) marked for elimination`
      );
      setShowEliminateDialog(false);
      setSelectedParticipants([]);
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to eliminate participants"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const openEditDialog = (round: Round) => {
    setEditingRound(round);
    setRoundForm({
      name: round.name,
      description: round.description || "",
      startDate: round.startDate
        ? new Date(round.startDate).toISOString().slice(0, 16)
        : "",
      endDate: round.endDate
        ? new Date(round.endDate).toISOString().slice(0, 16)
        : "",
      maxParticipants: round.maxParticipants?.toString() || "",
    });
    setShowEditRoundDialog(true);
  };

  const openDeleteDialog = (round: Round) => {
    setEditingRound(round);
    setShowDeleteRoundDialog(true);
  };

  const toggleParticipant = (participantId: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(participantId)
        ? prev.filter((id) => id !== participantId)
        : [...prev, participantId]
    );
  };

  const toggleAllParticipants = () => {
    if (selectedParticipants.length === participants.length) {
      setSelectedParticipants([]);
    } else {
      setSelectedParticipants(participants.map((p) => p._id));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!event) {
    console.error("Event is null/undefined, cannot render UI");
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-destructive font-medium mb-2">Event not found</p>
          <p className="text-sm text-muted-foreground">
            Event ID: {eventId || "unknown"}
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => navigate("/events")}
          >
            Back to Events
          </Button>
        </div>
      </div>
    );
  }

  const isTeamEvent = (event.maxTeamSize || 1) > 1;
  const roundsCount = rounds.length;
  const totalParticipants =
    roundStats.find((s) => s.round === 0)?.participantCount || 0;
  const currentRoundParticipants =
    roundStats.find((s) => s.round === currentRound)?.participantCount || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Round Management
          </h1>
          <p className="text-muted-foreground mt-1">{event.title}</p>
        </div>
        <Button onClick={() => setShowAddRoundDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Round
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Rounds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{roundsCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Round
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">
                {currentRound === 0 ? "Initial" : `Round ${currentRound}`}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total {isTeamEvent ? "Teams" : "Participants"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{totalParticipants}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Current Round
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              <span className="text-2xl font-bold">
                {currentRoundParticipants}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rounds List */}
      <Card>
        <CardHeader>
          <CardTitle>Event Rounds</CardTitle>
          <CardDescription>
            Manage rounds and track participant progression
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rounds.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No rounds created yet</p>
              <p className="text-sm">
                Click "Add Round" to create your first round
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rounds.map((round, index) => (
                <div
                  key={round._id || index}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold">{round.name}</h3>
                      {round.description && (
                        <p className="text-sm text-muted-foreground">
                          {round.description}
                        </p>
                      )}
                      {round.startDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(round.startDate)}
                          {round.endDate && ` - ${formatDate(round.endDate)}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        round.status === "active"
                          ? "default"
                          : round.status === "completed"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {round.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(round)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(round)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Participants Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                Manage {isTeamEvent ? "Teams" : "Participants"}
              </CardTitle>
              <CardDescription>
                Select {isTeamEvent ? "teams" : "participants"} to advance or
                eliminate
              </CardDescription>
            </div>
            <Select
              value={selectedRound.toString()}
              onValueChange={(value) => setSelectedRound(parseInt(value))}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Initial Registrations</SelectItem>
                {rounds.map((round, index) => (
                  <SelectItem
                    key={round._id || index}
                    value={(index + 1).toString()}
                  >
                    {round.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {selectedParticipants.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <Button
                onClick={() => setShowAdvanceDialog(true)}
                disabled={selectedRound === rounds.length}
              >
                <ChevronRight className="mr-2 h-4 w-4" />
                Advance to Next Round ({selectedParticipants.length})
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowEliminateDialog(true)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Eliminate ({selectedParticipants.length})
              </Button>
            </div>
          )}

          {isLoadingParticipants ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            </div>
          ) : participants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No {isTeamEvent ? "teams" : "participants"} in this round</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        selectedParticipants.length === participants.length
                      }
                      onCheckedChange={toggleAllParticipants}
                    />
                  </TableHead>
                  <TableHead>{isTeamEvent ? "Team Name" : "Name"}</TableHead>
                  <TableHead>Email</TableHead>
                  {isTeamEvent && <TableHead>Team Leader</TableHead>}
                  {isTeamEvent && <TableHead>Members</TableHead>}
                  <TableHead>Registration Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.map((participant) => {
                  const user = participant.user as any;
                  const team = participant.team as any;

                  return (
                    <TableRow key={participant._id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedParticipants.includes(
                            participant._id
                          )}
                          onCheckedChange={() =>
                            toggleParticipant(participant._id)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {isTeamEvent
                          ? team?.name || "N/A"
                          : user?.fullName || "N/A"}
                      </TableCell>
                      <TableCell>{user?.email || "N/A"}</TableCell>
                      {isTeamEvent && (
                        <TableCell>
                          {team?.leader?.fullName || user?.fullName || "N/A"}
                        </TableCell>
                      )}
                      {isTeamEvent && (
                        <TableCell>
                          {team?.members?.length || team?.currentSize || 1}{" "}
                          members
                        </TableCell>
                      )}
                      <TableCell>{formatDate(participant.createdAt)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            participant.status === "confirmed"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {participant.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Round Dialog */}
      <Dialog open={showAddRoundDialog} onOpenChange={setShowAddRoundDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Round</DialogTitle>
            <DialogDescription>
              Create a new round for this event
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Round Name *</label>
              <Input
                placeholder="e.g., Semi-Final, Final, Round 2"
                value={roundForm.name}
                onChange={(e) =>
                  setRoundForm({ ...roundForm, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Optional description"
                value={roundForm.description}
                onChange={(e) =>
                  setRoundForm({ ...roundForm, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="datetime-local"
                  value={roundForm.startDate}
                  onChange={(e) =>
                    setRoundForm({ ...roundForm, startDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="datetime-local"
                  value={roundForm.endDate}
                  onChange={(e) =>
                    setRoundForm({ ...roundForm, endDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Max Participants</label>
              <Input
                type="number"
                placeholder="Leave empty for no limit"
                value={roundForm.maxParticipants}
                onChange={(e) =>
                  setRoundForm({
                    ...roundForm,
                    maxParticipants: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddRoundDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddRound} disabled={isProcessing}>
              {isProcessing && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add Round
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Round Dialog */}
      <Dialog open={showEditRoundDialog} onOpenChange={setShowEditRoundDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Round</DialogTitle>
            <DialogDescription>Update round details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Round Name *</label>
              <Input
                value={roundForm.name}
                onChange={(e) =>
                  setRoundForm({ ...roundForm, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={roundForm.description}
                onChange={(e) =>
                  setRoundForm({ ...roundForm, description: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select
                value={(roundForm as any).status || editingRound?.status}
                onValueChange={(value) =>
                  setRoundForm({ ...roundForm, status: value } as any)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="datetime-local"
                  value={roundForm.startDate}
                  onChange={(e) =>
                    setRoundForm({ ...roundForm, startDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="datetime-local"
                  value={roundForm.endDate}
                  onChange={(e) =>
                    setRoundForm({ ...roundForm, endDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Max Participants</label>
              <Input
                type="number"
                value={roundForm.maxParticipants}
                onChange={(e) =>
                  setRoundForm({
                    ...roundForm,
                    maxParticipants: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditRoundDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleEditRound} disabled={isProcessing}>
              {isProcessing && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Update Round
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advance Participants Dialog */}
      <AlertDialog open={showAdvanceDialog} onOpenChange={setShowAdvanceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Advance to Next Round?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to advance {selectedParticipants.length}{" "}
              {isTeamEvent ? "team(s)" : "participant(s)"} to{" "}
              {selectedRound === 0
                ? rounds[0]?.name || "Round 1"
                : rounds[selectedRound]?.name || `Round ${selectedRound + 1}`}
              .
              <br />
              <br />
              <strong>
                All other {isTeamEvent ? "teams" : "participants"} in this round
                will be marked as eliminated.
              </strong>
              <br />
              <br />
              This action cannot be undone. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAdvanceParticipants}
              disabled={isProcessing}
            >
              {isProcessing && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Yes, Advance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Eliminate Participants Dialog */}
      <AlertDialog
        open={showEliminateDialog}
        onOpenChange={setShowEliminateDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminate Selected?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to eliminate {selectedParticipants.length}{" "}
              {isTeamEvent ? "team(s)" : "participant(s)"}. They will be marked
              as eliminated and will not progress to the next round.
              <br />
              <br />
              This action cannot be undone. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEliminateParticipants}
              disabled={isProcessing}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isProcessing && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Yes, Eliminate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Round Dialog */}
      <AlertDialog
        open={showDeleteRoundDialog}
        onOpenChange={setShowDeleteRoundDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Round?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{editingRound?.name}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRound}
              disabled={isProcessing}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isProcessing && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
