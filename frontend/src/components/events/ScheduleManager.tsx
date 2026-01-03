import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { X, Plus } from "lucide-react";
import { format } from "date-fns";

export type ScheduleItem = {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  venue?: string;
  speakers?: string[];
};

interface ScheduleManagerProps {
  schedules: ScheduleItem[];
  onChange: (schedules: ScheduleItem[]) => void;
}

export function ScheduleManager({ schedules, onChange }: ScheduleManagerProps) {
  const [currentSchedule, setCurrentSchedule] = useState<ScheduleItem>({
    title: "",
    description: "",
    startTime: "",
    endTime: "",
    venue: "",
    speakers: [],
  });

  const [speakerInput, setSpeakerInput] = useState("");

  const addSchedule = () => {
    if (
      !currentSchedule.title ||
      !currentSchedule.startTime ||
      !currentSchedule.endTime
    ) {
      return;
    }

    onChange([...schedules, currentSchedule]);
    setCurrentSchedule({
      title: "",
      description: "",
      startTime: "",
      endTime: "",
      venue: "",
      speakers: [],
    });
    setSpeakerInput("");
  };

  const removeSchedule = (index: number) => {
    onChange(schedules.filter((_, i) => i !== index));
  };

  const addSpeaker = () => {
    if (speakerInput.trim()) {
      setCurrentSchedule({
        ...currentSchedule,
        speakers: [...(currentSchedule.speakers || []), speakerInput.trim()],
      });
      setSpeakerInput("");
    }
  };

  const removeSpeaker = (index: number) => {
    setCurrentSchedule({
      ...currentSchedule,
      speakers: currentSchedule.speakers?.filter((_, i) => i !== index) || [],
    });
  };

  return (
    <div className="space-y-4">
      {/* Existing Schedules */}
      {schedules.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">
              Schedule Items ({schedules.length})
            </Label>
          </div>
          <div className="space-y-3">
            {schedules.map((schedule, index) => (
              <Card
                key={index}
                className="relative overflow-hidden border-l-4 border-l-primary hover:shadow-md transition-shadow"
              >
                <CardContent className="p-5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-3 right-3 h-7 w-7 hover:bg-destructive/10 hover:text-destructive rounded-full"
                    onClick={() => removeSchedule(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>

                  <div className="space-y-3 pr-12">
                    {/* Title */}
                    <h4 className="font-semibold text-lg text-foreground">
                      {schedule.title}
                    </h4>

                    {/* Time */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/5 text-primary font-medium">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {format(new Date(schedule.startTime), "MMM d, yyyy")}
                      </span>
                      <span className="text-muted-foreground">
                        {format(new Date(schedule.startTime), "h:mm a")} -{" "}
                        {format(new Date(schedule.endTime), "h:mm a")}
                      </span>
                    </div>

                    {/* Description */}
                    {schedule.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed pl-1">
                        {schedule.description}
                      </p>
                    )}

                    {/* Venue and Speakers */}
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {schedule.venue && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/50 text-sm font-medium">
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          {schedule.venue}
                        </span>
                      )}
                      {schedule.speakers && schedule.speakers.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground font-medium">
                            Speakers:
                          </span>
                          {schedule.speakers.map((speaker, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                            >
                              {speaker}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Add New Schedule */}
      <Card className="border-dashed">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-base">Add Schedule Item</h4>
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="schedule-title"
              value={currentSchedule.title}
              onChange={(e) =>
                setCurrentSchedule({
                  ...currentSchedule,
                  title: e.target.value,
                })
              }
              placeholder="Session title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule-description">Description</Label>
            <Textarea
              id="schedule-description"
              value={currentSchedule.description}
              onChange={(e) =>
                setCurrentSchedule({
                  ...currentSchedule,
                  description: e.target.value,
                })
              }
              placeholder="Session description"
              rows={2}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="schedule-start">
                Start Time <span className="text-destructive">*</span>
              </Label>
              <Input
                id="schedule-start"
                type="datetime-local"
                value={currentSchedule.startTime}
                onChange={(e) =>
                  setCurrentSchedule({
                    ...currentSchedule,
                    startTime: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule-end">
                End Time <span className="text-destructive">*</span>
              </Label>
              <Input
                id="schedule-end"
                type="datetime-local"
                value={currentSchedule.endTime}
                onChange={(e) =>
                  setCurrentSchedule({
                    ...currentSchedule,
                    endTime: e.target.value,
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule-venue">Venue</Label>
            <Input
              id="schedule-venue"
              value={currentSchedule.venue}
              onChange={(e) =>
                setCurrentSchedule({
                  ...currentSchedule,
                  venue: e.target.value,
                })
              }
              placeholder="Session venue"
            />
          </div>

          <div className="space-y-2">
            <Label>Speakers</Label>
            <div className="flex gap-2">
              <Input
                value={speakerInput}
                onChange={(e) => setSpeakerInput(e.target.value)}
                placeholder="Speaker name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSpeaker();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addSpeaker}
                disabled={!speakerInput.trim()}
              >
                Add
              </Button>
            </div>
            {currentSchedule.speakers &&
              currentSchedule.speakers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {currentSchedule.speakers.map((speaker, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-secondary rounded-md text-sm"
                    >
                      {speaker}
                      <button
                        type="button"
                        onClick={() => removeSpeaker(index)}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
          </div>

          <Button
            type="button"
            onClick={addSchedule}
            disabled={
              !currentSchedule.title ||
              !currentSchedule.startTime ||
              !currentSchedule.endTime
            }
            className="w-full sm:w-auto"
            size="lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add to Schedule
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
