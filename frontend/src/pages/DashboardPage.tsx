import { useAuth } from "@/hooks/useAuth";
import { useEvents } from "@/hooks/useEvents";
import { useMyRegistrations } from "@/hooks/useRegistrations";
import { Link, Navigate } from "react-router-dom";
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

  // Redirect admins to analytics instead of dashboard
  if (user?.role === "admin" || user?.role === "super_admin") {
    return <Navigate to="/admin/analytics" replace />;
  }

  // Fetch only upcoming events (not completed)
  const { data: eventsData, isLoading: eventsLoading } = useEvents({
    page: 1,
    limit: 5,
    status: "upcoming",
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
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {user?.fullName?.split(" ")[0]}!
          </h1>
          <p className="text-sm text-muted-foreground">
            Here's what's happening with your events
          </p>
        </div>
        {user?.role === "department_organizer" && (
          <Button asChild size="default" className="shadow-sm">
            <Link to="/events/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Event
            </Link>
          </Button>
        )}
      </div>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="shadow-sm hover:shadow-md transition-shadow"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2.5 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Events */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl">Upcoming Events</CardTitle>
                <CardDescription className="text-sm">
                  Latest events you might be interested in
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/events" className="text-sm">
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
              <div className="space-y-3">
                {eventsData?.data?.events.slice(0, 5).map((event: any) => (
                  <Link
                    key={event._id}
                    to={`/events/${event._id}`}
                    className="block group"
                  >
                    <div className="flex items-start justify-between gap-4 p-4 rounded-lg border hover:bg-accent hover:border-accent-foreground/20 transition-all">
                      <div className="flex-1 min-w-0 space-y-1">
                        <h4 className="font-semibold group-hover:text-primary transition-colors line-clamp-1 text-sm">
                          {event.title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          <span>{formatDate(event.startDate)}</span>
                        </div>
                      </div>
                      <Badge
                        variant={event.isPaid ? "default" : "secondary"}
                        className="shrink-0 text-xs"
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
      </div>
      {/* Quick Actions */}
      {user?.role === "student" && (
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="space-y-1">
              <CardTitle className="text-xl">Quick Actions</CardTitle>
              <CardDescription className="text-sm">
                Common tasks you might want to perform
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                asChild
                className="h-auto py-8 hover:bg-accent hover:shadow-sm transition-all"
              >
                <Link to="/events" className="flex flex-col items-center gap-3">
                  <Calendar className="h-8 w-8" />
                  <span className="font-medium">Browse Events</span>
                </Link>
              </Button>
              <Button
                variant="outline"
                asChild
                className="h-auto py-8 hover:bg-accent hover:shadow-sm transition-all"
              >
                <Link to="/teams" className="flex flex-col items-center gap-3">
                  <Users className="h-8 w-8" />
                  <span className="font-medium">My Teams</span>
                </Link>
              </Button>
              <Button
                variant="outline"
                asChild
                className="h-auto py-8 hover:bg-accent hover:shadow-sm transition-all"
              >
                <Link
                  to="/certificates"
                  className="flex flex-col items-center gap-3"
                >
                  <Award className="h-8 w-8" />
                  <span className="font-medium">My Certificates</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
