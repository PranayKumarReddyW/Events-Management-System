import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useMyTeams } from "@/hooks/useTeams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Search, Plus, Crown, Calendar } from "lucide-react";
import { formatDate } from "@/utils/date";
import { JoinTeamDialog } from "./JoinTeamDialog";

export default function TeamsPage() {
  const [search, setSearch] = useState("");
  const { data: teamsData, isLoading, refetch } = useMyTeams();

  // Refetch teams when component mounts to ensure fresh data
  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Teams</h1>
          <p className="text-muted-foreground">
            Manage your event teams and collaborations
          </p>
        </div>
        <div className="flex gap-2">
          <JoinTeamDialog />
          <Button asChild>
            <Link to="/teams/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Team
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
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
      ) : Array.isArray(teamsData?.data) && teamsData.data.length === 0 ? (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No teams found</h3>
          <p className="text-muted-foreground">
            {search
              ? "Try adjusting your search"
              : "Create a team to get started"}
          </p>
          {!search && (
            <Button asChild className="mt-4">
              <Link to="/teams/create">Create Team</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.isArray(teamsData?.data) &&
            teamsData.data.map((team: any) => {
              // NULL CHECK: Validate team object
              if (!team?._id) return null;

              return (
                <Link key={team._id} to={`/teams/${team._id}`}>
                  <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="line-clamp-2">
                          {team.name || "Untitled Team"}
                        </CardTitle>
                        <Badge
                          variant={
                            team.status === "active"
                              ? "default"
                              : team.status === "locked"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {team.status || "unknown"}
                        </Badge>
                      </div>
                      {team.description && (
                        <CardDescription className="line-clamp-2">
                          {team.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Event:</span>
                        <span className="font-medium line-clamp-1">
                          {team.event?.title || "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Crown className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Leader:</span>
                        <span className="font-medium">
                          {team.leader?.fullName || "Unknown"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Members:</span>
                        <span className="font-medium">
                          {team.members?.length || 0} / {team.maxSize || 0}
                        </span>
                        {team.isFull && (
                          <Badge variant="outline" className="ml-auto">
                            Full
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="text-xs text-muted-foreground">
                      Created {formatDate(team.createdAt)}
                    </CardFooter>
                  </Card>
                </Link>
              );
            })}
        </div>
      )}
    </div>
  );
}
