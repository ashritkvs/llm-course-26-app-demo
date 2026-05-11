"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { apiClient, ApiError, type GeneratedExamDetail } from "@/lib/apiClient";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ExamViewer } from "@/components/generation/ExamViewer";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage, isUnauthorizedError } from "@/lib/errorMessages";

export default function ExamDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string; examId: string }>();
  const workspaceId = params.id;
  const examId = params.examId;

  const [exam, setExam] = useState<GeneratedExamDetail | null>(null);
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
      void loadExam();
    });

    async function loadExam() {
      try {
        const result = await apiClient.getExamDetail(workspaceId, examId);
        if (!active) return;
        setExam(result);
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiError && err.status === 404) {
          setError("Exam not found.");
        } else {
          setError(getErrorMessage(err));
        }
        toast({
          variant: "destructive",
          title: "Unable to load exam",
          description:
            err instanceof ApiError && err.status === 404
              ? "Exam not found."
              : getErrorMessage(err),
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
  }, [workspaceId, examId, router]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-3">
        <Button variant="ghost" asChild className="w-fit px-0 hover:bg-transparent">
          <Link id="exam-back-to-workspace-link" href={`/dashboard/workspaces/${workspaceId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to workspace
          </Link>
        </Button>
      </div>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-6 w-48" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-3xl" />
          ))}
        </div>
      )}

      {!loading && error && (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col gap-4 px-6 py-8">
            <h2 className="text-lg font-semibold text-foreground">Unable to load exam</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              id="exam-detail-retry-button"
              variant="outline"
              className="w-fit"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && exam && (
        <ExamViewer exam={exam} workspaceId={workspaceId} />
      )}
    </div>
  );
}
