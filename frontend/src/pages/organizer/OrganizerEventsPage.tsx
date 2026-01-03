import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { eventsApi } from "@/api";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  MapPin,
  Users,
  Plus,
  Edit,
  Eye,
  Search,
  Trophy,
  BarChart3,
} from "lucide-react";
import { formatDateRange, getEventStatus } from "@/utils/date";
import { formatCurrency } from "@/utils/helpers";
import { API_BASE_URL, EVENT_TYPES } from "@/constants";

export default function OrganizerEventsPage() {
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    eventType: "all",
  });

  const { data: eventsData, isLoading } = useQuery({
    queryKey: ["myEvents"],
    queryFn: () => eventsApi.getMyEvents(),
  });

  const allEvents = eventsData?.data?.events || [];

  // Filter events based on search and filters
  const events = useMemo(() => {
    return allEvents.filter((event: any) => {
      const matchesSearch =
        filters.search === "" ||
        event.title?.toLowerCase().includes(filters.search.toLowerCase()) ||
        event.description?.toLowerCase().includes(filters.search.toLowerCase());

      const matchesStatus =
        filters.status === "all" || event.status === filters.status;

      const matchesType =
        filters.eventType === "all" || event.eventType === filters.eventType;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [allEvents, filters]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({
      ...prev,
      search: e.target.value,
    }));
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "default";
      case "draft":
        return "secondary";
      case "completed":
        return "outline";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Events</h1>
            <p className="text-muted-foreground">Manage your created events</p>
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Events</h1>
          <p className="text-muted-foreground">
            Manage events you've created and track their progress
          </p>
        </div>
        <Button asChild>
          <Link to="/events/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Event
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={filters.search}
            onChange={handleSearchChange}
            className="pl-10"
          />
        </div>
        <Select
          value={filters.status}
          onValueChange={(value) => handleFilterChange("status", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.eventType}
          onValueChange={(value) => handleFilterChange("eventType", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Event Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {EVENT_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Events Grid */}
      {events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {filters.search ||
              filters.status !== "all" ||
              filters.eventType !== "all"
                ? "No events found"
                : "No events yet"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              {filters.search ||
              filters.status !== "all" ||
              filters.eventType !== "all"
                ? "Try adjusting your filters"
                : "You haven't created any events yet. Start by creating your first event."}
            </p>
            <Button asChild>
              <Link to="/events/create">
                <Plus className="mr-2 h-4 w-4" />
                Create First Event
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event: any) => {
            const imageUrl = event.bannerImage?.startsWith("data:")
              ? event.bannerImage
              : event.bannerImage
              ? `${API_BASE_URL}${event.bannerImage}`
              : null;

            const registeredCount = event.registeredCount || 0;

            return (
              <Card
                key={event._id}
                className="flex flex-col hover:shadow-lg transition-shadow"
              >
                {imageUrl && (
                  <div className="relative h-48 w-full overflow-hidden rounded-t-lg bg-muted">
                    <img
                      src={imageUrl}
                      alt={event.title}
                      className="object-cover w-full h-full"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <div className="absolute top-2 right-2 flex gap-2">
                      <Badge variant={event.isPaid ? "default" : "secondary"}>
                        {event.isPaid
                          ? formatCurrency(event.amount || 0)
                          : "Free"}
                      </Badge>
                    </div>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-2">
                      {event.title}
                    </CardTitle>
                    <Badge variant="outline">
                      {EVENT_TYPES.find((t) => t.value === event.eventType)
                        ?.label || event.eventType}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {event.description?.replace(/<[^>]*>/g, "") ||
                      "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {formatDateRange(event.startDateTime, event.endDateTime)}
                    </span>
                  </div>
                  {event.venue && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className="line-clamp-1">{event.venue}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>
                      {registeredCount}
                      {event.maxParticipants
                        ? ` / ${event.maxParticipants}`
                        : ""}{" "}
                      registered
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2 pt-4">
                  <div className="w-full flex items-center justify-between">
                    <Badge variant={getStatusColor(event.status) as any}>
                      {event.status.charAt(0).toUpperCase() +
                        event.status.slice(1)}
                    </Badge>
                    {event.status === "published" && (
                      <Badge variant="outline">
                        {
                          getEventStatus(
                            event.startDateTime,
                            event.endDateTime,
                            event.status
                          ).label
                        }
                      </Badge>
                    )}
                  </div>
                  <div className="w-full flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      asChild
                    >
                      <Link to={`/events/${event._id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      asChild
                    >
                      <Link to={`/events/${event._id}/edit`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </Button>
                  </div>
                  <div className="w-full grid grid-cols-3 gap-2">
                    <Button variant="secondary" size="sm" asChild>
                      <Link to={`/events/${event._id}/participants`}>
                        <Users className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="secondary" size="sm" asChild>
                      <Link to={`/events/${event._id}/results`}>
                        <Trophy className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="secondary" size="sm" asChild>
                      <Link to={`/events/${event._id}/analytics`}>
                        <BarChart3 className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
