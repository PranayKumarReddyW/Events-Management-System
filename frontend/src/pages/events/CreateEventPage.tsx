import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useParams } from "react-router-dom";
import { useEvent, useCreateEvent, useUpdateEvent } from "@/hooks/useEvents";
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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { MultiSelect } from "@/components/ui/multi-select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { ScheduleManager } from "@/components/events/ScheduleManager";
import {
  EVENT_TYPES,
  EVENT_MODES,
  ACADEMIC_YEARS,
  DEPARTMENTS,
} from "@/constants";
import { Loader2, X, Info, Clock, Lock } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const eventSchema = z
  .object({
    title: z.string().min(5, "Title must be at least 5 characters"),
    description: z
      .string()
      .min(20, "Description must be at least 20 characters"),
    rules: z.string().optional(),
    agenda: z.string().optional(),
    schedule: z
      .array(
        z.object({
          title: z.string(),
          description: z.string().optional(),
          startTime: z.string(),
          endTime: z.string(),
          venue: z.string().optional(),
          speakers: z.array(z.string()).optional(),
        })
      )
      .optional(),
    eventType: z.string(),
    eventMode: z.enum(["online", "offline", "hybrid"]),
    venue: z.string().optional(),
    meetingLink: z.string().url().optional().or(z.literal("")),
    startDate: z.string(),
    endDate: z.string(),
    registrationDeadline: z.string(),
    maxParticipants: z.number().min(0).optional(),
    minTeamSize: z.number().min(1).default(1),
    maxTeamSize: z.number().min(1).default(1),
    isPaid: z.boolean().default(false),
    registrationFee: z.number().min(0).optional(),
    requiresApproval: z.boolean().default(false),
    eligibility: z
      .string()
      .min(10, "Eligibility criteria must be at least 10 characters"),
    eligibleYears: z
      .array(z.number())
      .min(1, "At least one year must be selected"),
    eligibleDepartments: z
      .array(z.string())
      .min(1, "At least one department must be selected"),
    allowExternalStudents: z.boolean(),
    visibility: z.enum(["public", "private", "department_only", "club_only"]),
    status: z
      .enum(["draft", "published", "ongoing", "completed", "cancelled"])
      .default("draft"),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: "End date must be after start date",
    path: ["endDate"],
  })
  .refine(
    (data) => new Date(data.registrationDeadline) <= new Date(data.startDate),
    {
      message: "Registration deadline must be before event start date",
      path: ["registrationDeadline"],
    }
  )
  .refine((data) => data.maxTeamSize >= data.minTeamSize, {
    message: "Max team size must be greater than or equal to min team size",
    path: ["maxTeamSize"],
  })
  .refine(
    (data) => {
      // Meeting link is required for online and hybrid events
      if (data.eventMode === "online" || data.eventMode === "hybrid") {
        return data.meetingLink && data.meetingLink.trim() !== "";
      }
      return true;
    },
    {
      message: "Meeting link is required for online and hybrid events",
      path: ["meetingLink"],
    }
  );

type EventFormValues = z.infer<typeof eventSchema>;

