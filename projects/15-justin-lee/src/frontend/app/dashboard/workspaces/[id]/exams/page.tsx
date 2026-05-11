"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

import { apiClient, type GeneratedExamSummary } from "@/lib/apiClient";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ExamList } from "@/components/generation/ExamList";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage, isUnauthorizedError } from "@/lib/errorMessages";

export default function ExamListPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const workspaceId = params.id;

  const [exams, setExams] = useState<GeneratedExamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) {
        router.replace("/login");
        return;
      }
      void loadExams();
    });

    async function loadExams() {
      try {
        const result = await apiClient.getExams(workspaceId);
        if (!active) return;
        setExams(result);
      } catch (err) {
        if (!active) return;
        const message = getErrorMessage(err);
        setError(message);
        toast({
          variant: "destructive",
          title: "Unable to load exams",
          description: message,
        });
        if (isUnauthorizedError(err)) {
          router.replace("/login");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, router]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Button variant="ghost" asChild className="w-fit px-0 hover:bg-transparent">
            <Link id="exams-back-to-workspace-link" href={`/dashboard/workspaces/${workspaceId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to workspace
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Exams</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              View all generated exams and practice sets for this workspace.
            </p>
          </div>
        </div>

        <Button id="exams-page-generate-button" asChild>
          <Link href={`/dashboard/workspaces/${workspaceId}/generate`}>
            <Sparkles className="mr-2 h-4 w-4" />
            Generate
          </Link>
        </Button>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-3xl" />
          ))}
        </div>
      )}

      {!loading && error && (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col gap-4 px-6 py-8">
            <h2 className="text-lg font-semibold text-foreground">Unable to load exams</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              id="exams-list-retry-button"
              variant="outline"
              className="w-fit"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (
        <ExamList exams={exams} workspaceId={workspaceId} />
      )}
    </div>
  );
}
