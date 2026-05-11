"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { apiClient } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  getErrorMessage,
  getValidationErrors,
  isUnauthorizedError,
} from "@/lib/errorMessages";

export function CreateWorkspaceDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await apiClient.createWorkspace({
        title,
        course_code: courseCode || null,
        description: description || null,
      });
      setOpen(false);
      setTitle("");
      setCourseCode("");
      setDescription("");
      onCreated();
    } catch (err) {
      const validationErrors = getValidationErrors(err);
      if (Object.keys(validationErrors).length > 0) {
        setFieldErrors(validationErrors);
      }

      const message = getErrorMessage(err);
      setError(message);
      toast({
        variant: "destructive",
        title: "Unable to create workspace",
        description: message,
      });
      if (isUnauthorizedError(err)) {
        window.setTimeout(() => window.location.assign("/login"), 800);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create workspace</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New workspace</DialogTitle>
          <DialogDescription className="sr-only">
            Create a new workspace for your course.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              required
            />
            {fieldErrors.title ? (
              <p className="text-sm text-destructive">{fieldErrors.title}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="courseCode">Course code</Label>
            <Input
              id="courseCode"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              placeholder="e.g. AMS 310"
              disabled={submitting}
            />
            {fieldErrors.course_code ? (
              <p className="text-sm text-destructive">{fieldErrors.course_code}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              disabled={submitting}
            />
            {fieldErrors.description ? (
              <p className="text-sm text-destructive">{fieldErrors.description}</p>
            ) : null}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
