"use client";

import { simulatedExams, practiceSets } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  FileText,
  ClipboardList,
  ChevronRight,
  CheckCircle2,
  Calendar,
  Clock,
  Target,
  TrendingUp,
} from "lucide-react";

export default function SubmissionsPage() {
  const completedExams = simulatedExams.filter((e) => e.completed);
  const completedPractice = practiceSets.filter((p) => p.completed);

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Submissions</h1>
        <p className="text-muted-foreground">
          Review your completed exams and practice sets
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Total Submissions</p>
          <p className="mt-1 text-3xl font-semibold text-foreground">
            {completedExams.length + completedPractice.length}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Simulated Exams</p>
          <p className="mt-1 text-3xl font-semibold text-foreground">{completedExams.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Practice Sets</p>
          <p className="mt-1 text-3xl font-semibold text-foreground">{completedPractice.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Average Score</p>
          <p className="mt-1 text-3xl font-semibold text-emerald-500">
            {Math.round(
              ([...completedExams, ...completedPractice].reduce(
                (acc, item) => acc + (item.score || 0),
                0
              ) /
                (completedExams.length + completedPractice.length)) ||
                0
            )}
            %
          </p>
        </div>
      </div>

      {/* Submissions Tabs */}
      <div className="space-y-6">
        {/* Simulated Exams */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Simulated Exams</h2>
          <div className="space-y-3">
            {completedExams.map((exam) => (
              <div
                key={exam.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/30"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <ClipboardList className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{exam.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {exam.takenAt}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {exam.duration} min
                      </span>
                      <span className="flex items-center gap-1">
                        <Target className="h-3.5 w-3.5" />
                        {exam.questions} questions
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 text-emerald-500">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="text-2xl font-semibold">{exam.score}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Score</p>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href={`/dashboard/submissions/${exam.id}`}>
                      Review
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
            {completedExams.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">No completed exams yet</p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link href="/dashboard/exams">Take an Exam</Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Practice Sets */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Practice Sets</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedPractice.map((set) => (
              <div
                key={set.id}
                className="rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/30"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-500">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-semibold">{set.score}%</span>
                  </div>
                </div>

                <h3 className="mt-4 font-semibold text-foreground">{set.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {set.course} · {set.questions} questions
                </p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {set.topics.slice(0, 2).map((topic) => (
                    <span
                      key={topic}
                      className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {topic}
                    </span>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{set.generatedAt}</span>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/dashboard/submissions/practice/${set.id}`}>
                      Review
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
            {completedPractice.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">No completed practice sets yet</p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link href="/dashboard/practice">Start Practice</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
