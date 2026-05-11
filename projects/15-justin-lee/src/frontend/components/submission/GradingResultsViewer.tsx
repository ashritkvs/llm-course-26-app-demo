"use client";

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Target,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type {
  SubmissionRead,
  SubmissionAnswer,
  ExamQuestion,
  CorrectnessLabel,
} from "@/lib/apiClient";

type GradingResultsViewerProps = {
  submission: SubmissionRead;
  questions: ExamQuestion[];
};

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function getCorrectnessLabel(
  result: SubmissionAnswer["grading_result"],
): CorrectnessLabel {
  if (!result) return "incorrect";
  return result.correctness_label;
}

function correctnessStyles(label: CorrectnessLabel) {
  switch (label) {
    case "correct":
      return {
        border: "border-emerald-500/30",
        bg: "bg-emerald-500/5",
        iconBg: "bg-emerald-500/20",
        text: "text-emerald-500",
        badgeCls:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        label: "Correct",
      };
    case "partial":
      return {
        border: "border-yellow-500/30",
        bg: "bg-yellow-500/5",
        iconBg: "bg-yellow-500/20",
        text: "text-yellow-500",
        badgeCls:
          "border-yellow-500/20 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
        label: "Partial Credit",
      };
    case "incorrect":
      return {
        border: "border-destructive/30",
        bg: "bg-destructive/5",
        iconBg: "bg-destructive/20",
        text: "text-destructive",
        badgeCls:
          "border-destructive/20 bg-destructive/10 text-destructive",
        label: "Incorrect",
      };
  }
}

function severityBadgeClasses(severity: string | null) {
  switch (severity) {
    case "major":
      return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
    case "moderate":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    default:
      return "border-border bg-secondary text-secondary-foreground";
  }
}

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatStudentAnswer(
  answer: string,
  question: ExamQuestion | undefined,
): string {
  if (!question || question.question_type !== "mcq" || !question.options) {
    return answer;
  }
  const idx = OPTION_LABELS.indexOf(answer.toUpperCase());
  if (idx >= 0 && idx < question.options.length) {
    return `${OPTION_LABELS[idx]}) ${question.options[idx]}`;
  }
  return answer;
}

function formatCorrectAnswer(question: ExamQuestion | undefined): string | null {
  if (!question?.answer_key) return null;
  const key = question.answer_key;
  if (question.question_type === "mcq" && question.options) {
    const idx = OPTION_LABELS.indexOf(key.toUpperCase());
    if (idx >= 0 && idx < question.options.length) {
      return `${OPTION_LABELS[idx]}) ${question.options[idx]}`;
    }
  }
  return key;
}

export function GradingResultsViewer({
  submission,
  questions,
}: GradingResultsViewerProps) {
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const totalScore = submission.overall_score ?? 0;
  const maxScore = submission.total_possible ?? 1;
  const percentage = Math.round((totalScore / maxScore) * 100);
  const correctCount = submission.answers.filter(
    (a) => a.grading_result?.correctness_label === "correct",
  ).length;
  const incorrectCount = submission.answers.length - correctCount;

  return (
    <div className="space-y-6">
      {/* Score Header */}
      <div className="rounded-2xl border border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">
              Grading Results
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {submission.answers.length} questions graded
            </p>
          </div>
          <div className="text-right">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
                percentage >= 80
                  ? "bg-emerald-500/20"
                  : percentage >= 60
                    ? "bg-yellow-500/20"
                    : "bg-destructive/20"
              }`}
            >
              <span
                className={`text-2xl font-bold ${
                  percentage >= 80
                    ? "text-emerald-500"
                    : percentage >= 60
                      ? "text-yellow-500"
                      : "text-destructive"
                }`}
              >
                {percentage}%
              </span>
            </div>
          </div>
        </div>

        {/* Score bar */}
        <div className="mt-4 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Score</span>
            <span className="font-medium text-foreground">
              {totalScore} / {maxScore}
            </span>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>

        {/* Quick stats */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              Accuracy
            </div>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {percentage}%
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              Correct
            </div>
            <p className="mt-1 text-xl font-semibold text-emerald-500">
              {correctCount}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <XCircle className="h-4 w-4" />
              Incorrect
            </div>
            <p className="mt-1 text-xl font-semibold text-destructive">
              {incorrectCount}
            </p>
          </div>
        </div>
      </div>

      {/* Question-by-Question Review */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">
          Question Review
        </h3>
        {submission.answers.map((answer) => {
          const question = questionMap.get(answer.question_id);
          const gr = answer.grading_result;
          const label = getCorrectnessLabel(gr);
          const styles = correctnessStyles(label);

          return (
            <Card
              key={answer.id}
              className={`${styles.border} ${styles.bg}`}
            >
              <CardContent className="space-y-4 px-6 py-5">
                {/* Question header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${styles.iconBg}`}
                    >
                      {label === "correct" ? (
                        <CheckCircle2
                          className={`h-4 w-4 ${styles.text}`}
                        />
                      ) : label === "partial" ? (
                        <AlertTriangle
                          className={`h-4 w-4 ${styles.text}`}
                        />
                      ) : (
                        <XCircle className={`h-4 w-4 ${styles.text}`} />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">
                          Q{question?.question_order ?? "?"}
                        </span>
                        <Badge
                          variant="outline"
                          className={`rounded-full ${styles.badgeCls}`}
                        >
                          {styles.label}
                        </Badge>
                        {question && (
                          <>
                            <Badge
                              variant="outline"
                              className="rounded-full"
                            >
                              {question.question_type.toUpperCase()}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className="rounded-full"
                            >
                              {toTitleCase(question.topic_label)}
                            </Badge>
                          </>
                        )}
                      </div>
                      {question && (
                        <p className="text-sm leading-6 text-muted-foreground line-clamp-2">
                          {question.question_text}
                        </p>
                      )}
                    </div>
                  </div>
                  {gr && (
                    <div className="text-right shrink-0">
                      <span className="font-medium text-foreground">
                        {gr.score_value}/{gr.points_possible}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        points
                      </p>
                    </div>
                  )}
                </div>

                {/* Your answer vs correct answer */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-card/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Your Answer
                    </p>
                    <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                      {formatStudentAnswer(answer.answer_content, question)}
                    </p>
                  </div>
                  {question?.answer_key && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Correct Answer
                      </p>
                      <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                        {formatCorrectAnswer(question)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Diagnostic explanation */}
                {gr?.diagnostic_explanation && (
                  <div className="rounded-xl border border-border bg-secondary/30 p-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Feedback
                    </p>
                    <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                      {gr.diagnostic_explanation}
                    </p>
                  </div>
                )}

                {/* Error classifications */}
                {gr &&
                  gr.error_classifications.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {gr.error_classifications.map((ec) => (
                        <Badge
                          key={ec.id}
                          variant="outline"
                          className={`rounded-full ${severityBadgeClasses(ec.severity)}`}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {toTitleCase(ec.error_type)}
                        </Badge>
                      ))}
                    </div>
                  )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
