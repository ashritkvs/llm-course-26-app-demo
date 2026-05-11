"use client";

import { courses, uploadedFiles, professorProfile, practiceSets, simulatedExams, conceptMastery } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  BookOpen,
  FileText,
  Target,
  TrendingUp,
  ChevronRight,
  Upload,
  Sparkles,
  Clock,
  CheckCircle2,
  ArrowLeft,
  Brain,
  BarChart3,
} from "lucide-react";

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // For demo, always show the first course
  const course = courses[0];
  const recentMaterials = uploadedFiles.slice(0, 5);
  const recentPractice = practiceSets.slice(0, 3);
  const recentExams = simulatedExams.slice(0, 2);

  return (
    <div className="p-6 space-y-6">
      {/* Back Navigation */}
      <Button variant="ghost" className="gap-2" asChild>
        <Link href="/dashboard/courses">
          <ArrowLeft className="h-4 w-4" />
          Back to Courses
        </Link>
      </Button>

      {/* Course Header */}
      <div className="rounded-2xl border border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/20">
              <BookOpen className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {course.name} - {course.title}
              </h1>
              <p className="text-muted-foreground">
                {course.professor} · {course.semester}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" asChild>
              <Link href="/dashboard/uploads">
                <Upload className="mr-2 h-4 w-4" />
                Upload Materials
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/practice">
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Practice
              </Link>
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-card/50 border border-border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              Materials
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">
              {course.materialsCount}
            </div>
          </div>
          <div className="rounded-xl bg-card/50 border border-border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              Profile Confidence
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">
              {course.profileConfidence}%
            </div>
          </div>
          <div className="rounded-xl bg-card/50 border border-border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Brain className="h-4 w-4" />
              Topics Extracted
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">
              {course.topicsExtracted}
            </div>
          </div>
          <div className="rounded-xl bg-card/50 border border-border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Last Score
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">
              {course.lastExamScore}%
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Professor Profile Snapshot */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Professor Profile</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/professor-profile">
                  View Full Profile
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {professorProfile.summary}
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-secondary/50 p-3 text-center">
                <div className="text-xs text-muted-foreground">MCQ</div>
                <div className="text-lg font-semibold text-foreground">
                  {professorProfile.questionFormats.mcq}%
                </div>
              </div>
              <div className="rounded-lg bg-secondary/50 p-3 text-center">
                <div className="text-xs text-muted-foreground">Short Answer</div>
                <div className="text-lg font-semibold text-foreground">
                  {professorProfile.questionFormats.shortAnswer}%
                </div>
              </div>
              <div className="rounded-lg bg-secondary/50 p-3 text-center">
                <div className="text-xs text-muted-foreground">Long Form</div>
                <div className="text-lg font-semibold text-foreground">
                  {professorProfile.questionFormats.longForm}%
                </div>
              </div>
            </div>
          </div>

          {/* Topic Map */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Topic Mastery</h2>
            <div className="space-y-3">
              {conceptMastery.slice(0, 6).map((concept) => (
                <div key={concept.concept} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{concept.concept}</span>
                    <span className="text-muted-foreground">{concept.mastery}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${concept.mastery}%`,
                        backgroundColor:
                          concept.mastery >= 70
                            ? "hsl(var(--chart-2))"
                            : concept.mastery >= 50
                            ? "hsl(var(--chart-4))"
                            : "hsl(var(--destructive))",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Materials */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Recent Materials</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/uploads">
                  View All
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="space-y-2">
              {recentMaterials.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between rounded-lg bg-secondary/30 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.type} · {file.size}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      file.status === "indexed"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : file.status === "parsing"
                        ? "bg-yellow-500/10 text-yellow-500"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {file.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Recommended Next Steps */}
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">Recommended</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Based on your progress and upcoming exam date
            </p>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/dashboard/practice">
                  <Sparkles className="mr-2 h-4 w-4 text-primary" />
                  Practice Bayesian Estimation
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/dashboard/exams">
                  <Clock className="mr-2 h-4 w-4 text-chart-4" />
                  Take Midterm Simulation
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/dashboard/analytics">
                  <BarChart3 className="mr-2 h-4 w-4 text-accent" />
                  Review Weak Areas
                </Link>
              </Button>
            </div>
          </div>

          {/* Recent Practice Sets */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Practice Sets</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/practice">
                  All
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="space-y-3">
              {recentPractice.map((set) => (
                <div
                  key={set.id}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{set.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {set.questions} questions · {set.difficulty}
                      </p>
                    </div>
                    {set.completed ? (
                      <div className="flex items-center gap-1 text-emerald-500">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm font-medium">{set.score}%</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not started</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Exams */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Simulated Exams</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/exams">
                  All
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="space-y-3">
              {recentExams.map((exam) => (
                <div
                  key={exam.id}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{exam.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {exam.type} · {exam.duration} min
                      </p>
                    </div>
                    {exam.completed ? (
                      <div className="flex items-center gap-1 text-emerald-500">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm font-medium">{exam.score}%</span>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline">
                        Start
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
