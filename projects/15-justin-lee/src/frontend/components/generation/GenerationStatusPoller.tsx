"use client";

import { useEffect, useState } from "react";
import { Loader2, Clock, TriangleAlert } from "lucide-react";

import { apiClient, type GenerationRequestRead } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/errorMessages";

type GenerationStatusPollerProps = {
  workspaceId: string;
  requestId: string;
  onCompleted: (examId: string) => void;
  onRetry: () => void;
};

const POLL_INTERVAL_MS = 3000;

export function GenerationStatusPoller({
  workspaceId,
  requestId,
  onCompleted,
  onRetry,
}: GenerationStatusPollerProps) {
  const [request, setRequest] = useState<GenerationRequestRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const elapsedTimer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    async function poll() {
      try {
        const result = await apiClient.getGenerationRequest(workspaceId, requestId);
        if (!active) return;
        setRequest(result);

        if (result.status === "completed" && result.generated_exam_id) {
          if (timer) clearInterval(timer);
          window.clearInterval(elapsedTimer);
          onCompleted(result.generated_exam_id);
          return;
        }

        if (result.status === "failed") {
          if (timer) clearInterval(timer);
          window.clearInterval(elapsedTimer);
          return;
        }
      } catch (err) {
        if (!active) return;
        setError(getErrorMessage(err));
        if (timer) clearInterval(timer);
        window.clearInterval(elapsedTimer);
      }
    }

    void poll();
    timer = setInterval(() => void poll(), POLL_INTERVAL_MS);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
      window.clearInterval(elapsedTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, requestId]);

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
          <TriangleAlert className="h-10 w-10 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">Unable to check status</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button id="generation-status-retry-button" variant="outline" onClick={onRetry}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (request?.status === "failed") {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
          <TriangleAlert className="h-10 w-10 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">Generation Failed</h2>
          <p className="text-sm text-muted-foreground">
            {request.error_message ?? "An unexpected error occurred during generation."}
          </p>
          <Button id="generation-failed-retry-button" variant="outline" onClick={onRetry}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isRunning = request?.status === "running";

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
      <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
        {isRunning ? (
          <Loader2 id="generation-spinner" className="h-10 w-10 animate-spin text-primary" />
        ) : (
          <Clock id="generation-queued-icon" className="h-10 w-10 text-muted-foreground" />
        )}
        <h2 className="text-lg font-semibold text-foreground">
          {isRunning ? "Generating your exam..." : "Working on your request..."}
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {isRunning
            ? "The backend is building your exam using the professor profile and indexed materials."
            : "Your generation request is queued and should begin shortly."}
        </p>
        <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
          <p>Generation typically takes 15–30 seconds.</p>
          <p className="mt-1">Elapsed time: {elapsedSeconds}s</p>
        </div>
      </CardContent>
    </Card>
  );
}
