"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  Brain,
  Target,
  FileText,
  BarChart3,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Shield,
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "Professor Modeling",
    description:
      "AI analyzes your course materials to build a detailed profile of your instructor's testing patterns, topic emphasis, and question styles.",
  },
  {
    icon: Target,
    title: "Scope-Aware Generation",
    description:
      "Generate practice problems and exams that match exactly what your professor would ask, down to the difficulty progression.",
  },
  {
    icon: FileText,
    title: "Simulated Exams",
    description:
      "Take realistic midterm and final simulations with timed conditions, MCQ and FRQ formats, and authentic question stems.",
  },
  {
    icon: BarChart3,
    title: "Weakness Analytics",
    description:
      "Detailed breakdown of your concept mastery, error patterns, and personalized recommendations for improvement.",
  },
  {
    icon: Sparkles,
    title: "Targeted Regeneration",
    description:
      "Automatically generate new practice sets focused on your weak areas and likely exam topics.",
  },
  {
    icon: Shield,
    title: "Structured Grading",
    description:
      "Get instant, detailed feedback with rubric-based scoring and specific explanations for every answer.",
  },
];

const steps = [
  {
    number: "01",
    title: "Upload Materials",
    description:
      "Add lecture slides, homework sets, prior exams, and notes from your course.",
  },
  {
    number: "02",
    title: "Build Professor Profile",
    description:
      "Our AI analyzes materials to model instructor tendencies and exam patterns.",
  },
  {
    number: "03",
    title: "Generate Practice",
    description:
      "Create targeted problem sets and simulated exams matched to your course.",
  },
  {
    number: "04",
    title: "Track & Improve",
    description:
      "Review graded submissions, identify weaknesses, and master every concept.",
  },
];

const comparisons = [
  {
    generic: "Generic flashcard apps",
    examprofile: "Course-specific, professor-aligned practice",
  },
  {
    generic: "Random practice problems",
    examprofile: "Questions modeled on actual exam patterns",
  },
  {
    generic: "Simple right/wrong feedback",
    examprofile: "Detailed rubric scoring with explanations",
  },
  {
    generic: "No insight into weak areas",
    examprofile: "Comprehensive weakness analytics dashboard",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground">ExamProfile</span>
            <span className="text-xs font-medium text-muted-foreground">AI</span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </Link>
            <Link href="#comparison" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Why ExamProfile
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">
                AI-Powered Exam Preparation for STEM Students
              </span>
            </div>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Study smarter with{" "}
              <span className="gradient-text">professor-specific</span> practice
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground sm:text-xl">
              Upload your course materials. Build a profile of your instructor&apos;s testing
              style. Generate practice exams that feel like the real thing. Master every
              concept before exam day.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" className="h-12 px-8 text-base" asChild>
                <Link href="/signup">
                  Start Building Your Exam Profile
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 text-base" asChild>
                <Link href="/dashboard">
                  View Demo
                </Link>
              </Button>
            </div>
            <div className="mt-8 flex items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Free to start</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Works with any STEM course</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-secondary/30">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              How ExamProfile AI Works
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              From materials to mastery in four simple steps
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                {index < steps.length - 1 && (
                  <div className="absolute left-1/2 top-12 hidden h-0.5 w-full bg-border lg:block" />
                )}
                <div className="relative rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/50 hover:shadow-lg">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
                    {step.number}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Everything you need to ace your exams
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Powerful features designed specifically for serious STEM students
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/50 hover:shadow-lg"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section id="comparison" className="py-24 bg-secondary/30">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Why ExamProfile AI is different
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Not another generic study tool. Built for how professors actually test.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {comparisons.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card p-6"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                    <span className="text-sm line-through">{item.generic}</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-foreground">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-sm font-medium">{item.examprofile}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-foreground">50K+</div>
              <div className="mt-2 text-sm text-muted-foreground">Practice problems generated</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-foreground">2,500+</div>
              <div className="mt-2 text-sm text-muted-foreground">Students studying</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-foreground">87%</div>
              <div className="mt-2 text-sm text-muted-foreground">Average score improvement</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-foreground">150+</div>
              <div className="mt-2 text-sm text-muted-foreground">Universities represented</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 p-12 md:p-20">
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
            <div className="relative mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Ready to transform how you study?
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Join thousands of STEM students who are acing their exams with professor-specific practice.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button size="lg" className="h-12 px-8 text-base" asChild>
                  <Link href="/signup">
                    Get Started Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-8 text-base" asChild>
                  <Link href="/dashboard">
                    Explore Demo
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold text-foreground">ExamProfile</span>
              <span className="text-xs font-medium text-muted-foreground">AI</span>
            </div>
            <div className="flex items-center gap-8 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="#" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="#" className="hover:text-foreground transition-colors">Contact</Link>
              <Link href="#" className="hover:text-foreground transition-colors">Support</Link>
            </div>
            <div className="text-sm text-muted-foreground">
              2026 ExamProfile AI. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
