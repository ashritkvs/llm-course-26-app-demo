"use client";

import { simulatedExams, courses } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Plus,
  CheckCircle2,
  Clock,
  ChevronRight,
  Target,
  Sliders,
  FileText,
  Sparkles,
  Play,
  BarChart3,
} from "lucide-react";

export default function ExamsPage() {
  const [showBuilder, setShowBuilder] = useState(false);
  const [examTitle, setExamTitle] = useState("");
  const [examType, setExamType] = useState<"Midterm" | "Final">("Midterm");
  const [timedMode, setTimedMode] = useState(true);
  const [mcqRatio, setMcqRatio] = useState(30);
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState(70);
  const [profAlignment, setProfAlignment] = useState(85);

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Simulated Exams</h1>
          <p className="text-muted-foreground">
            Create realistic exam simulations based on your Professor Profile
          </p>
        </div>
        <Button onClick={() => setShowBuilder(!showBuilder)}>
          <Plus className="mr-2 h-4 w-4" />
          Build New Exam
        </Button>
      </div>

      {/* Exam Builder Panel */}
      {showBuilder && (
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-6">
          <div className="flex items-center gap-2 mb-6">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Exam Builder</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left Column - Settings */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Exam Title</label>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="e.g., Midterm Simulation #3"
                    className="h-10 w-full rounded-lg border border-input bg-secondary px-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Course</label>
                  <select className="h-10 w-full rounded-lg border border-input bg-secondary px-4 text-sm">
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.name} - {course.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Exam Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Exam Type</label>
                <div className="flex gap-4">
                  {(["Midterm", "Final"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setExamType(type)}
                      className={`flex-1 rounded-lg border p-4 text-center transition-colors ${
                        examType === type
                          ? "border-primary bg-primary/10"
                          : "border-border bg-secondary hover:border-primary/50"
                      }`}
                    >
                      <p className={`font-medium ${examType === type ? "text-primary" : "text-foreground"}`}>
                        {type}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {type === "Midterm" ? "60-90 minutes" : "120-180 minutes"}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">MCQ/FRQ Ratio</label>
                    <span className="text-sm text-muted-foreground">{mcqRatio}% MCQ</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={mcqRatio}
                    onChange={(e) => setMcqRatio(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>All FRQ</span>
                    <span>All MCQ</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Question Count</label>
                    <span className="text-sm text-muted-foreground">{questionCount} questions</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="20"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Difficulty Target</label>
                    <span className="text-sm text-muted-foreground">{difficulty}%</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="100"
                    value={difficulty}
                    onChange={(e) => setDifficulty(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Easier</span>
                    <span>Harder</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Professor Alignment</label>
                    <span className="text-sm text-muted-foreground">{profAlignment}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={profAlignment}
                    onChange={(e) => setProfAlignment(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>More Novel</span>
                    <span>Exact Match</span>
                  </div>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={timedMode}
                    onChange={(e) => setTimedMode(e.target.checked)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <div>
                    <span className="text-sm font-medium text-foreground">Timed mode</span>
                    <p className="text-xs text-muted-foreground">
                      Simulate real exam time pressure
                    </p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 rounded border-input accent-primary" />
                  <div>
                    <span className="text-sm font-medium text-foreground">Avoid paraphrases</span>
                    <p className="text-xs text-muted-foreground">
                      Generate completely new questions
                    </p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-input accent-primary" />
                  <div>
                    <span className="text-sm font-medium text-foreground">Use recent emphasis</span>
                    <p className="text-xs text-muted-foreground">
                      Weight topics from recent lectures higher
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Right Column - Preview */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Exam Preview</h3>
              
              <div className="space-y-4">
                <div className="rounded-lg bg-secondary/50 p-4">
                  <p className="text-xs text-muted-foreground">Section A</p>
                  <p className="font-medium text-foreground">Multiple Choice</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {Math.round(questionCount * mcqRatio / 100)} questions · {Math.round(questionCount * mcqRatio / 100) * 5} minutes
                  </p>
                </div>
                
                <div className="rounded-lg bg-secondary/50 p-4">
                  <p className="text-xs text-muted-foreground">Section B</p>
                  <p className="font-medium text-foreground">Free Response</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {questionCount - Math.round(questionCount * mcqRatio / 100)} questions · {(questionCount - Math.round(questionCount * mcqRatio / 100)) * 12} minutes
                  </p>
                </div>

                <div className="border-t border-border pt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Questions</span>
                    <span className="font-medium text-foreground">{questionCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Est. Duration</span>
                    <span className="font-medium text-foreground">
                      {Math.round(questionCount * mcqRatio / 100) * 5 + (questionCount - Math.round(questionCount * mcqRatio / 100)) * 12} min
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Difficulty</span>
                    <span className="font-medium text-foreground">
                      {difficulty < 50 ? "Easy" : difficulty < 70 ? "Medium" : "Hard"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Prof Match</span>
                    <span className="font-medium text-emerald-500">{profAlignment}%</span>
                  </div>
                </div>
              </div>

              <Button className="w-full mt-6">
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Exam
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{simulatedExams.length}</p>
              <p className="text-sm text-muted-foreground">Total Exams</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">
                {simulatedExams.filter((e) => e.completed).length}
              </p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
              <BarChart3 className="h-5 w-5 text-chart-4" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">
                {Math.round(
                  simulatedExams
                    .filter((e) => e.completed)
                    .reduce((acc, e) => acc + (e.score || 0), 0) /
                    simulatedExams.filter((e) => e.completed).length
                )}%
              </p>
              <p className="text-sm text-muted-foreground">Avg Score</p>
            </div>
          </div>
        </div>
      </div>

      {/* Exams List */}
      <div className="space-y-4">
        {simulatedExams.map((exam) => (
          <div
            key={exam.id}
            className="rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/30"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                  <ClipboardList className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{exam.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {exam.course} · {exam.type} · {exam.questions} questions · {exam.duration} min
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {exam.completed ? (
                  <>
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 text-emerald-500">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="text-xl font-semibold">{exam.score}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{exam.takenAt}</p>
                    </div>
                    <Button variant="outline" asChild>
                      <Link href={`/dashboard/submissions/${exam.id}`}>
                        Review
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </>
                ) : (
                  <Button asChild>
                    <Link href={`/dashboard/exams/${exam.id}/take`}>
                      <Play className="mr-2 h-4 w-4" />
                      Start Exam
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            {exam.completed && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Time used:</span>
                    <span className="text-foreground">78 min</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Accuracy:</span>
                    <span className="text-foreground">7/10 correct</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Weakest:</span>
                    <span className="text-destructive">Sufficient Statistics</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
