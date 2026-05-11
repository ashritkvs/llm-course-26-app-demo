"use client";

import Link from "next/link";
import { FileText, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { GeneratedExamSummary } from "@/lib/apiClient";

type ExamListProps = {
  exams: GeneratedExamSummary[];
  workspaceId: string;
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

export function ExamList({ exams, workspaceId }: ExamListProps) {
  if (exams.length === 0) {
    return (
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardContent className="px-6 py-10">
          <div className="max-w-2xl space-y-4">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
              No exams yet
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">
              Generate your first exam
            </h2>
            <p className="text-sm leading-7 text-muted-foreground">
              No exams generated yet. Click Generate to create your first exam.
            </p>
            <Button id="exam-list-empty-generate-button" asChild>
              <Link href={`/dashboard/workspaces/${workspaceId}/generate`}>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {exams.map((exam) => (
        <Link
          key={exam.id}
          id={`exam-card-${exam.id}`}
          href={`/dashboard/workspaces/${workspaceId}/exams/${exam.id}`}
          className="block"
        >
          <Card className="border-border/70 transition-colors hover:border-primary/30 hover:bg-muted/30">
            <CardContent className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{exam.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatTimestamp(exam.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Badge variant="outline" className="rounded-full">
                  {toTitleCase(exam.exam_mode)}
                </Badge>
                <Badge variant="secondary" className="rounded-full">
                  {exam.format_type.toUpperCase()}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
