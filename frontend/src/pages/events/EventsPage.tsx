import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useEvents } from "@/hooks/useEvents";
import { useAuth } from "@/hooks/useAuth";
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
import { Calendar, MapPin, Users, Search, Plus } from "lucide-react";
import { formatDateRange, getEventStatus } from "@/utils/date";
import { formatCurrency } from "@/utils/helpers";
import { EVENT_TYPES, API_BASE_URL } from "@/constants";
import type { EventFilters } from "@/api";
import { CapacityBadge } from "@/components/events/CapacityIndicator";

export default function EventsPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<EventFilters>({
    page: 1,
    limit: 12,
    search: "",
  });

  // Memoize filters to prevent infinite re-renders
  const stableFilters = useMemo(
    () => filters,
    [
      filters.page,
      filters.limit,
      filters.search,
      filters.status,
      filters.sortBy,
      filters.order,
      filters.eventType,
      filters.mode,
      filters.registrationStatus,
      filters.teamType,
    ]
  );

  const { data: eventsData, isLoading, isError } = useEvents(stableFilters);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev: EventFilters) => ({
      ...prev,
      search: e.target.value,
      page: 1,
    }));
  };

  const handleFilterChange = (key: keyof EventFilters, value: any) => {
    setFilters((prev: EventFilters) => ({ ...prev, [key]: value, page: 1 }));
  };

  if (isError) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-destructive font-medium">Failed to load events</p>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground">
            {user?.role === "student"
              ? "Discover and register for upcoming events"
              : "Browse and manage events"}
          </p>
        </div>
        {["department_organizer", "faculty"].includes(user?.role || "") && (
          <Button asChild>
            <Link to="/events/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Event
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={filters.search}
              onChange={handleSearchChange}
              className="pl-10"
            />
          </div>
        </div>
        <Select
          value={filters.eventType}
          onValueChange={(value) =>
            handleFilterChange("eventType", value === "all" ? undefined : value)
          }
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
        <Select
          value={filters.mode}
          onValueChange={(value) =>
            handleFilterChange("mode", value === "all" ? undefined : value)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Event Mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modes</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
            <SelectItem value="hybrid">Hybrid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Select
          value={filters.registrationStatus}
          onValueChange={(value) =>
            handleFilterChange(
              "registrationStatus",
              value === "all" ? undefined : value
            )
          }
        >
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Registration Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="open">Open for Registration</SelectItem>
            <SelectItem value="closed">Registration Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.sortBy}
          onValueChange={(value) =>
            handleFilterChange("sortBy", value || undefined)
          }
        >
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="startDate">Start Date</SelectItem>
            <SelectItem value="createdAt">Created At</SelectItem>
            <SelectItem value="title">Title</SelectItem>
            <SelectItem value="registeredCount">Registrations</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.teamType}
          onValueChange={(value) =>
            handleFilterChange("teamType", value === "all" ? undefined : value)
          }
        >
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Team Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="solo">Individual Only</SelectItem>
            <SelectItem value="team">Team Events</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-6 w-3/4 mt-4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : eventsData?.data?.events.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No events found</h3>
          <p className="text-muted-foreground">Try adjusting your filters</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {eventsData?.data?.events.map((event: any) => (
              <Link key={event._id} to={`/events/${event._id}`}>
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                  {event.bannerImage && (
                    <div className="relative h-48 w-full overflow-hidden rounded-t-lg bg-muted">
                      <img
                        src={
                          event.bannerImage.startsWith("data:image")
                            ? event.bannerImage
                            : `${API_BASE_URL}${event.bannerImage}`
                        }
                        alt={event.title}
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          console.error(
                            "Image failed to load:",
                            event.bannerImage
                          );
                          e.currentTarget.style.display = "none";
                        }}
                      />
                      <div className="absolute top-2 right-2">
                        <Badge variant={event.isPaid ? "default" : "secondary"}>
                          {event.isPaid
                            ? formatCurrency(event.registrationFee || 0)
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
                        {
                          EVENT_TYPES.find((t) => t.value === event.eventType)
                            ?.label
                        }
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {event.description?.replace(/<[^>]*>/g, "") ||
                        "No description"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {formatDateRange(event.startDate, event.endDate)}
                      </span>
                    </div>
                    {event.venue && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="line-clamp-1">{event.venue}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>
                          {event.registeredCount || 0}
                          {event.maxParticipants
                            ? ` / ${event.maxParticipants}`
                            : ""}{" "}
                          registered
                        </span>
                      </div>
                      {event.maxParticipants && (
                        <CapacityBadge
                          currentCount={event.registeredCount || 0}
                          maxCapacity={event.maxParticipants}
                        />
                      )}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Badge
                      variant={
                        getEventStatus(
                          event.startDate,
                          event.endDate,
                          event.status
                        ).label === "Upcoming"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {
                        getEventStatus(
                          event.startDate,
                          event.endDate,
                          event.status
                        ).label
                      }
                    </Badge>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>

          {eventsData &&
            eventsData.data?.pagination &&
            eventsData.data.pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  onClick={() =>
                    setFilters((prev: EventFilters) => ({
                      ...prev,
                      page: Math.max(1, prev.page! - 1),
                    }))
                  }
                  disabled={eventsData.data?.pagination?.page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {eventsData.data?.pagination?.page || 1} of{" "}
                  {eventsData.data?.pagination?.pages || 1}
                </span>
                <Button
                  variant="outline"
                  onClick={() =>
                    setFilters((prev: EventFilters) => ({
                      ...prev,
                      page: prev.page! + 1,
                    }))
                  }
                  disabled={
                    eventsData.data?.pagination?.page ===
                    eventsData.data?.pagination?.pages
                  }
                >
                  Next
                </Button>
              </div>
            )}
        </>
      )}
    </div>
  );
}
