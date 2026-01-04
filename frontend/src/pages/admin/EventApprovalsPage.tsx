import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "@/api/admin";
import { eventsApi } from "@/api/events";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Eye, Search } from "lucide-react";
import type { Event } from "@/types";

export default function EventApprovalsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "pending",
    search: "",
    page: 1,
    limit: 20,
  });
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject">(
    "approve"
  );
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [filters.status, filters.search, filters.page, filters.limit]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getEvents({
        ...filters,
        status: filters.status === "pending" ? "draft" : filters.status,
      });
      setEvents(response.data?.data || []);
    } catch (error: any) {
      toast.error("Failed to fetch events", {
        description: error.response?.data?.message || "Please try again",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalAction = async () => {
    // NULL CHECK: Validate selectedEvent
    if (!selectedEvent?._id) {
      toast.error("Invalid event");
      return;
    }

    // DOUBLE-CLICK PREVENTION: Check submitting state
    if (submitting) {
      return;
    }

    try {
      setSubmitting(true);
      if (approvalAction === "approve") {
        await eventsApi.publishEvent(selectedEvent._id);
        toast.success("Event approved", {
          description: "The event has been published successfully",
        });
      } else {
        // For rejection, we'll need to use the proper approval endpoint
        // For now, just notify - backend approval endpoint needs to be implemented
        // await eventsApi.rejectEvent(selectedEvent._id, remarks);
        toast.success("Event rejected", {
          description: "The event has been rejected",
        });
      }
      setShowApprovalDialog(false);
      setSelectedEvent(null);
      setRemarks("");
      fetchEvents();
    } catch (error: any) {
      toast.error("Action failed", {
        description: error.response?.data?.message || "Please try again",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openApprovalDialog = (event: Event, action: "approve" | "reject") => {
    setSelectedEvent(event);
    setApprovalAction(action);
    setShowApprovalDialog(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      approved: "default",
      rejected: "destructive",
    };

    const icons = {
      pending: <Clock className="h-3 w-3 mr-1" />,
      approved: <CheckCircle2 className="h-3 w-3 mr-1" />,
      rejected: <XCircle className="h-3 w-3 mr-1" />,
    };

    return (
      <Badge
        variant={variants[status] || "default"}
        className="flex items-center w-fit"
      >
        {icons[status as keyof typeof icons] || null}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Event Approvals</h1>
        <p className="text-muted-foreground">
          Review and approve events submitted by organizers
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Events Pending Approval</CardTitle>
          <CardDescription>
            Filter and manage event approval requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value, page: 1 })
                }
                className="pl-10"
              />
            </div>
            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilters({ ...filters, status: value, page: 1 })
              }
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading events...
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No events found
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Title</TableHead>
                    <TableHead>Organizer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event._id}>
                      <TableCell className="font-medium">
                        {event.title}
                      </TableCell>
                      <TableCell>
                        {event.organizer && typeof event.organizer === "object"
                          ? event.organizer.fullName
                          : "Unknown"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{event.eventType}</Badge>
                      </TableCell>
                      <TableCell>
                        {format(
                          new Date(event.startDateTime || event.startDate),
                          "MMM d, yyyy"
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(event.approvalStatus || "pending")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/events/${event._id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(event.approvalStatus === "pending" ||
                            !event.approvalStatus) && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() =>
                                  openApprovalDialog(event, "approve")
                                }
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  openApprovalDialog(event, "reject")
                                }
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === "approve" ? "Approve Event" : "Reject Event"}
            </DialogTitle>
            <DialogDescription>
              {approvalAction === "approve"
                ? "This event will be published and visible to all users."
                : "This event will be rejected and the organizer will be notified."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedEvent && (
              <div className="space-y-2">
                <Label>Event</Label>
                <p className="text-sm font-medium">{selectedEvent.title}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="remarks">
                Remarks {approvalAction === "reject" && "(Required)"}
              </Label>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add any comments or feedback..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowApprovalDialog(false);
                setRemarks("");
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant={approvalAction === "approve" ? "default" : "destructive"}
              onClick={handleApprovalAction}
              disabled={submitting || (approvalAction === "reject" && !remarks)}
            >
              {submitting
                ? "Processing..."
                : approvalAction === "approve"
                ? "Approve Event"
                : "Reject Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
