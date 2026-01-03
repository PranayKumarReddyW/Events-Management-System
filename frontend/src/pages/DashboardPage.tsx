import { useAuth } from "@/hooks/useAuth";
import { useEvents } from "@/hooks/useEvents";
import { useMyRegistrations } from "@/hooks/useRegistrations";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  Users,
  TrendingUp,
  Clock,
  Award,
  Plus,
  ArrowRight,
} from "lucide-react";
import { formatDate, getEventStatus } from "@/utils/date";
import { formatCurrency } from "@/utils/helpers";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: eventsData, isLoading: eventsLoading } = useEvents({
    page: 1,
    limit: 5,
    status: "published",
    sortBy: "startDate",
    order: "asc",
  });
  const { data: registrations, isLoading: registrationsLoading } =
    useMyRegistrations({ limit: 5 });

  const stats = [
    {
      title: "Upcoming Events",
      value: eventsData?.data?.pagination?.total || 0,
      icon: Calendar,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "My Registrations",
      value: registrations?.data?.length || 0,
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Events Attended",
      value:
        registrations?.data?.filter((r: any) => r.checkInTime)?.length || 0,
      icon: Award,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Certificates Earned",
      value:
        registrations?.data?.filter((r: any) => r.certificate)?.length || 0,
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {user?.fullName?.split(" ")[0]}!
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with your events
          </p>
        </div>
        <Button asChild>
          <Link to="/events/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Event
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Upcoming Events</CardTitle>
                <CardDescription>
                  Latest events you might be interested in
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/events">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : eventsData?.data?.events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No upcoming events
              </p>
            ) : (
              <div className="space-y-4">
                {eventsData?.data?.events.slice(0, 5).map((event: any) => (
                  <Link
                    key={event._id}
                    to={`/events/${event._id}`}
                    className="block group"
                  >
                    <div className="flex items-start justify-between gap-4 p-3 rounded-lg hover:bg-muted transition-colors">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium group-hover:text-primary transition-colors line-clamp-1">
                          {event.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatDate(event.startDate)}</span>
                        </div>
                      </div>
                      <Badge
                        variant={event.isPaid ? "default" : "secondary"}
                        className="shrink-0"
                      >
                        {event.isPaid
                          ? formatCurrency(event.registrationFee || 0)
                          : "Free"}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Registrations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>My Registrations</CardTitle>
                <CardDescription>
                  Your recent event registrations
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/registrations">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {registrationsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : registrations?.data?.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">
                  You haven't registered for any events yet
                </p>
                <Button asChild size="sm">
                  <Link to="/events">Browse Events</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {registrations?.data?.slice(0, 5).map((registration: any) => {
                  const eventStatus = getEventStatus(
                    registration.event.startDate,
                    registration.event.endDate,
                    registration.event.status
                  );
                  return (
                    <Link
                      key={registration._id}
                      to={`/events/${registration.event._id}`}
                      className="block group"
                    >
                      <div className="flex items-start justify-between gap-4 p-3 rounded-lg hover:bg-muted transition-colors">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium group-hover:text-primary transition-colors line-clamp-1">
                            {registration.event.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>
                              {formatDate(registration.event.startDate)}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={eventStatus.variant}>
                            {eventStatus.label}
                          </Badge>
                          {registration.checkInTime && (
                            <Badge variant="outline" className="text-xs">
                              Attended
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks you might want to perform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" asChild className="h-auto py-6">
              <Link to="/events" className="flex flex-col items-center gap-2">
                <Calendar className="h-6 w-6" />
                <span>Browse Events</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-6">
              <Link to="/teams" className="flex flex-col items-center gap-2">
                <Users className="h-6 w-6" />
                <span>My Teams</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-6">
              <Link
                to="/certificates"
                className="flex flex-col items-center gap-2"
              >
                <Award className="h-6 w-6" />
                <span>My Certificates</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
