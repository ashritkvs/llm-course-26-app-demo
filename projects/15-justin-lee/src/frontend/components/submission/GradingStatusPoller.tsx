"use client";

import { useEffect, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";

import { apiClient, type SubmissionRead } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/errorMessages";

type GradingStatusPollerProps = {
  workspaceId: string;
  submissionId: string;
  onGraded: (submission: SubmissionRead) => void;
};

const POLL_INTERVAL_MS = 3000;

export function GradingStatusPoller({
  workspaceId,
  submissionId,
  onGraded,
}: GradingStatusPollerProps) {
  const [status, setStatus] = useState<string>("submitted");
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
        const result = await apiClient.getSubmission(workspaceId, submissionId);
        if (!active) return;
        setStatus(result.status);

        if (result.status === "graded") {
          if (timer) clearInterval(timer);
          window.clearInterval(elapsedTimer);
          onGraded(result);
          return;
        }

        if (result.status === "failed") {
          if (timer) clearInterval(timer);
          window.clearInterval(elapsedTimer);
          setError("Grading failed. Please try submitting again.");
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
  }, [workspaceId, submissionId]);

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
          <TriangleAlert className="h-10 w-10 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">
            Grading Failed
          </h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
      <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <h2 className="text-lg font-semibold text-foreground">
          {status === "grading"
            ? "Grading in progress..."
            : "Submission received"}
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {status === "grading"
            ? "Your answers are being evaluated."
            : "Your submission has been received and grading will begin shortly."}
        </p>
        <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
          <p>Grading usually finishes in 5–10 seconds.</p>
          <p className="mt-1">Elapsed time: {elapsedSeconds}s</p>
        </div>
      </CardContent>
    </Card>
  );
}
