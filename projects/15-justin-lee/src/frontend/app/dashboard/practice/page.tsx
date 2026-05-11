"use client";

import { practiceSets, courses, conceptMastery } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  FileText,
  Target,
  BookOpen,
  ChevronRight,
  CheckCircle2,
  Clock,
  Filter,
  Plus,
  Sliders,
  Zap,
  Brain,
} from "lucide-react";

const difficultyLevels = ["Easy", "Medium", "Hard", "Mixed"];
const formatOptions = ["MCQ Only", "FRQ Only", "Mixed"];
const noveltyLevels = [
  { label: "Course-Aligned", description: "Close to instructor's style" },
  { label: "Moderately Novel", description: "Some variation introduced" },
  { label: "Highly Novel", description: "New problem structures" },
];

export default function PracticePage() {
  const [showGenerator, setShowGenerator] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(courses[0].id);
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState("Medium");
  const [format, setFormat] = useState("Mixed");
  const [novelty, setNovelty] = useState(0);
  const [targetWeak, setTargetWeak] = useState(true);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  const weakConcepts = conceptMastery.filter((c) => c.mastery < 60);

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Practice Sets</h1>
          <p className="text-muted-foreground">
            Generate targeted practice problems aligned to your course
          </p>
        </div>
        <Button onClick={() => setShowGenerator(!showGenerator)}>
          <Plus className="mr-2 h-4 w-4" />
          Generate New Set
        </Button>
      </div>

      {/* Generator Panel */}
      {showGenerator && (
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-6">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Practice Set Generator</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left Column - Settings */}
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {/* Course Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Course</label>
                  <select
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-secondary px-4 text-sm"
                  >
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.name} - {course.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Question Count */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Questions: {questionCount}
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="25"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Difficulty */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Difficulty</label>
                  <div className="flex gap-2">
                    {difficultyLevels.map((level) => (
                      <button
                        key={level}
                        onClick={() => setDifficulty(level)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                          difficulty === level
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-secondary text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Format */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Format</label>
                  <div className="flex gap-2">
                    {formatOptions.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setFormat(opt)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                          format === opt
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-secondary text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Topic Focus */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Topic Focus</label>
                <div className="flex flex-wrap gap-2">
                  {conceptMastery.map((concept) => (
                    <button
                      key={concept.concept}
                      onClick={() =>
                        setSelectedTopics(
                          selectedTopics.includes(concept.concept)
                            ? selectedTopics.filter((t) => t !== concept.concept)
                            : [...selectedTopics, concept.concept]
                        )
                      }
                      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                        selectedTopics.includes(concept.concept)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {concept.concept}
                      {concept.mastery < 60 && (
                        <span className="ml-1.5 text-xs text-destructive">!</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Novelty Level */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Novelty Level</label>
                <div className="space-y-2">
                  {noveltyLevels.map((level, index) => (
                    <button
                      key={level.label}
                      onClick={() => setNovelty(index)}
                      className={`flex w-full items-center gap-3 rounded-lg border p-3 transition-colors ${
                        novelty === index
                          ? "border-primary bg-primary/10"
                          : "border-border bg-secondary hover:border-primary/50"
                      }`}
                    >
                      <div
                        className={`h-4 w-4 rounded-full border-2 ${
                          novelty === index ? "border-primary bg-primary" : "border-muted-foreground"
                        }`}
                      />
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">{level.label}</p>
                        <p className="text-xs text-muted-foreground">{level.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Weak Areas */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={targetWeak}
                  onChange={(e) => setTargetWeak(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <div>
                  <span className="text-sm font-medium text-foreground">Target weak areas</span>
                  <p className="text-xs text-muted-foreground">
                    Prioritize topics with lower mastery scores
                  </p>
                </div>
              </label>
            </div>

            {/* Right Column - Summary */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Generation Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Questions</span>
                  <span className="font-medium text-foreground">{questionCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Difficulty</span>
                  <span className="font-medium text-foreground">{difficulty}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Format</span>
                  <span className="font-medium text-foreground">{format}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Novelty</span>
                  <span className="font-medium text-foreground">{noveltyLevels[novelty].label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Topics</span>
                  <span className="font-medium text-foreground">
                    {selectedTopics.length || "All"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Prof Match</span>
                  <span className="font-medium text-emerald-500">87%</span>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-4">
                  Estimated completion time: ~{Math.round(questionCount * 3)} minutes
                </p>
                <Button className="w-full">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Practice Set
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weak Areas Alert */}
      {weakConcepts.length > 0 && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <Target className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Weak areas detected</p>
              <p className="text-sm text-muted-foreground">
                {weakConcepts.map((c) => c.concept).join(", ")} need more practice
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setShowGenerator(true);
                setTargetWeak(true);
                setSelectedTopics(weakConcepts.map((c) => c.concept));
              }}
            >
              <Zap className="mr-2 h-4 w-4" />
              Quick Practice
            </Button>
          </div>
        </div>
      )}

      {/* Practice Sets Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {practiceSets.map((set) => (
          <div
            key={set.id}
            className="group rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/30 hover:shadow-lg"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              {set.completed ? (
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-500">{set.score}%</span>
                </div>
              ) : (
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
                  Not started
                </span>
              )}
            </div>

            <h3 className="mt-4 font-semibold text-foreground">{set.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {set.course} · {set.questions} questions · {set.difficulty}
            </p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {set.topics.slice(0, 3).map((topic) => (
                <span
                  key={topic}
                  className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {topic}
                </span>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{set.generatedAt}</span>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/dashboard/practice/${set.id}`}>
                  {set.completed ? "Review" : "Start"}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Generated Questions Preview - Mock */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Preview: Generated Questions</h3>
        <div className="space-y-4">
          {[
            {
              topic: "Hypothesis Testing",
              difficulty: "Medium",
              type: "MCQ",
              preview: "A researcher wants to test H₀: μ = 50 against H₁: μ ≠ 50...",
            },
            {
              topic: "MLE Derivation",
              difficulty: "Hard",
              type: "FRQ",
              preview: "Let X₁, X₂, ..., Xₙ be iid from Exp(λ). Derive the MLE of λ...",
            },
            {
              topic: "Confidence Intervals",
              difficulty: "Medium",
              type: "FRQ",
              preview: "Construct a 95% confidence interval for the population mean when...",
            },
          ].map((q, index) => (
            <div
              key={index}
              className="flex items-start gap-4 rounded-lg border border-border p-4"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                <span className="text-sm font-medium text-muted-foreground">{index + 1}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-primary">{q.topic}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{q.difficulty}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{q.type}</span>
                </div>
                <p className="text-sm text-foreground">{q.preview}</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1">
                <Brain className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs font-medium text-emerald-500">87% match</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
