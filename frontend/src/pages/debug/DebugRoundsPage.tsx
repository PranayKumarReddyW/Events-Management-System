import { useState } from "react";
import { eventsApi } from "@/api/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DebugRoundsPage() {
  const [eventId, setEventId] = useState("");
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const testAPI = async () => {
    if (!eventId.trim()) {
      setError("Please enter an event ID");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log("Testing with event ID:", eventId);

      const res = await eventsApi.getEvent(eventId);
      console.log("Full API Response:", res);
      console.log("Event data:", res.data);
      console.log("Event object:", res.data?.event);
      console.log("Rounds:", res.data?.event?.rounds);
      console.log("Current Round:", res.data?.event?.currentRound);

      setResponse(res);
    } catch (err: any) {
      console.error("API Error:", err);
      setError(
        err.response?.data?.message || err.message || "Failed to fetch event"
      );
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Debug Rounds API</h1>

      <Card>
        <CardHeader>
          <CardTitle>Test Event API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter Event ID"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            />
            <Button onClick={testAPI} disabled={loading}>
              {loading ? "Testing..." : "Test API"}
            </Button>
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
              <strong>Error:</strong> {error}
            </div>
          )}

          {response && (
            <div className="space-y-4">
              <div className="p-4 bg-secondary rounded-lg">
                <h3 className="font-semibold mb-2">Event Title:</h3>
                <p>{response.data?.event?.title || "No title"}</p>
              </div>

              <div className="p-4 bg-secondary rounded-lg">
                <h3 className="font-semibold mb-2">Rounds Array:</h3>
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(response.data?.event?.rounds, null, 2)}
                </pre>
              </div>

              <div className="p-4 bg-secondary rounded-lg">
                <h3 className="font-semibold mb-2">Current Round:</h3>
                <p>{response.data?.event?.currentRound ?? "undefined"}</p>
              </div>

              <div className="p-4 bg-secondary rounded-lg">
                <h3 className="font-semibold mb-2">Full Response:</h3>
                <pre className="text-xs overflow-auto max-h-96">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
