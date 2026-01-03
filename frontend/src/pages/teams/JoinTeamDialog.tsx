import { useState } from "react";
import { useJoinTeam } from "@/hooks/useTeams";
import { Button } from "@/components/ui/button";
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
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

export function JoinTeamDialog() {
  const [open, setOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const joinTeam = useJoinTeam();

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      toast.error("Please enter an invite code");
      return;
    }

    try {
      await joinTeam.mutateAsync({ inviteCode: inviteCode.trim() });
      toast.success("Successfully joined team!");
      setInviteCode("");
      setOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to join team");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="mr-2 h-4 w-4" />
          Join with Code
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join Team</DialogTitle>
          <DialogDescription>
            Enter the invite code shared by your team leader to join their team.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="inviteCode">Invite Code</Label>
            <Input
              id="inviteCode"
              placeholder="Enter 6-character code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === "Enter" && handleJoin()}
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
              setOpen(false);
              setInviteCode("");
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleJoin}
            disabled={!inviteCode.trim() || joinTeam.isPending}
          >
            {joinTeam.isPending ? "Joining..." : "Join Team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
