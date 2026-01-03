import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useCreateTeam } from "@/hooks/useTeams";
import { useEvents } from "@/hooks/useEvents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FormDescription,
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
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Define filters outside component to ensure stable reference
const PUBLISHED_EVENTS_FILTERS = {
  status: "published" as const,
  limit: 100,
};

const teamSchema = z.object({
  name: z.string().min(3, "Team name must be at least 3 characters"),
  description: z.string().optional(),
  eventId: z.string().min(1, "Please select an event"),
});

type TeamFormValues = z.infer<typeof teamSchema>;

export default function CreateTeamPage() {
  const navigate = useNavigate();
  const createTeam = useCreateTeam();

  // Use stable filter reference
  const { data: eventsData, isLoading: eventsLoading } = useEvents(
    PUBLISHED_EVENTS_FILTERS
  );

  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: "",
      description: "",
      eventId: "",
    },
  });

  const onSubmit = async (data: TeamFormValues) => {
    try {
      // Validate eventId before submission
      if (
        !data.eventId ||
        data.eventId === "" ||
        data.eventId === "loading" ||
        data.eventId === "no-events"
      ) {
        toast.error("Please select a valid event");
        return;
      }

      await createTeam.mutateAsync(data);
      toast.success("Team created successfully!");
      // Small delay to ensure query invalidation completes before navigation
      setTimeout(() => navigate("/teams"), 100);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create team");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/teams")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create New Team</h1>
          <p className="text-muted-foreground">
            Form a team for an event and invite members
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Information</CardTitle>
              <CardDescription>Provide details about your team</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter team name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe your team"
                        className="min-h-24"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="eventId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an event" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {eventsLoading ? (
                          <SelectItem value="loading" disabled>
                            Loading events...
                          </SelectItem>
                        ) : eventsData?.data?.events.length === 0 ? (
                          <SelectItem value="no-events" disabled>
                            No events available
                          </SelectItem>
                        ) : (
                          eventsData?.data?.events.map((event: any) => (
                            <SelectItem key={event._id} value={event._id}>
                              {event.title}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose the event this team will participate in
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/teams")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createTeam.isPending ||
                eventsLoading ||
                !eventsData?.data?.events?.length
              }
            >
              {createTeam.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Team
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
