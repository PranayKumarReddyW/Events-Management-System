import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMyFeedback, useCreateFeedback } from "@/hooks";
import { useMyRegistrations } from "@/hooks/useRegistrations";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Plus, Star } from "lucide-react";
import { formatDate } from "@/utils/date";
import { toast } from "sonner";

const feedbackSchema = z.object({
  eventId: z.string().min(1, "Please select an event"),
  overallRating: z.number().min(1).max(5),
  comment: z
    .string()
    .min(10, "Feedback must be at least 10 characters")
    .optional(),
});

type FeedbackFormValues = z.infer<typeof feedbackSchema>;

export default function FeedbackPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: feedbackResponse, isLoading } = useMyFeedback();

  const feedbackList = feedbackResponse?.data || [];

  // Fetch only completed events that user attended
  const { data: registrationsData } = useMyRegistrations({
    status: "confirmed",
    limit: 100,
  });

  // Filter to only completed events that user attended
  const attendedCompletedEvents = useMemo(() => {
    if (!registrationsData?.data) return [];

    return registrationsData.data
      .filter((reg: any) => {
        const event = reg.event;
        // Check if event is completed and user has checked in
        return event?.status === "completed" && reg.checkInTime;
      })
      .map((reg: any) => reg.event);
  }, [registrationsData]);

  const createFeedback = useCreateFeedback();

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      eventId: "",
      overallRating: undefined,
      comment: "",
    },
  });

  const onSubmit = async (data: FeedbackFormValues) => {
    try {
      await createFeedback.mutateAsync(data);
      toast.success("Feedback submitted successfully!");
      form.reset();
      setDialogOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to submit feedback");
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < rating
            ? "fill-yellow-400 text-yellow-400"
            : "text-muted-foreground"
        }`}
      />
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Feedback</h1>
          <p className="text-muted-foreground">
            Share your thoughts on events you've attended
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={(e) => {
                if (attendedCompletedEvents.length === 0) {
                  e.preventDefault();
                  toast.info(
                    "You don't have any completed events to provide feedback for. Complete and attend an event first."
                  );
                }
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Submit Feedback
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Event Feedback</DialogTitle>
              <DialogDescription>
                Share your experience and help us improve
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="eventId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a completed event" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {attendedCompletedEvents.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground text-center">
                              No completed events available for feedback
                            </div>
                          ) : (
                            attendedCompletedEvents.map((event: any) => (
                              <SelectItem key={event._id} value={event._id}>
                                {event.title}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="overallRating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rating *</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => field.onChange(i + 1)}
                              className="focus:outline-none"
                            >
                              <Star
                                className={`h-8 w-8 transition-colors ${
                                  field.value && i < field.value
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-muted-foreground hover:text-yellow-200"
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="comment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comments</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Share your feedback..."
                          className="min-h-32"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createFeedback.isPending}>
                    Submit
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : feedbackList?.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No feedback yet</h3>
          <p className="text-muted-foreground">
            Submit feedback for events you've attended
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {feedbackList?.map((feedback: any) => (
            <Card key={feedback._id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle>
                      {feedback.event?.title || "Event Feedback"}
                    </CardTitle>
                    <CardDescription>
                      Submitted on {formatDate(feedback.createdAt)}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    {renderStars(feedback.overallRating || feedback.rating)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {feedback.comment || feedback.comments}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
