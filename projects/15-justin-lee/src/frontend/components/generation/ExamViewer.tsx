"use client";

import { useCallback, useState } from "react";
import { Download, Loader2, Send } from "lucide-react";

import { apiClient } from "@/lib/apiClient";
import type {
  GeneratedExamDetail,
  AnswerItem,
  SubmissionRead,
} from "@/lib/apiClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExamQuestionCard } from "@/components/generation/ExamQuestionCard";
import { GradingStatusPoller } from "@/components/submission/GradingStatusPoller";
import { GradingResultsViewer } from "@/components/submission/GradingResultsViewer";
import { toast } from "@/hooks/use-toast";
import {
  getErrorMessage,
  getValidationErrors,
  isUnauthorizedError,
} from "@/lib/errorMessages";

type ExamViewerProps = {
  exam: GeneratedExamDetail;
  workspaceId: string;
  /** When true, hides the submit button and answer inputs (read-only review). */
  reviewOnly?: boolean;
};

function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

type Phase = "taking" | "grading" | "results";

export function ExamViewer({ exam, workspaceId, reviewOnly }: ExamViewerProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadingSolutions, setDownloadingSolutions] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Answer state: questionId -> student answer
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>("taking");
  const [submitting, setSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] =
    useState<SubmissionRead | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitFieldErrors, setSubmitFieldErrors] = useState<Record<string, string>>({});

  const answeredCount = Object.values(answers).filter((v) => v.trim()).length;

  const handleAnswerChange = useCallback(
    (questionId: string, value: string) => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
    },
    [],
  );

  async function handleDownloadPdf() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await apiClient.exportExamPdf(workspaceId, exam.id, "questions");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${exam.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = getErrorMessage(err);
      setDownloadError(message);
      toast({
        variant: "destructive",
        title: "Unable to download PDF",
        description: message,
      });
      if (isUnauthorizedError(err)) {
        window.setTimeout(() => window.location.assign("/login"), 800);
      }
    } finally {
      setDownloading(false);
    }
  }

  async function handleDownloadSolutionsPdf() {
    setDownloadingSolutions(true);
    setDownloadError(null);
    try {
      const blob = await apiClient.exportExamPdf(workspaceId, exam.id, "solutions");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${exam.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_solutions.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = getErrorMessage(err);
      setDownloadError(message);
      toast({
        variant: "destructive",
        title: "Unable to download solutions PDF",
        description: message,
      });
      if (isUnauthorizedError(err)) {
        window.setTimeout(() => window.location.assign("/login"), 800);
      }
    } finally {
      setDownloadingSolutions(false);
    }
  }

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitFieldErrors({});
    setSubmitting(true);

    const answerItems: AnswerItem[] = exam.questions
      .filter((q) => answers[q.id]?.trim())
      .map((q) => ({
        question_id: q.id,
        answer_content: answers[q.id].trim(),
      }));

    if (answerItems.length === 0) {
      setSubmitError("Please answer at least one question before submitting.");
      setSubmitting(false);
      return;
    }

    try {
      const result = await apiClient.createSubmission(workspaceId, exam.id, {
        answers: answerItems,
      });
      setSubmissionId(result.id);
      setPhase("grading");
    } catch (err) {
      const validationErrors = getValidationErrors(err);
      if (Object.keys(validationErrors).length > 0) {
        setSubmitFieldErrors(validationErrors);
      }
      const message = getErrorMessage(err);
      setSubmitError(message);
      toast({
        variant: "destructive",
        title: "Unable to submit answers",
        description: message,
      });
      if (isUnauthorizedError(err)) {
        window.setTimeout(() => window.location.assign("/login"), 800);
      }
      setSubmitting(false);
    }
  }

  function handleGraded(submission: SubmissionRead) {
    setSubmissionResult(submission);
    setPhase("results");
  }

  // --- Grading in progress ---
  if (phase === "grading" && submissionId) {
    return (
      <div className="space-y-6">
        <GradingStatusPoller
          workspaceId={workspaceId}
          submissionId={submissionId}
          onGraded={handleGraded}
        />
      </div>
    );
  }

  // --- Results view ---
  if (phase === "results" && submissionResult) {
    return (
      <GradingResultsViewer
        submission={submissionResult}
        questions={exam.questions}
      />
    );
  }

  // --- Taking / Submission mode ---
  const interactiveMode = !reviewOnly && phase === "taking";

  return (
    <div className="space-y-6">
      {/* Exam header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            {exam.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full">
              {toTitleCase(exam.exam_mode)}
            </Badge>
            <Badge variant="secondary" className="rounded-full">
              {exam.format_type.toUpperCase()}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {exam.questions.length} questions
            </span>
            <span className="text-sm text-muted-foreground">
              {formatTimestamp(exam.created_at)}
            </span>
            {interactiveMode && (
              <span className="text-sm text-muted-foreground">
                {answeredCount}/{exam.questions.length} answered
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            id="exam-download-pdf-button"
            variant="outline"
            disabled={downloading}
            onClick={() => void handleDownloadPdf()}
          >
            {downloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download Questions (PDF)
              </>
            )}
          </Button>
          <Button
            id="exam-download-solutions-button"
            variant="outline"
            disabled={downloadingSolutions}
            onClick={() => void handleDownloadSolutionsPdf()}
          >
            {downloadingSolutions ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download Solutions (PDF)
              </>
            )}
          </Button>
        </div>
      </div>

      {downloadError && (
        <p id="exam-download-error" className="text-sm text-destructive">
          {downloadError}
        </p>
      )}

      {submitError && (
        <p className="text-sm text-destructive">{submitError}</p>
      )}
      {submitFieldErrors.answers ? (
        <p className="text-sm text-destructive">{submitFieldErrors.answers}</p>
      ) : null}

      {/* Questions */}
      <div className="space-y-4">
        {exam.questions.map((question) => (
          <ExamQuestionCard
            key={question.id}
            question={question}
            interactive={interactiveMode}
            answer={answers[question.id] ?? ""}
            onAnswerChange={
              interactiveMode
                ? (value) => handleAnswerChange(question.id, value)
                : undefined
            }
          />
        ))}
      </div>

      {/* Submit button */}
      {interactiveMode && (
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
          <span className="text-sm text-muted-foreground">
            {answeredCount} of {exam.questions.length} answered
          </span>
          <Button
            id="exam-submit-button"
            disabled={submitting || answeredCount === 0}
            onClick={() => void handleSubmit()}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submit Answers
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
