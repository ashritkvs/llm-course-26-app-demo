"use client";

import { examQuestions } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Flag,
  ChevronLeft,
  ChevronRight,
  Save,
  Send,
  BookOpen,
  Calculator,
  X,
  CheckCircle2,
  Circle,
} from "lucide-react";

export default function ExamTakingPage() {
  const router = useRouter();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number | string>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState(90 * 60); // 90 minutes in seconds
  const [showReference, setShowReference] = useState(false);

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const question = examQuestions[currentQuestion];
  const progress = (Object.keys(answers).length / examQuestions.length) * 100;

  const handleAnswerChange = (value: number | string) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion]: value }));
  };

  const toggleFlag = () => {
    setFlagged((prev) => {
      const newFlagged = new Set(prev);
      if (newFlagged.has(currentQuestion)) {
        newFlagged.delete(currentQuestion);
      } else {
        newFlagged.add(currentQuestion);
      }
      return newFlagged;
    });
  };

  const handleSubmit = () => {
    // Navigate to results page
    router.push("/dashboard/submissions/1");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <X className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-semibold text-foreground">Midterm Simulation #1</h1>
              <p className="text-xs text-muted-foreground">AMS 570 - Statistical Inference</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Timer */}
            <div
              className={`flex items-center gap-2 rounded-lg px-4 py-2 ${
                timeRemaining < 600
                  ? "bg-destructive/10 text-destructive"
                  : "bg-secondary text-foreground"
              }`}
            >
              <Clock className="h-4 w-4" />
              <span className="font-mono text-lg font-semibold">{formatTime(timeRemaining)}</span>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-3">
              <div className="h-2 w-32 rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-sm text-muted-foreground">
                {Object.keys(answers).length}/{examQuestions.length}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
              <Button size="sm" onClick={handleSubmit}>
                <Send className="mr-2 h-4 w-4" />
                Submit
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Main Content */}
        <div className="flex-1 p-6">
          <div className="mx-auto max-w-4xl">
            {/* Question Header */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-primary">
                  {currentQuestion + 1}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-primary">
                      {question.topic}
                    </span>
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      {question.difficulty}
                    </span>
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      {question.type.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant={flagged.has(currentQuestion) ? "default" : "outline"}
                size="sm"
                onClick={toggleFlag}
              >
                <Flag className={`mr-2 h-4 w-4 ${flagged.has(currentQuestion) ? "fill-current" : ""}`} />
                {flagged.has(currentQuestion) ? "Flagged" : "Flag"}
              </Button>
            </div>

            {/* Question Content */}
            <div className="rounded-2xl border border-border bg-card p-8">
              <p className="text-lg text-foreground leading-relaxed">{question.question}</p>

              {/* MCQ Options */}
              {question.type === "mcq" && question.options && (
                <div className="mt-8 space-y-3">
                  {question.options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleAnswerChange(index)}
                      className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all ${
                        answers[currentQuestion] === index
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 hover:bg-secondary/50"
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                          answers[currentQuestion] === index
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/50 text-muted-foreground"
                        }`}
                      >
                        {String.fromCharCode(65 + index)}
                      </div>
                      <span className="text-foreground">{option}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* FRQ Answer */}
              {question.type === "frq" && (
                <div className="mt-8">
                  <label className="text-sm font-medium text-foreground">Your Answer</label>
                  <textarea
                    value={(answers[currentQuestion] as string) || ""}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    placeholder="Type your answer here. You can use mathematical notation like X_bar, sigma^2, etc."
                    className="mt-2 min-h-[200px] w-full rounded-xl border border-input bg-secondary/50 p-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {question.rubric && (
                    <div className="mt-4 rounded-lg bg-muted/50 p-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Grading Rubric:</p>
                      <ul className="space-y-1">
                        {question.rubric.map((item, index) => (
                          <li key={index} className="text-xs text-muted-foreground">• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="mt-6 flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
                disabled={currentQuestion === 0}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              <div className="flex items-center gap-2">
                {examQuestions.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentQuestion(index)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      currentQuestion === index
                        ? "bg-primary text-primary-foreground"
                        : answers[index] !== undefined
                        ? "bg-emerald-500/20 text-emerald-500"
                        : flagged.has(index)
                        ? "bg-yellow-500/20 text-yellow-500"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              <Button
                onClick={() => setCurrentQuestion((prev) => Math.min(examQuestions.length - 1, prev + 1))}
                disabled={currentQuestion === examQuestions.length - 1}
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Reference Sidebar */}
        <div className="w-80 border-l border-border bg-card/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Quick Reference</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReference(!showReference)}
            >
              {showReference ? "Hide" : "Show"}
            </Button>
          </div>

          {showReference && (
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Common Formulas</p>
                <div className="space-y-2 text-sm text-foreground font-mono">
                  <p>Z = (X̄ - μ) / (σ/√n)</p>
                  <p>t = (X̄ - μ) / (s/√n)</p>
                  <p>CI = X̄ ± z·(σ/√n)</p>
                  <p>χ² = Σ(O-E)²/E</p>
                </div>
              </div>

              <div className="rounded-lg bg-secondary p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Critical Values</p>
                <div className="space-y-2 text-sm text-foreground">
                  <div className="flex justify-between">
                    <span>z₀.₀₂₅</span>
                    <span className="font-mono">1.96</span>
                  </div>
                  <div className="flex justify-between">
                    <span>z₀.₀₅</span>
                    <span className="font-mono">1.645</span>
                  </div>
                  <div className="flex justify-between">
                    <span>z₀.₀₁</span>
                    <span className="font-mono">2.326</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Question Navigator */}
          <div className="mt-6">
            <h3 className="font-semibold text-foreground mb-4">Questions</h3>
            <div className="space-y-2">
              {examQuestions.map((q, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentQuestion(index)}
                  className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors ${
                    currentQuestion === index
                      ? "bg-primary/10"
                      : "hover:bg-secondary"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {answers[index] !== undefined ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : flagged.has(index) ? (
                      <Flag className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">Q{index + 1}</p>
                    <p className="text-xs text-muted-foreground">{q.topic}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{q.type}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-6 rounded-lg bg-secondary/50 p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Legend</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-muted-foreground">Answered</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Flag className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                <span className="text-muted-foreground">Flagged</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Not answered</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
