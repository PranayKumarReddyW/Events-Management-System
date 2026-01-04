import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { teamsApi } from "@/api/teams";
import { eventsApi } from "@/api/events";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Users,
  Trophy,
  TrendingUp,
  Search,
  ChevronRight,
  XCircle,
  Target,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface TeamMember {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  profilePicture?: string;
  department?: string;
  isLeader: boolean;
}

interface TeamData {
  _id: string;
  name: string;
  description?: string;
  leader: any;
  members: any[];
  memberDetails: TeamMember[];
  maxSize: number;
  status: string;
  round: number;
  eliminated: boolean;
  score: number;
  rank?: number;
  registrationCount: number;
  inviteCode: string;
}

interface TeamsDataResponse {
  teams: TeamData[];
  totalTeams: number;
  activeTeams: number;
  eliminatedTeams: number;
  currentRound: number;
  totalRounds: number;
}

export default function EventTeamsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [event, setEvent] = useState<any>(null);
  const [teamsData, setTeamsData] = useState<TeamsDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRound, setFilterRound] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showEliminated, setShowEliminated] = useState(true);
  const [sortBy, setSortBy] = useState<"rank" | "score" | "round">("rank");
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [showRoundDialog, setShowRoundDialog] = useState(false);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [scoreInputs, setScoreInputs] = useState<
    Record<string, { score?: number; rank?: number }>
  >({});

  const isOrganizer =
    event?.organizerId === user?._id ||
    event?.organizers?.includes(user?._id) ||
    user?.role === "admin";

  useEffect(() => {
    loadData();
  }, [id, filterRound, filterStatus, showEliminated, sortBy]);

  const loadData = async () => {
    if (!id) return;

    try {
      setIsLoading(true);

      // Load event
      const eventRes = await eventsApi.getEvent(id);
      if (eventRes.data?.event) {
        setEvent(eventRes.data.event);
      }

      // Load teams with details
      const filters: any = { sortBy, order: "asc" };

      if (filterRound !== "all") {
        filters.round = parseInt(filterRound);
      }

      if (filterStatus !== "all") {
        filters.status = filterStatus;
      }

      if (!showEliminated) {
        filters.eliminated = false;
      }

      const teamsRes = await teamsApi.getEventTeamsWithDetails(id, filters);
      if (teamsRes.data) {
        setTeamsData(teamsRes.data as any);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to load teams");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTeams = teamsData?.teams.filter((team) => {
    if (search && !team.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const handleSelectTeam = (teamId: string, checked: boolean) => {
    const newSelected = new Set(selectedTeams);
    if (checked) {
      newSelected.add(teamId);
    } else {
      newSelected.delete(teamId);
    }
    setSelectedTeams(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && filteredTeams) {
      setSelectedTeams(new Set(filteredTeams.map((t) => t._id)));
    } else {
      setSelectedTeams(new Set());
    }
  };

  const handleAdvanceRound = async () => {
    if (selectedTeams.size === 0) {
      toast.error("Please select teams to advance");
      return;
    }

    try {
      await teamsApi.advanceTeamsToNextRound(id!, {
        teamIds: Array.from(selectedTeams),
        eliminate: false,
      });
      toast.success(`Advanced ${selectedTeams.size} teams to next round`);
      setSelectedTeams(new Set());
      setShowRoundDialog(false);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to advance teams");
    }
  };

  const handleEliminateTeams = async () => {
    if (selectedTeams.size === 0) {
      toast.error("Please select teams to eliminate");
      return;
    }

    try {
      await teamsApi.advanceTeamsToNextRound(id!, {
        teamIds: Array.from(selectedTeams),
        eliminate: true,
      });
      toast.success(`Eliminated ${selectedTeams.size} teams`);
      setSelectedTeams(new Set());
      setShowRoundDialog(false);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to eliminate teams");
    }
  };

  const handleUpdateScores = async () => {
    const scores = Object.entries(scoreInputs).map(([teamId, data]) => ({
      teamId,
      ...data,
    }));

    if (scores.length === 0) {
      toast.error("Please enter scores for at least one team");
      return;
    }

    try {
      await teamsApi.updateTeamScores(id!, { scores });
      toast.success(`Updated scores for ${scores.length} teams`);
      setScoreInputs({});
      setShowScoreDialog(false);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update scores");
    }
  };

  const handleUpdateCurrentRound = async (roundNumber: number) => {
    try {
      await teamsApi.updateEventCurrentRound(id!, { roundNumber });
      toast.success(`Event moved to round ${roundNumber}`);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update round");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Event Teams</h1>
              <p className="text-muted-foreground">{event?.title}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Teams
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">
                {teamsData?.totalTeams || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Teams
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">
                {teamsData?.activeTeams || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Eliminated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold">
                {teamsData?.eliminatedTeams || 0}
              </span>
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
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span className="text-2xl font-bold">
                {teamsData?.currentRound || 0}
                {teamsData?.totalRounds ? ` / ${teamsData.totalRounds}` : ""}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={filterRound} onValueChange={setFilterRound}>
          <SelectTrigger className="w-45">
            <SelectValue placeholder="Filter by Round" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rounds</SelectItem>
            {teamsData?.totalRounds &&
              Array.from({ length: teamsData.totalRounds }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  Round {i + 1}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-45">
            <SelectValue placeholder="Filter by Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="locked">Locked</SelectItem>
            <SelectItem value="disbanded">Disbanded</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="w-45">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rank">Rank</SelectItem>
            <SelectItem value="score">Score</SelectItem>
            <SelectItem value="round">Round</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Checkbox
            id="showEliminated"
            checked={showEliminated}
            onCheckedChange={(checked) => setShowEliminated(checked as boolean)}
          />
          <label htmlFor="showEliminated" className="text-sm cursor-pointer">
            Show Eliminated
          </label>
        </div>
      </div>

      {/* Organizer Actions */}
      {isOrganizer && selectedTeams.size > 0 && (
        <Card className="bg-primary/5 border-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {selectedTeams.size} team{selectedTeams.size !== 1 ? "s" : ""}{" "}
                selected
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowRoundDialog(true)}
                  variant="default"
                >
                  <ChevronRight className="mr-2 h-4 w-4" />
                  Manage Round
                </Button>
                <Button
                  onClick={() => setShowScoreDialog(true)}
                  variant="outline"
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Update Scores
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Teams Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Teams & Members</CardTitle>
            {isOrganizer && teamsData?.totalRounds && (
              <div className="flex gap-2">
                {Array.from({ length: teamsData.totalRounds }, (_, i) => (
                  <Button
                    key={i}
                    size="sm"
                    variant={
                      teamsData?.currentRound === i + 1 ? "default" : "outline"
                    }
                    onClick={() => handleUpdateCurrentRound(i + 1)}
                  >
                    Round {i + 1}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!filteredTeams || filteredTeams.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No teams found</h3>
              <p className="text-muted-foreground">
                {search
                  ? "Try adjusting your search or filters"
                  : "No teams registered yet"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isOrganizer && (
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedTeams.size === filteredTeams.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                  )}
                  <TableHead className="w-12">Rank</TableHead>
                  <TableHead>Team Name</TableHead>
                  <TableHead>Leader</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead className="text-center">Round</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeams.map((team) => (
                  <TableRow
                    key={team._id}
                    className={team.eliminated ? "opacity-50" : ""}
                  >
                    {isOrganizer && (
                      <TableCell>
                        <Checkbox
                          checked={selectedTeams.has(team._id)}
                          onCheckedChange={(checked) =>
                            handleSelectTeam(team._id, checked as boolean)
                          }
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {team.rank ? (
                          <>
                            {team.rank === 1 && (
                              <Award className="h-5 w-5 text-yellow-500" />
                            )}
                            {team.rank === 2 && (
                              <Award className="h-5 w-5 text-gray-400" />
                            )}
                            {team.rank === 3 && (
                              <Award className="h-5 w-5 text-orange-500" />
                            )}
                            <span className="font-bold">#{team.rank}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <Link
                          to={`/teams/${team._id}`}
                          className="font-medium hover:underline"
                        >
                          {team.name}
                        </Link>
                        {team.eliminated && (
                          <Badge variant="destructive" className="ml-2">
                            Eliminated
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={team.leader?.profilePicture} />
                          <AvatarFallback>
                            {team.leader?.fullName?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {team.leader?.fullName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {team.leader?.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex -space-x-2">
                        {team.memberDetails?.slice(0, 5).map((member) => (
                          <Avatar
                            key={member._id}
                            className="h-8 w-8 border-2 border-background"
                            title={member.fullName}
                          >
                            <AvatarImage src={member.profilePicture} />
                            <AvatarFallback>
                              {member.fullName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {team.memberDetails &&
                          team.memberDetails.length > 5 && (
                            <div className="h-8 w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs">
                              +{team.memberDetails.length - 5}
                            </div>
                          )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {team.members?.length || 0} / {team.maxSize} members
                      </p>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">Round {team.round}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-bold text-lg">{team.score}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          team.status === "active"
                            ? "default"
                            : team.status === "locked"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {team.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/teams/${team._id}`}>
                        <Button size="sm" variant="ghost">
                          View Details
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Round Management Dialog */}
      <Dialog open={showRoundDialog} onOpenChange={setShowRoundDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Team Rounds</DialogTitle>
            <DialogDescription>
              Advance selected teams to the next round or eliminate them from
              the competition
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              <strong>{selectedTeams.size}</strong> team
              {selectedTeams.size !== 1 ? "s" : ""} selected
            </p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowRoundDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleEliminateTeams}>
              <XCircle className="mr-2 h-4 w-4" />
              Eliminate Teams
            </Button>
            <Button onClick={handleAdvanceRound}>
              <ChevronRight className="mr-2 h-4 w-4" />
              Advance to Next Round
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Score Update Dialog */}
      <Dialog open={showScoreDialog} onOpenChange={setShowScoreDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Team Scores</DialogTitle>
            <DialogDescription>
              Enter scores and ranks for the selected teams
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {Array.from(selectedTeams).map((teamId) => {
              const team = filteredTeams?.find((t) => t._id === teamId);
              if (!team) return null;

              return (
                <div
                  key={teamId}
                  className="flex items-center gap-4 p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{team.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Current: Score {team.score}, Rank {team.rank || "-"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">
                        Score
                      </label>
                      <Input
                        type="number"
                        placeholder="Score"
                        className="w-24"
                        value={scoreInputs[teamId]?.score || ""}
                        onChange={(e) =>
                          setScoreInputs({
                            ...scoreInputs,
                            [teamId]: {
                              ...scoreInputs[teamId],
                              score: parseInt(e.target.value) || undefined,
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        Rank
                      </label>
                      <Input
                        type="number"
                        placeholder="Rank"
                        className="w-24"
                        value={scoreInputs[teamId]?.rank || ""}
                        onChange={(e) =>
                          setScoreInputs({
                            ...scoreInputs,
                            [teamId]: {
                              ...scoreInputs[teamId],
                              rank: parseInt(e.target.value) || undefined,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScoreDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateScores}>
              <TrendingUp className="mr-2 h-4 w-4" />
              Update Scores
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
