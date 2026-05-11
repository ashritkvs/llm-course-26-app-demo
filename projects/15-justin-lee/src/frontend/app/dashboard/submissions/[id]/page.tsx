"use client";

import { submissionResults, examQuestions } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Target,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Lightbulb,
  BarChart3,
  BookOpen,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

export default function SubmissionResultsPage() {
  const results = submissionResults;

  return (
    <div className="p-6 space-y-6">
      {/* Back Navigation */}
      <Button variant="ghost" className="gap-2" asChild>
        <Link href="/dashboard/submissions">
          <ArrowLeft className="h-4 w-4" />
          Back to Submissions
        </Link>
      </Button>

      {/* Results Header */}
      <div className="rounded-2xl border border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{results.title}</h1>
            <p className="text-muted-foreground">AMS 570 - Statistical Inference</p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
                  results.totalScore >= 80
                    ? "bg-emerald-500/20"
                    : results.totalScore >= 60
                    ? "bg-yellow-500/20"
                    : "bg-destructive/20"
                }`}
              >
                <span
                  className={`text-3xl font-bold ${
                    results.totalScore >= 80
                      ? "text-emerald-500"
                      : results.totalScore >= 60
                      ? "text-yellow-500"
                      : "text-destructive"
                  }`}
                >
                  {results.totalScore}
                </span>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {results.questionsCorrect}/{results.totalQuestions} correct
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="rounded-xl bg-card/50 border border-border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Time Used
            </div>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {results.timeTaken}/{results.timeAllowed} min
            </p>
          </div>
          <div className="rounded-xl bg-card/50 border border-border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              Accuracy
            </div>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {Math.round((results.questionsCorrect / results.totalQuestions) * 100)}%
            </p>
          </div>
          <div className="rounded-xl bg-card/50 border border-border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              Correct
            </div>
            <p className="mt-1 text-xl font-semibold text-emerald-500">
              {results.questionsCorrect}
            </p>
          </div>
          <div className="rounded-xl bg-card/50 border border-border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <XCircle className="h-4 w-4" />
              Incorrect
            </div>
            <p className="mt-1 text-xl font-semibold text-destructive">
              {results.totalQuestions - results.questionsCorrect}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Topic Performance */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Topic Performance</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={results.topicBreakdown} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis
                    type="category"
                    dataKey="topic"
                    width={140}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`${value}%`, "Score"]}
                  />
                  <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
                    {results.topicBreakdown.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.percentage >= 80
                            ? "hsl(var(--chart-2))"
                            : entry.percentage >= 60
                            ? "hsl(var(--chart-4))"
                            : "hsl(var(--destructive))"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {results.topicBreakdown.map((topic) => (
                <div
                  key={topic.topic}
                  className="flex items-center justify-between rounded-lg bg-secondary/30 p-3"
                >
                  <span className="text-sm text-foreground">{topic.topic}</span>
                  <span className="text-sm text-muted-foreground">
                    {topic.correct}/{topic.total}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Question Review */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Question Review</h2>
            <div className="space-y-4">
              {results.questionResults.map((result, index) => {
                const question = examQuestions[index];
                return (
                  <div
                    key={result.id}
                    className={`rounded-xl border p-4 ${
                      result.correct
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-destructive/30 bg-destructive/5"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                            result.correct ? "bg-emerald-500/20" : "bg-destructive/20"
                          }`}
                        >
                          {result.correct ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">Question {index + 1}</span>
                            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                              {question?.topic}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {question?.question}
                          </p>
                          {result.feedback && (
                            <p className="mt-2 text-sm text-foreground bg-secondary/50 rounded-lg p-2">
                              {result.feedback}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-medium text-foreground">
                          {result.points}/{result.maxPoints}
                        </span>
                        <p className="text-xs text-muted-foreground">points</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Error Analysis */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Error Analysis</h2>
            <div className="flex items-center justify-center h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={results.errorAnalysis}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="type"
                  >
                    {results.errorAnalysis.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {results.errorAnalysis.map((error, index) => (
                <div key={error.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: `hsl(var(--chart-${(index % 5) + 1}))` }}
                    />
                    <span className="text-sm text-muted-foreground">{error.type}</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">{error.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Recommendations</h2>
            </div>
            <div className="space-y-3">
              {results.recommendations.map((rec, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-xs font-medium text-primary">{index + 1}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{rec}</p>
                </div>
              ))}
            </div>
            <Button className="w-full mt-4" asChild>
              <Link href="/dashboard/practice">
                Practice Weak Areas
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Next Steps */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Next Steps</h2>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/dashboard/practice">
                  <BarChart3 className="mr-2 h-4 w-4 text-primary" />
                  Generate Targeted Practice
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/dashboard/analytics">
                  <TrendingUp className="mr-2 h-4 w-4 text-chart-4" />
                  View Full Analytics
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/dashboard/exams">
                  <BookOpen className="mr-2 h-4 w-4 text-accent" />
                  Retake Similar Exam
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
