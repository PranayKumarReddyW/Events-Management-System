import { useParams, useNavigate, Link } from "react-router-dom";
import {
  useTeam,
  useDisbandTeam,
  useAddTeamMember,
  useRemoveTeamMember,
  useLockTeam,
  useUnlockTeam,
} from "@/hooks/useTeams";
import type { Team } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
  Crown,
  Users,
  Calendar,
  Copy,
  UserPlus,
  UserMinus,
  Trash2,
  Check,
  Lock,
  Unlock,
} from "lucide-react";
import { formatDate } from "@/utils/date";
import { toast } from "sonner";

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: teamResponse, isLoading } = useTeam(id!);
  const deleteTeam = useDisbandTeam();
  const addMember = useAddTeamMember();
  const removeMember = useRemoveTeamMember();
  const lockTeam = useLockTeam();
  const unlockTeam = useUnlockTeam();

  const [memberEmail, setMemberEmail] = useState("");
  const [copied, setCopied] = useState(false);

  const team: Team | undefined = teamResponse?.data;
  // Handle both populated and non-populated leader field
  const leaderId =
    typeof team?.leader === "string" ? team.leader : (team as any)?.leader?._id;
  const isLeader = leaderId === user?._id;

  const handleCopyInviteCode = async () => {
    if (team?.inviteCode) {
      try {
        const code = team.inviteCode.trim().toUpperCase();
        await navigator.clipboard.writeText(code);
        setCopied(true);
        toast.success(`Invite code copied: ${code}`);
        console.log("[Copy] Copied invite code:", code);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("[Copy] Failed to copy:", err);
        toast.error("Failed to copy invite code");
      }
    }
  };

  const handleAddMember = async () => {
    // VALIDATION: Check member email
    if (!memberEmail?.trim()) {
      toast.error("Please enter member email");
      return;
    }

    // NULL CHECK: Validate team ID
    if (!id) {
      toast.error("Invalid team");
      return;
    }

    // DOUBLE-CLICK PREVENTION: Check pending state
    if (addMember.isPending) {
      return;
    }

    try {
      await addMember.mutateAsync({
        id: id!,
        data: { email: memberEmail.trim() },
      });
      toast.success("Member invited successfully!");
      setMemberEmail("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to add member");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    // NULL CHECK: Validate memberId and team ID
    if (!memberId) {
      toast.error("Invalid member");
      return;
    }
    if (!id) {
      toast.error("Invalid team");
      return;
    }

    // DOUBLE-CLICK PREVENTION: Check pending state
    if (removeMember.isPending) {
      return;
    }

    try {
      await removeMember.mutateAsync({ id: id!, userId: memberId });
      toast.success("Member removed successfully!");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to remove member");
    }
  };

  const handleDeleteTeam = async () => {
    // NULL CHECK: Validate team ID
    if (!id) {
      toast.error("Invalid team");
      return;
    }

    // DOUBLE-CLICK PREVENTION: Check pending state
    if (deleteTeam.isPending) {
      return;
    }

    try {
      await deleteTeam.mutateAsync(id);
      toast.success("Team deleted successfully!");
      navigate("/teams");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete team");
    }
  };

  const handleLockTeam = async () => {
    // NULL CHECK: Validate team ID
    if (!id) {
      toast.error("Invalid team");
      return;
    }

    // DOUBLE-CLICK PREVENTION: Check pending state
    if (lockTeam.isPending) {
      return;
    }

    try {
      await lockTeam.mutateAsync(id);
      toast.success("Team locked successfully! No more changes allowed.");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to lock team");
    }
  };

  const handleUnlockTeam = async () => {
    // NULL CHECK: Validate team ID
    if (!id) {
      toast.error("Invalid team");
      return;
    }

    // DOUBLE-CLICK PREVENTION: Check pending state
    if (unlockTeam.isPending) {
      return;
    }

    try {
      await unlockTeam.mutateAsync(id);
      toast.success("Team unlocked! Members can now join.");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to unlock team");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-destructive font-medium">Team not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Details</h1>
        </div>
        {isLeader && (
          <div className="flex gap-2">
            {team.status === "locked" ? (
              <Button
                variant="outline"
                onClick={handleUnlockTeam}
                disabled={unlockTeam.isPending}
              >
                <Unlock className="mr-2 h-4 w-4" />
                Unlock Team
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleLockTeam}
                disabled={lockTeam.isPending}
              >
                <Lock className="mr-2 h-4 w-4" />
                Lock Team
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Team
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete
                    the team and remove all members.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteTeam}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-3xl">{team.name}</CardTitle>
              {team.description && (
                <CardDescription className="text-base">
                  {team.description}
                </CardDescription>
              )}
            </div>
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
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Event</p>
                <Link
                  to={`/events/${
                    typeof team.event === "string"
                      ? team.event
                      : (team.event as any)?._id
                  }`}
                  className="text-primary hover:underline"
                >
                  {typeof team.event === "string"
                    ? team.event
                    : (team.event as any)?.title || "N/A"}
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Team Size</p>
                <p className="font-medium">
                  {team.members?.length || 0} / {team.maxSize}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">{formatDate(team.createdAt)}</p>
              </div>
            </div>
          </div>

          {isLeader && (
            <div className="space-y-3 p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">Team Invite Code</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Share this code with members to let them join
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyInviteCode}
                >
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4 text-green-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Code
                    </>
                  )}
                </Button>
              </div>
              <div className="p-4 rounded-md bg-background border-2 border-dashed">
                <code className="text-2xl font-bold tracking-wider text-primary select-all">
                  {team.inviteCode || "Loading..."}
                </code>
                <p className="text-xs text-muted-foreground mt-2">
                  Code length: {team.inviteCode?.length || 0} characters
                </p>
              </div>
            </div>
          )}

          {team.status === "locked" && (
            <div className="p-4 rounded-lg border-2 border-yellow-500/20 bg-yellow-50 dark:bg-yellow-950/20">
              <div className="flex items-center gap-2 text-yellow-900 dark:text-yellow-100">
                <Lock className="h-5 w-5" />
                <p className="font-semibold">
                  Team is locked - No members can join or leave
                </p>
              </div>
            </div>
          )}

          {isLeader && !team.isFull && team.status !== "locked" && (
            <div className="space-y-3 p-4 rounded-lg border">
              <h3 className="font-semibold">Add Member</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter member email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddMember()}
                />
                <Button
                  onClick={handleAddMember}
                  disabled={!memberEmail || addMember.isPending}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Members ({team.members?.length || 0})</CardTitle>
          <CardDescription>
            {team.isFull
              ? "Team is full"
              : `${team.maxSize - (team.members?.length || 0)} slots remaining`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {team.members?.map((member: any) => {
              const memberId = typeof member === "string" ? member : member._id;
              const isMemberLeader = memberId === leaderId;
              return (
                <div
                  key={memberId}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src={member.profilePicture} />
                      <AvatarFallback>
                        {member.fullName?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{member.fullName}</p>
                        {isMemberLeader && (
                          <Badge variant="secondary">
                            <Crown className="mr-1 h-3 w-3" />
                            Leader
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {member.email}
                      </p>
                      {member.department && (
                        <p className="text-sm text-muted-foreground">
                          {member.department}
                        </p>
                      )}
                    </div>
                  </div>
                  {isLeader && !isMemberLeader && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <UserMinus className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Member?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove {member.fullName}{" "}
                            from the team?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveMember(memberId)}
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
