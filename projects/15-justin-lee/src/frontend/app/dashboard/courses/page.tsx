"use client";

import { courses } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  BookOpen,
  Plus,
  ChevronRight,
  FileText,
  Target,
  TrendingUp,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CoursesPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Courses</h1>
          <p className="text-muted-foreground">
            Manage your courses and track progress
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Course
        </Button>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <div
            key={course.id}
            className="group rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/30 hover:shadow-lg"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{course.name}</h3>
                  <p className="text-sm text-muted-foreground">{course.title}</p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Edit Course</DropdownMenuItem>
                  <DropdownMenuItem>View Materials</DropdownMenuItem>
                  <DropdownMenuItem>Generate Practice</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">Archive</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <span>{course.professor}</span>
              <span>·</span>
              <span>{course.semester}</span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-secondary/50 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  Materials
                </div>
                <div className="mt-1 text-lg font-semibold text-foreground">
                  {course.materialsCount}
                </div>
              </div>
              <div className="rounded-lg bg-secondary/50 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Target className="h-3.5 w-3.5" />
                  Profile
                </div>
                <div className="mt-1 text-lg font-semibold text-foreground">
                  {course.profileConfidence}%
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span className="text-muted-foreground">Last score:</span>
                <span className="font-medium text-foreground">{course.lastExamScore}%</span>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/dashboard/courses/${course.id}`}>
                  View
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        ))}

        {/* Add Course Card */}
        <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-border p-6 transition-colors hover:border-primary/50 hover:bg-secondary/20">
          <Button variant="ghost" className="flex-col h-auto py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <span className="mt-3 text-sm font-medium text-muted-foreground">
              Add New Course
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
