"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { apiClient, type DocumentSourceType } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import {
  getErrorMessage,
  getValidationErrors,
  isUnauthorizedError,
} from "@/lib/errorMessages";

const sourceTypes: { value: DocumentSourceType; label: string }[] = [
  { value: "prior_exam", label: "Prior exam" },
  { value: "homework", label: "Homework" },
  { value: "lecture_slides", label: "Lecture slides" },
  { value: "practice_test", label: "Practice test" },
  { value: "notes", label: "Notes" },
];

export function DocumentUploadForm({
  workspaceId,
  onUploaded,
}: {
  workspaceId: string;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<DocumentSourceType>("lecture_slides");
  const [uploadLabel, setUploadLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [uploadProgress, setUploadProgress] = useState(0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Select a file before uploading.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    setUploadProgress(0);
    try {
      await apiClient.uploadDocument({
        workspaceId,
        file,
        source_type: sourceType,
        upload_label: uploadLabel || undefined,
        onProgress: setUploadProgress,
      });
      setFile(null);
      setUploadLabel("");
      setUploadProgress(100);
      onUploaded();
    } catch (err) {
      const validationErrors = getValidationErrors(err);
      if (Object.keys(validationErrors).length > 0) {
        setFieldErrors(validationErrors);
      }

      const message = getErrorMessage(err);
      setError(message);
      toast({
        variant: "destructive",
        title: "Unable to upload document",
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
    <form id="workspace-upload-form" onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="file">File</Label>
        <Input
          id="file"
          type="file"
          disabled={submitting}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
        />
        {fieldErrors.file ? <p className="text-sm text-destructive">{fieldErrors.file}</p> : null}
        {file ? (
          <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {submitting
                    ? `Uploading... ${uploadProgress}%`
                    : "Ready to upload"}
                </p>
              </div>
              {submitting ? (
                <span className="inline-flex items-center gap-2 text-xs font-medium text-primary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  In progress
                </span>
              ) : null}
            </div>
            {submitting ? <Progress value={uploadProgress} className="mt-3 h-2" /> : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="sourceType">Source type</Label>
        <select
          id="sourceType"
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          value={sourceType}
          disabled={submitting}
          onChange={(e) => setSourceType(e.target.value as DocumentSourceType)}
        >
          {sourceTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {fieldErrors.source_type ? (
          <p className="text-sm text-destructive">{fieldErrors.source_type}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="label">Upload label</Label>
        <Input
          id="label"
          value={uploadLabel}
          disabled={submitting}
          onChange={(e) => setUploadLabel(e.target.value)}
          placeholder="Optional (e.g. Midterm 1)"
        />
        {fieldErrors.upload_label ? (
          <p className="text-sm text-destructive">{fieldErrors.upload_label}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 md:col-span-2 xl:col-span-4 xl:flex-row xl:items-center xl:justify-between">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={submitting || !file} className="w-full xl:ml-auto xl:w-auto">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            "Upload"
          )}
        </Button>
      </div>
    </form>
  );
}
