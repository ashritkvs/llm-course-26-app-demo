"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { Workspace } from "@/lib/apiClient";
import { apiClient } from "@/lib/apiClient";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage, isUnauthorizedError } from "@/lib/errorMessages";

export function WorkspaceCard({
  workspace,
  onDeleted,
}: {
  workspace: Workspace;
  onDeleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(): Promise<void> {
    setDeleting(true);
    try {
      await apiClient.deleteWorkspace(workspace.id);
      setOpen(false);
      onDeleted?.();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to delete workspace",
        description: getErrorMessage(error),
      });
      if (isUnauthorizedError(error)) {
        window.setTimeout(() => window.location.assign("/login"), 800);
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="flex h-full flex-col justify-between p-4 transition-colors hover:border-primary/30">
      <Link
        href={`/dashboard/workspaces/${workspace.id}`}
        className="block space-y-1"
      >
        <div>
          <p className="font-medium text-foreground">{workspace.title}</p>
          <p className="text-sm text-muted-foreground">
            {workspace.course_code ?? "No course code"}
          </p>
          {workspace.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{workspace.description}</p>
          )}
        </div>
      </Link>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button className="mt-4 w-full sm:w-auto" variant="outline" size="sm" disabled={deleting}>
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this workspace and all its documents. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" disabled={deleting}>Cancel</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={(event) => {
                  event.preventDefault();
                  void handleDelete();
                }}
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
