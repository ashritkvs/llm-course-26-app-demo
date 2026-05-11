"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, UploadCloud, TriangleAlert } from "lucide-react";

import { apiClient, type Document, type Workspace } from "@/lib/apiClient";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import { DocumentUploadForm } from "@/components/documents/DocumentUploadForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage, isUnauthorizedError } from "@/lib/errorMessages";

function WorkspaceDetailSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-3">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-24 rounded-3xl" />
      </div>
      <Skeleton className="h-64 rounded-3xl" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

export default function WorkspaceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const workspaceId = params.id;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pollingError, setPollingError] = useState<string | null>(null);

  async function refresh(showInitialLoader = false) {
    if (showInitialLoader) {
      setLoading(true);
    }
    setError(null);
    try {
      const [w, docs] = await Promise.all([
        apiClient.getWorkspace(workspaceId),
        apiClient.listDocuments(workspaceId),
      ]);
      setWorkspace(w);
      setDocuments(docs);
      setPollingError(null);
    } catch (err) {
      const message = getErrorMessage(err);
      setWorkspace(null);
      setDocuments([]);
      setError(message);
      toast({
        variant: "destructive",
        title: "Unable to load workspace",
        description: message,
      });
      if (isUnauthorizedError(err)) {
        router.replace("/login");
      }
    } finally {
      if (showInitialLoader) {
        setLoading(false);
      }
    }
  }

  async function handleDeleteDocument(documentId: string) {
    setDeletingId(documentId);
    setDeleteError(null);
    try {
      await apiClient.deleteDocument(workspaceId, documentId);
      await refresh();
    } catch (err) {
      const message = getErrorMessage(err);
      setDeleteError(message);
      toast({
        variant: "destructive",
        title: "Unable to delete document",
        description: message,
      });
      if (isUnauthorizedError(err)) {
        router.replace("/login");
      }
    } finally {
      setDeletingId(null);
    }
  }

  const hasActiveProcessing = documents.some((document) =>
    ["uploaded", "parsing", "parsed"].includes(document.processing_status),
  );

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else void refresh(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  useEffect(() => {
    if (!hasActiveProcessing || pollingError) {
      return undefined;
    }

    const id = window.setInterval(() => {
      apiClient
        .listDocuments(workspaceId)
        .then((nextDocuments) => {
          setDocuments(nextDocuments);
          setPollingError(null);
        })
        .catch((err) => {
          const message = getErrorMessage(err);
          setPollingError(message);
          toast({
            variant: "destructive",
            title: "Unable to refresh document status",
            description: message,
          });
          if (isUnauthorizedError(err)) {
            router.replace("/login");
          }
        });
    }, 2000);
    return () => window.clearInterval(id);
  }, [hasActiveProcessing, pollingError, workspaceId, router]);

  if (loading) return <WorkspaceDetailSkeleton />;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{workspace?.title ?? "Workspace"}</h1>
          <p className="text-sm text-muted-foreground">
            {workspace?.course_code ?? "No course code"}
            {workspace?.description ? ` · ${workspace.description}` : ""}
          </p>
        </div>
        {workspace ? (
          <Button variant="outline" asChild>
            <Link id="workspace-detail-insights-link" href={`/dashboard/workspaces/${workspaceId}/insights`}>
              View Insights
            </Link>
          </Button>
        ) : null}
      </div>

      {error ? (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col gap-4 px-6 py-8">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Unable to load workspace</h2>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" className="w-fit" onClick={() => void refresh(true)}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!error && !workspace ? (
        <Card className="border-destructive/30">
          <CardContent className="px-6 py-8 text-sm text-muted-foreground">
            This resource was not found. It may have been deleted.
          </CardContent>
        </Card>
      ) : null}

      {workspace ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-3xl border-border/70">
            <CardContent className="px-5 py-4">
              <p className="text-sm text-muted-foreground">Uploaded materials</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{documents.length}</p>
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-border/70">
            <CardContent className="px-5 py-4">
              <p className="text-sm text-muted-foreground">Professor profile status</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {workspace.profile_status ?? "Not generated yet"}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {workspace ? (
        <>
          <Card className="p-4">
            <DocumentUploadForm workspaceId={workspaceId} onUploaded={refresh} />
          </Card>

          <div className="space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-semibold">Documents</h2>
              {hasActiveProcessing ? (
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Working... indexing usually updates within a few seconds.
                </div>
              ) : null}
            </div>
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
            {pollingError ? (
              <Card className="border-destructive/30">
                <CardContent className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <TriangleAlert className="mt-0.5 h-4 w-4 text-destructive" />
                    <p className="text-sm text-muted-foreground">{pollingError}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void refresh()}>
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : null}
            {documents.length === 0 ? (
              <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
                <CardContent className="px-6 py-10">
                  <Empty className="border-none p-0 md:p-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <UploadCloud className="h-5 w-5" />
                      </EmptyMedia>
                      <EmptyTitle>No documents uploaded</EmptyTitle>
                      <EmptyDescription>
                        Upload course materials to begin.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button asChild>
                        <Link href="#workspace-upload-form">Upload document</Link>
                      </Button>
                    </EmptyContent>
                  </Empty>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {documents.map((d) => (
                  <Card key={d.id} className="p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{d.upload_label ?? d.file_name}</p>
                        <p className="truncate text-sm text-muted-foreground">{d.file_name}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <DocumentStatusBadge status={d.processing_status} />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={deletingId === d.id}
                            >
                              {deletingId === d.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Deleting...
                                </>
                              ) : (
                                "Delete"
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete document?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove {d.upload_label ?? d.file_name} and its
                                derived data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel asChild>
                                <Button variant="outline" disabled={deletingId === d.id}>
                                  Cancel
                                </Button>
                              </AlertDialogCancel>
                              <AlertDialogAction asChild>
                                <Button
                                  variant="destructive"
                                  disabled={deletingId === d.id}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    void handleDeleteDocument(d.id);
                                  }}
                                >
                                  {deletingId === d.id ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Deleting...
                                    </>
                                  ) : (
                                    "Delete document"
                                  )}
                                </Button>
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