export default function CreateEventPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);

  const { data: eventResponse, isLoading: eventLoading } = useEvent(id!);
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();

  const event = eventResponse?.data?.event;

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema) as any,
    defaultValues: {
      title: "",
      description: "",
      rules: "",
      agenda: "",
      schedule: [],
      eventType: "",
      eventMode: "offline",
      venue: "",
      meetingLink: "",
      startDate: "",
      endDate: "",
      registrationDeadline: "",
      maxParticipants: undefined,
      minTeamSize: 1,
      maxTeamSize: 1,
      isPaid: false,
      registrationFee: 0,
      requiresApproval: false,
      eligibility: "",
      eligibleYears: [],
      eligibleDepartments: [],
      allowExternalStudents: false,
      visibility: "public",
      status: "draft",
    },
  });

  // Check if event has started (for locking)
  const eventHasStarted =
    event && new Date(event.startDateTime || event.startDate) <= new Date();
  const isEventLocked = isEditMode && eventHasStarted;

  const isPaid = form.watch("isPaid");
  const eventMode = form.watch("eventMode");

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleAdditionalImagesChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length + additionalImages.length > 5) {
      toast.error("Maximum 5 additional images allowed");
      return;
    }

    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`Image ${file.name} is too large (max 5MB)`);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setAdditionalImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAdditionalImage = (index: number) => {
    setAdditionalImages((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (event && isEditMode) {
      // Normalize event type - ensure it matches EVENT_TYPES values
      const normalizedEventType = event.eventType || "workshop";

      // Ensure status is one of the allowed values
      const validStatus = [
        "draft",
        "published",
        "ongoing",
        "completed",
        "cancelled",
      ].includes(event.status)
        ? event.status
        : "draft";

      // CRITICAL FIX: Use setValue instead of reset for better Select component compatibility
      const formData = {
        title: event.title || "",
        description: event.description || "",
        rules: event.rules || "",
        agenda: event.agenda || "",
        schedule: event.schedule || [],
        eventType: normalizedEventType,
        eventMode: event.eventMode || "offline",
        venue: event.venue || "",
        meetingLink: event.meetingLink || "",
        startDate: new Date(event.startDateTime || event.startDate)
          .toISOString()
          .slice(0, 16),
        endDate: new Date(event.endDateTime || event.endDate)
          .toISOString()
          .slice(0, 16),
        registrationDeadline: new Date(event.registrationDeadline)
          .toISOString()
          .slice(0, 16),
        maxParticipants: event.maxParticipants
          ? Number(event.maxParticipants)
          : undefined,
        minTeamSize: Number(event.minTeamSize) || 1,
        maxTeamSize: Number(event.maxTeamSize) || 1,
        isPaid: Boolean(event.isPaid),
        registrationFee: Number(event.amount || event.registrationFee || 0),
        requiresApproval: Boolean(event.requiresApproval),
        eligibility: event.eligibility || "",
        eligibleYears: Array.isArray(event.eligibleYears)
          ? event.eligibleYears
          : [],
        eligibleDepartments: Array.isArray(event.eligibleDepartments)
          ? event.eligibleDepartments
          : [],
        allowExternalStudents: Boolean(event.allowExternalStudents),
        visibility: event.visibility || "public",
        status: validStatus,
      };

      // Set all form values individually to ensure Select components update
      Object.entries(formData).forEach(([key, value]) => {
        form.setValue(key as any, value);
      });

      // Set image preview if event has an image
      if (event.bannerImage) {
        setImagePreview(event.bannerImage);
      }

      // Set additional images if they exist
      if (event.images && Array.isArray(event.images)) {
        setAdditionalImages(event.images);
      }
    }
  }, [event, isEditMode, form]);

  const onSubmit = async (data: EventFormValues) => {
    try {
      // Define locked fields that cannot be updated after event starts
      const lockedFields = [
        "title",
        "eventType",
        "startDateTime",
        "endDateTime",
        "minTeamSize",
        "maxTeamSize",
        "isPaid",
        "registrationFee",
        "eligibility",
        "eligibleYears",
        "eligibleDepartments",
        "allowExternalStudents",
        "requiresApproval",
      ];

      // Filter out locked fields if event has already started
      const shouldFilterLockedFields = isEventLocked && isEditMode;

      // Validate required fields
      if (!data.eventType || data.eventType.trim() === "") {
        toast.error("Event type is required");
        return;
      }

      // Ensure team sizes are valid numbers
      const minTeamSize = parseInt(String(data.minTeamSize), 10) || 1;
      const maxTeamSize = parseInt(String(data.maxTeamSize), 10) || 1;

      // Validate team sizes
      if (maxTeamSize < minTeamSize) {
        toast.error(
          "Max team size must be greater than or equal to min team size"
        );
        return;
      }

      // Create FormData for file upload
      const formData = new FormData();

      // Add image as base64 if present
      if (imageFile && imagePreview) {
        // Use the base64 preview we already have
        formData.append("bannerImageBase64", imagePreview);
      } else if (imagePreview && !imageFile) {
        // Edit mode - image already exists as base64
        formData.append("bannerImageBase64", imagePreview);
      }

      // Add additional images as base64 array
      if (additionalImages.length > 0) {
        formData.append("images", JSON.stringify(additionalImages));
      }

      // Transform data to match API requirements
      const eventData: any = {};

      // Always add editable fields
      eventData.description = data.description;
      if (data.rules) {
        eventData.rules = data.rules;
      }
      if (data.agenda) {
        eventData.agenda = data.agenda;
      }
      if (data.schedule && data.schedule.length > 0) {
        eventData.schedule = data.schedule;
      }
      if (data.venue) {
        eventData.venue = data.venue;
      }
      if (data.maxParticipants) {
        eventData.maxParticipants = parseInt(String(data.maxParticipants), 10);
      }

      // Only include locked fields if event has NOT started
      if (!shouldFilterLockedFields) {
        eventData.title = data.title;
        eventData.eventType = data.eventType.trim();
        eventData.eventMode = data.eventMode;
        eventData.startDateTime = new Date(data.startDate).toISOString();
        eventData.endDateTime = new Date(data.endDate).toISOString();
        eventData.registrationDeadline = new Date(
          data.registrationDeadline
        ).toISOString();
        eventData.minTeamSize = minTeamSize;
        eventData.maxTeamSize = maxTeamSize;
        eventData.isPaid = Boolean(data.isPaid);
        eventData.visibility = data.visibility;
        eventData.requiresApproval = Boolean(data.requiresApproval);

        // Add mandatory eligibility fields (only when not locked)
        eventData.eligibility = data.eligibility;
        eventData.eligibleYears = data.eligibleYears;
        eventData.eligibleDepartments = data.eligibleDepartments;
        eventData.allowExternalStudents = Boolean(data.allowExternalStudents);

        if (data.isPaid && data.registrationFee) {
          eventData.amount = parseFloat(String(data.registrationFee));
        }
      } else {
        // When event has started, only update registration deadline if provided
        eventData.registrationDeadline = new Date(
          data.registrationDeadline
        ).toISOString();
      }

      // CRITICAL FIX: Include status field in API request
      // This was missing, causing status updates to be ignored
      eventData.status = data.status;

      // Only include meetingLink for online/hybrid events
      if (data.eventMode === "online" || data.eventMode === "hybrid") {
        if (data.meetingLink) {
          eventData.meetingLink = data.meetingLink;
        }
      }

      // DEBUG: Log the event data before sending to API
      console.log("[CreateEventPage] Event data being sent to API:", eventData);
      console.log(
        "[CreateEventPage] Status value:",
        eventData.status,
        "Type:",
        typeof eventData.status
      );

      // Append all event data to FormData
      Object.keys(eventData).forEach((key) => {
        const value = eventData[key];
        // Handle schedule array specially - serialize as JSON
        if (key === "schedule" && Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        }
        // Handle other arrays (eligibleYears, eligibleDepartments, tags)
        else if (Array.isArray(value)) {
          value.forEach((item) => {
            formData.append(`${key}[]`, item);
          });
        } else {
          formData.append(key, value);
        }
      });

      if (isEditMode) {
        await updateEvent.mutateAsync({ id: id!, data: formData });
        toast.success("Event updated successfully!");
      } else {
        await createEvent.mutateAsync({ data: formData });
        toast.success("Event created successfully!");
      }
      navigate("/events");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ||
          `Failed to ${isEditMode ? "update" : "create"} event`
      );
    }
  };

  if (eventLoading && isEditMode) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
              {isEditMode ? "Edit Event" : "Create New Event"}
            </h1>
            {isEventLocked && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Event Started - Locked
              </Badge>
            )}
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">
            {isEventLocked
              ? "You can still update: Description, Rules, Agenda, Venue, Meeting Link, Images, Registration Status"
              : isEditMode
              ? "Update your event details"
              : "Fill in the details to create a new event"}
          </p>
        </div>
      </div>

      {isEditMode && (
        <>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              To manage rounds for this event, save any changes and click the{" "}
              <strong>"Rounds"</strong> button on the Event Detail page. You can
              create multiple rounds, advance participants, and track progress
              through each stage.
            </AlertDescription>
          </Alert>

          {isEventLocked && (
            <Alert variant="destructive">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                <strong>Event has started - Critical fields are locked</strong>
                <p className="mt-2 text-sm">
                  The following fields cannot be modified after event start:
                </p>
                <ul className="mt-1 text-sm list-disc list-inside space-y-1">
                  <li>Title, Event Type, Start/End Dates</li>
                  <li>Team Size (Min/Max), Payment Settings</li>
                  <li>Eligibility Criteria, Years, Departments</li>
                  <li>External Students, Approval Requirements</li>
                </ul>
                <p className="mt-2 text-sm font-medium">
                  You can still update: Description, Rules, Agenda, Venue,
                  Meeting Link, Images, Registration Status
                </p>
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 sm:space-y-6"
        >
          <Card>
            <CardHeader className="space-y-1.5 sm:space-y-2 p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">
                Basic Information
              </CardTitle>
              <CardDescription className="text-sm">
                Provide the essential details about your event
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter event title"
                        {...field}
                        disabled={isEventLocked}
                      />
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Describe your event with rich formatting"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rules"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rules and Guidelines (Optional)</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Enter event rules and guidelines with formatting"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="agenda"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agenda (Optional)</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Enter event agenda with formatting"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Image Upload Section */}
              <div className="space-y-2">
                <FormLabel>Event Banner Image (Optional)</FormLabel>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload a single image (max 5MB). Recommended size:
                      1200x600px
                    </p>
                  </div>
                </div>
                {imagePreview && (
                  <div className="relative inline-block mt-2 w-full max-w-md">
                    <img
                      src={imagePreview}
                      alt="Event banner preview"
                      className="w-full h-36 sm:h-48 object-cover rounded-lg border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                      onClick={removeImage}
                    >
                      <X className="h-5 w-5 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Additional Images Section */}
              <div className="space-y-2">
                <FormLabel>Additional Images (Optional)</FormLabel>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleAdditionalImagesChange}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload up to 5 additional images (max 5MB each)
                    </p>
                  </div>
                </div>
                {additionalImages.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                    {additionalImages.map((img, index) => (
                      <div key={index} className="relative">
                        <img
                          src={img}
                          alt={`Additional ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={() => removeAdditionalImage(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <FormField
                  control={form.control}
                  name="eventType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Type</FormLabel>
                      <Select
                        key={`eventType-${event?._id || "new"}-${field.value}`}
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isEventLocked}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select event type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EVENT_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="visibility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visibility</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isEventLocked}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select visibility" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="public">Public</SelectItem>
                          <SelectItem value="private">Private</SelectItem>
                          <SelectItem value="department_only">
                            Department Only
                          </SelectItem>
                          <SelectItem value="club_only">Club Only</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-1.5 sm:space-y-2 p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">
                Event Schedule & Location
              </CardTitle>
              <CardDescription className="text-sm">
                When and where will the event take place
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <FormField
                control={form.control}
                name="eventMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Mode</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isEventLocked}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select event mode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EVENT_MODES.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value}>
                            {mode.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(eventMode === "offline" || eventMode === "hybrid") && (
                <FormField
                  control={form.control}
                  name="venue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venue</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter venue location"
                          {...field}
                          disabled={isEventLocked}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {(eventMode === "online" || eventMode === "hybrid") && (
                <FormField
                  control={form.control}
                  name="meetingLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meeting Link</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="https://meet.example.com/event"
                          {...field}
                          disabled={isEventLocked}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date & Time</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          disabled={isEventLocked}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date & Time</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          disabled={isEventLocked}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="registrationDeadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registration Deadline</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          disabled={isEventLocked}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-1.5 sm:space-y-2 p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">
                Event Schedule
              </CardTitle>
              <CardDescription className="text-sm">
                Add schedule items for your event (sessions, talks, activities)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <FormField
                control={form.control}
                name="schedule"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ScheduleManager
                        schedules={field.value || []}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-1.5 sm:space-y-2 p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">
                Registration Settings
              </CardTitle>
              <CardDescription className="text-sm">
                Configure participant registration options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                <FormField
                  control={form.control}
                  name="maxParticipants"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Participants (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Unlimited"
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? Number(e.target.value)
                                : undefined
                            )
                          }
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minTeamSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Team Size</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                          disabled={
                            form.watch("maxTeamSize") === 1 || isEventLocked
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxTeamSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Team Size</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                          disabled={
                            form.watch("maxTeamSize") === 1 || isEventLocked
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="maxTeamSize"
                render={({ field }) => (
                  <FormItem className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 rounded-lg border p-4 sm:p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Solo Event</FormLabel>
                      <FormDescription className="text-sm">
                        This is an individual event (no teams required)
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value === 1}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            field.onChange(1);
                            form.setValue("minTeamSize", 1);
                          } else {
                            field.onChange(2);
                            form.setValue("minTeamSize", 2);
                          }
                        }}
                        disabled={isEventLocked}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="eligibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Eligibility Criteria *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe who can register for this event (e.g., Open to all engineering students)"
                        {...field}
                        className="min-h-24"
                        disabled={isEventLocked}
                      />
                    </FormControl>
                    <FormDescription>
                      Provide clear eligibility requirements for participants
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="eligibleYears"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Eligible Years *</FormLabel>
                    <FormControl>
                      <MultiSelect
                        disabled={isEventLocked}
                        options={ACADEMIC_YEARS.map((year) => ({
                          label: year.label,
                          value: year.value,
                        }))}
                        selected={field.value?.map(String) || []}
                        onChange={(values) => {
                          field.onChange(values.map(Number));
                        }}
                        placeholder="Select eligible academic years..."
                      />
                    </FormControl>
                    <FormDescription>
                      Select which academic years are eligible to participate
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="eligibleDepartments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Eligible Departments *</FormLabel>
                    <FormControl>
                      <MultiSelect
                        disabled={isEventLocked}
                        options={DEPARTMENTS.map((dept) => ({
                          label: dept.label,
                          value: dept.value,
                        }))}
                        selected={field.value || []}
                        onChange={field.onChange}
                        placeholder="Select eligible departments..."
                      />
                    </FormControl>
                    <FormDescription>
                      Select which departments can participate in this event
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="allowExternalStudents"
                render={({ field }) => (
                  <FormItem className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 rounded-lg border p-4 sm:p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Allow External Students *
                      </FormLabel>
                      <FormDescription className="text-sm">
                        Allow students from other colleges to participate
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        disabled={isEventLocked}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isPaid"
                render={({ field }) => (
                  <FormItem className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 rounded-lg border p-4 sm:p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Paid Event</FormLabel>
                      <FormDescription className="text-sm">
                        Charge a registration fee for this event
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        disabled={isEventLocked}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {isPaid && (
                <FormField
                  control={form.control}
                  name="registrationFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registration Fee (₹)</FormLabel>
                      <FormControl>
                        <Input
                          disabled={isEventLocked}
                          type="number"
                          min="0"
                          step="0.01"
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="requiresApproval"
                render={({ field }) => (
                  <FormItem className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 rounded-lg border p-4 sm:p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Requires Approval
                      </FormLabel>
                      <FormDescription className="text-sm">
                        Manually review and approve registrations
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        disabled={isEventLocked}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Status</FormLabel>
                    <Select
                      key={`status-${event?._id || "new"}-${field.value}`}
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select event status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">
                          Draft - Work in progress, not visible to students
                        </SelectItem>
                        <SelectItem value="published">
                          Published - Open for registrations
                        </SelectItem>
                        <SelectItem value="ongoing">
                          Ongoing - Event is currently happening
                        </SelectItem>
                        <SelectItem value="completed">
                          Completed - Event has finished
                        </SelectItem>
                        <SelectItem value="cancelled">
                          Cancelled - Event was cancelled
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Control event visibility and lifecycle. Only published
                      events are visible to students.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(isEditMode ? `/events/${id}` : "/events")}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createEvent.isPending || updateEvent.isPending}
              className="w-full sm:w-auto min-h-[44px]"
            >
              {(createEvent.isPending || updateEvent.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditMode ? "Update Event" : "Create Event"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
