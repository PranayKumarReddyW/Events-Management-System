import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { eventsApi } from "@/api/events";
import { registrationsApi } from "@/api/registrations";
import { certificatesApi } from "@/api/certificates";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Trophy,
  Medal,
  Award,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  FileCheck,
  Loader2,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Result {
  _id?: string;
  position: number;
  participantName: string;
  participantId: string;
  teamId?: string;
  score?: number;
  remarks?: string;
}

export default function ResultsManagementPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCertificateDialog, setShowCertificateDialog] = useState(false);
  const [generatingCertificates, setGeneratingCertificates] = useState(false);
  const [certificateType, setCertificateType] = useState<
    "participation" | "winner"
  >("winner");
  const [certificatesGenerated, setCertificatesGenerated] = useState(false);
  const [editingResult, setEditingResult] = useState<Result | null>(null);
  const [formData, setFormData] = useState<Partial<Result>>({
    position: 1,
    participantId: "",
    score: 0,
    remarks: "",
  });

  useEffect(() => {
    if (eventId) {
      fetchEventData();
    }
  }, [eventId]);

  const fetchEventData = async () => {
    try {
      setLoading(true);
      console.log("🎯 Fetching data for Event ID:", eventId);

      const [eventRes, regsRes] = await Promise.all([
        eventsApi.getEvent(eventId!),
        registrationsApi.getEventRegistrations(eventId!, {
          limit: 1000,
        }),
      ]);

      console.log("📡 Full API Response:", regsRes);
      console.log("📦 Response data structure:", regsRes.data);

      setEvent(eventRes.data?.event);
      const fetchedRegistrations = regsRes.data?.data || [];

      console.log("🔍 All registrations:", fetchedRegistrations);
      console.log("📊 Total fetched:", fetchedRegistrations.length);

      if (fetchedRegistrations.length > 0) {
        console.log("📋 Sample registration:", fetchedRegistrations[0]);
        console.log(
          "🏷️ All status values:",
          fetchedRegistrations.map((r: any) => r.status)
        );
        console.log(
          "💰 All payment statuses:",
          fetchedRegistrations.map((r: any) => r.paymentStatus)
        );
      } else {
        console.warn("⚠️ No registrations returned from API");
      }

      // Accept all confirmed registrations
      const validRegistrations = fetchedRegistrations.filter(
        (reg: any) => reg.status === "confirmed"
      );

      console.log("✅ Valid registrations:", validRegistrations);
      console.log(
        "📝 Number of valid registrations:",
        validRegistrations.length
      );
      setRegistrations(validRegistrations);

      // Check if certificates are already generated
      if ((eventRes.data?.event as any)?.certificatesGenerated) {
        setCertificatesGenerated(true);
      }

      // Fetch existing results
      try {
        const resultsRes: any = await eventsApi.getResults(eventId!);
        const fetchedResults = (resultsRes.data || []).map((r: any) => ({
          _id: r._id,
          position: r.position,
          participantName: r.userId?.fullName || r.teamId?.name || "Unknown",
          participantId: r.userId?._id || r.teamId?._id,
          teamId: r.teamId?._id,
          score: r.score,
          remarks: r.remarks,
        }));
        setResults(fetchedResults);
      } catch (error) {
        console.error("Failed to fetch results:", error);
      }
    } catch (error: any) {
      toast.error("Failed to fetch event data", {
        description: error.response?.data?.message || "Please try again",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddResult = () => {
    setEditingResult(null);
    setFormData({
      position: results.length + 1,
      participantId: "",
      score: 0,
      remarks: "",
    });
    setShowAddDialog(true);
  };

  const handleEditResult = (result: Result) => {
    setEditingResult(result);
    setFormData(result);
    setShowAddDialog(true);
  };

  const handleSaveResult = async () => {
    // VALIDATION: Check participant selection
    if (!formData.participantId) {
      toast.error("Please select a participant");
      return;
    }

    // NULL CHECK: Find registration by user ID
    const registration = registrations.find(
      (r) =>
        r?.user?._id === formData.participantId ||
        r?._id === formData.participantId
    );
    if (!registration) {
      toast.error("Participant not found");
      return;
    }

    // NULL CHECK: Build result with safe field access
    const newResult: Result = {
      ...formData,
      participantName:
        registration.user?.fullName || registration.team?.name || "Unknown",
      participantId: registration.user?._id || formData.participantId,
      teamId: registration.team?._id,
      position: formData.position || 1,
    } as Result;

    if (editingResult) {
      setResults(
        results.map((r) =>
          r.participantId === editingResult.participantId ? newResult : r
        )
      );
      toast.success(
        "Result updated locally. Don't forget to save all results."
      );
    } else {
      setResults([...results, newResult]);
      toast.success("Result added locally. Don't forget to save all results.");
    }

    setShowAddDialog(false);
    setFormData({});
  };

  const handleDeleteResult = async (participantId: string) => {
    // NULL CHECK: Validate participantId
    if (!participantId) {
      toast.error("Invalid participant");
      return;
    }

    const result = results.find((r) => r.participantId === participantId);
    if (result?._id) {
      try {
        await eventsApi.deleteResult(eventId!, result._id);
        toast.success("Result deleted successfully");
      } catch (error: any) {
        toast.error(error.response?.data?.message || "Failed to delete result");
        return;
      }
    }
    setResults(results.filter((r) => r.participantId !== participantId));
  };

  const handleSaveAllResults = async () => {
    // VALIDATION: Check if results exist
    if (!results || results.length === 0) {
      toast.error("No results to save");
      return;
    }

    try {
      // NULL CHECK: Filter and map results safely
      const resultsToSave = results
        .filter((r) => r.participantId) // Only include results with participantId
        .map((r) => ({
          position: r.position || 0,
          userId: r.teamId ? undefined : r.participantId,
          teamId: r.teamId,
          score: r.score,
          remarks: r.remarks,
        }));

      if (resultsToSave.length === 0) {
        toast.error("No valid results to save");
        return;
      }

      await eventsApi.addResults(eventId!, resultsToSave);
      toast.success("Results saved successfully");
      fetchEventData(); // Refresh to get IDs from backend
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to save results");
    }
  };

  const handlePublishResults = async () => {
    // VALIDATION: Check if results exist
    if (!results || results.length === 0) {
      toast.error("No results to publish");
      return;
    }

    try {
      await eventsApi.publishResults(eventId!);
      toast.success("Results published successfully", {
        description: "Participants have been notified",
      });
      fetchEventData();
    } catch (error: any) {
      toast.error("Failed to publish results", {
        description: error.response?.data?.message || "Please try again",
      });
    }
  };

  const handleGenerateCertificates = async () => {
    if (!eventId) {
      toast.error("Event ID is missing");
      return;
    }

    if (
      event?.status !== "completed" &&
      new Date(event?.endDateTime) > new Date()
    ) {
      toast.error("Certificates can only be generated after event completion");
      return;
    }

    setGeneratingCertificates(true);
    try {
      const registrationIds =
        certificateType === "winner"
          ? results.map((r) => r.participantId).filter(Boolean)
          : registrations.filter((r) => r.checkInTime).map((r) => r._id);

      if (registrationIds.length === 0) {
        toast.error("No eligible participants found");
        setGeneratingCertificates(false);
        return;
      }

      const response: any = await certificatesApi.generateCertificates({
        eventId,
        certificateType,
        registrationIds,
      });

      toast.success("Certificates generated successfully", {
        description: `${response.data?.generated || 0} certificates created`,
      });

      setCertificatesGenerated(true);
      setShowCertificateDialog(false);
      fetchEventData();
    } catch (error: any) {
      toast.error("Failed to generate certificates", {
        description: error.response?.data?.message || "Please try again",
      });
    } finally {
      setGeneratingCertificates(false);
    }
  };

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Medal className="h-5 w-5 text-amber-600" />;
      default:
        return <Award className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getPositionBadge = (position: number) => {
    const variants: Record<number, string> = {
      1: "bg-yellow-500 text-white",
      2: "bg-gray-400 text-white",
      3: "bg-amber-600 text-white",
    };
    return variants[position] || "bg-muted";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              Results Management
            </h1>
            {event?.status === "completed" && (
              <Badge variant="secondary">Event Completed</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            {event?.title || event?.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleAddResult}
            disabled={event?.status === "completed"}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Result
          </Button>
          {results.length > 0 && (
            <>
              <Button
                onClick={handleSaveAllResults}
                variant="outline"
                disabled={event?.status === "completed"}
              >
                Save All Results
              </Button>
              <Button
                onClick={handlePublishResults}
                variant="default"
                disabled={event?.status === "completed"}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Publish Results
              </Button>
              <Button
                onClick={() => setShowCertificateDialog(true)}
                variant="secondary"
                disabled={certificatesGenerated}
              >
                <FileCheck className="mr-2 h-4 w-4" />
                {certificatesGenerated
                  ? "Certificates Generated"
                  : "Generate Certificates"}
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Results</CardTitle>
          <CardDescription>
            Add and manage the results for this event. Winners will be notified
            when you publish.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No results added</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start by adding the winners and their positions
              </p>
              <Button onClick={handleAddResult}>
                <Plus className="mr-2 h-4 w-4" />
                Add First Result
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Position</TableHead>
                  <TableHead>Participant</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results
                  .sort((a, b) => a.position - b.position)
                  .map((result) => (
                    <TableRow key={result.participantId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getPositionIcon(result.position)}
                          <Badge className={getPositionBadge(result.position)}>
                            {result.position}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {result.participantName}
                      </TableCell>
                      <TableCell>
                        {result.score !== undefined ? result.score : "-"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {result.remarks || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditResult(result)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleDeleteResult(result.participantId)
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingResult ? "Edit Result" : "Add Result"}
            </DialogTitle>
            <DialogDescription>
              Add the position and details for a participant
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="participant">Participant</Label>
              <Select
                value={formData.participantId}
                onValueChange={(value) =>
                  setFormData({ ...formData, participantId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select participant" />
                </SelectTrigger>
                <SelectContent>
                  {registrations.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No confirmed participants found
                    </div>
                  ) : (
                    registrations.map((reg) => (
                      <SelectItem
                        key={reg._id}
                        value={reg.user?._id || reg._id}
                      >
                        {reg.user?.fullName || "Unknown"} -{" "}
                        {reg.user?.email || "No email"}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                type="number"
                min="1"
                value={formData.position || 1}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    position: parseInt(e.target.value) || 1,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="score">Score (Optional)</Label>
              <Input
                id="score"
                type="number"
                value={formData.score || 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    score: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks (Optional)</Label>
              <Textarea
                id="remarks"
                value={formData.remarks || ""}
                onChange={(e) =>
                  setFormData({ ...formData, remarks: e.target.value })
                }
                placeholder="Add any remarks or achievements"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveResult}>
              {editingResult ? "Update" : "Add"} Result
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Certificate Generation Dialog */}
      <Dialog
        open={showCertificateDialog}
        onOpenChange={setShowCertificateDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Certificates</DialogTitle>
            <DialogDescription>
              Choose the type of certificates to generate for participants
            </DialogDescription>
          </DialogHeader>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Certificate Generation</AlertTitle>
            <AlertDescription>
              {certificateType === "winner"
                ? `Certificates will be generated for ${results.length} winners`
                : `Certificates will be generated for all checked-in participants (${
                    registrations.filter((r) => r.checkInTime).length
                  })`}
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="certificateType">Certificate Type</Label>
              <Select
                value={certificateType}
                onValueChange={(value: "participation" | "winner") =>
                  setCertificateType(value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select certificate type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="winner">Winner Certificates</SelectItem>
                  <SelectItem value="participation">
                    Participation Certificates
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {certificateType === "winner"
                  ? "Generate certificates only for winners/top performers"
                  : "Generate certificates for all participants who attended"}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCertificateDialog(false)}
              disabled={generatingCertificates}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateCertificates}
              disabled={generatingCertificates}
            >
              {generatingCertificates && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Generate Certificates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
