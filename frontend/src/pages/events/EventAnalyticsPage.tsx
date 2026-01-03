import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { eventsApi } from "@/api/events";
import { registrationsApi } from "@/api/registrations";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Users,
  DollarSign,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  Trophy,
  Award,
  Target,
} from "lucide-react";
import { formatCurrency } from "@/utils/helpers";

export default function EventAnalyticsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const { data: eventData, isLoading: eventLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => eventsApi.getEvent(eventId!),
    enabled: !!eventId,
  });

  const { data: registrationsData, isLoading: registrationsLoading } = useQuery(
    {
      queryKey: ["event-registrations", eventId],
      queryFn: async () => {
        const response: any = await registrationsApi.getEventRegistrations(
          eventId!,
          {
            limit: 1000,
          }
        );
        return response;
      },
      enabled: !!eventId,
    }
  );

  const event = eventData?.data?.event;
  const registrations = registrationsData?.data || [];
  const stats = registrationsData?.stats || {};

  const isLoading = eventLoading || registrationsLoading;

  // Calculate additional metrics
  const totalRevenue = registrations
    .filter((r: any) => r.paymentStatus === "paid")
    .reduce((sum: number) => sum + (event?.amount || 0), 0);

  const checkInRate =
    stats.confirmed > 0 ? ((stats.checkedIn || 0) / stats.confirmed) * 100 : 0;

  const conversionRate =
    stats.totalRegistrations > 0
      ? (stats.confirmed / stats.totalRegistrations) * 100
      : 0;

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold mb-2">Event Analytics</h1>
          {event && (
            <p className="text-muted-foreground">
              Analytics for "{event.title}"
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading analytics...
        </div>
      ) : !event ? (
        <div className="text-center py-12 text-muted-foreground">
          Event not found
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Total Registrations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {stats.totalRegistrations || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {event.maxParticipants
                    ? `of ${event.maxParticipants} max`
                    : "No limit"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {stats.confirmed || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {conversionRate.toFixed(1)}% conversion rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Check-In Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {checkInRate.toFixed(0)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.checkedIn || 0} of {stats.confirmed || 0} checked in
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {event.isPaid ? formatCurrency(totalRevenue) : "Free"}
                </div>
                {event.isPaid && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.paidCount || 0} paid registrations
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Registration Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Registration Status Breakdown
              </CardTitle>
              <CardDescription>
                Overview of all registration statuses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Confirmed</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {stats.confirmed || 0}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-medium">Pending</span>
                  </div>
                  <div className="text-2xl font-bold">{stats.pending || 0}</div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Waitlisted</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {stats.waitlisted || 0}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium">Cancelled</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {stats.cancelled || 0}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">Rejected</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {stats.rejected || 0}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Event Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Event Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="default">{event.status}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium">{event.eventType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mode:</span>
                  <span className="font-medium">{event.eventMode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Team Event:</span>
                  <span className="font-medium">
                    {event.maxTeamSize > 1 ? "Yes" : "No"}
                  </span>
                </div>
                {event.maxTeamSize > 1 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Team Size:</span>
                    <span className="font-medium">
                      {event.minTeamSize} - {event.maxTeamSize}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Certificates:</span>
                  <span className="font-medium">
                    {event.certificateProvided ? "Yes" : "No"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {event.isPaid && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Payment Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Registration Fee:
                    </span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(event.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Total Revenue:
                    </span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(totalRevenue)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paid:</span>
                    <Badge variant="default">{stats.paidCount || 0}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pending:</span>
                    <Badge variant="secondary">
                      {(stats.confirmed || 0) - (stats.paidCount || 0)}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Expected Revenue:
                    </span>
                    <span className="font-medium">
                      {formatCurrency(
                        (stats.confirmed || 0) * (event.amount || 0)
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Rounds Information if applicable */}
          {event.rounds && event.rounds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Round Progression
                </CardTitle>
                <CardDescription>
                  Multi-round event progression tracking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Award className="h-5 w-5 text-yellow-500" />
                    <div>
                      <div className="font-semibold">Current Round</div>
                      <div className="text-2xl font-bold">
                        {event.currentRound || 0}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {event.rounds.map((round: any, index: number) => (
                      <div
                        key={index}
                        className="p-3 border rounded-lg space-y-1"
                      >
                        <div className="font-medium">{round.name}</div>
                        <Badge
                          variant={
                            round.status === "completed"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {round.status}
                        </Badge>
                        {round.maxParticipants && (
                          <div className="text-sm text-muted-foreground">
                            Max: {round.maxParticipants} participants
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Manage your event from here</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="default">
                  <a href={`/events/${eventId}/participants`}>
                    <Users className="h-4 w-4 mr-2" />
                    Manage Participants
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={`/events/${eventId}/results`}>
                    <Trophy className="h-4 w-4 mr-2" />
                    Add Results
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={`/events/${eventId}/edit`}>Edit Event</a>
                </Button>
                <Button asChild variant="outline">
                  <a href={`/events/${eventId}`}>View Public Page</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
