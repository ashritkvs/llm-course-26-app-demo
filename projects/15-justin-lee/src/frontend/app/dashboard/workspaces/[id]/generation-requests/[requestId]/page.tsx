"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getSupabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { GenerationStatusPoller } from "@/components/generation/GenerationStatusPoller";
import { LoadingState } from "@/components/ui/loading-state";

export default function GenerationRequestStatusPage() {
  const router = useRouter();
  const params = useParams<{ id: string; requestId: string }>();
  const workspaceId = params.id;
  const requestId = params.requestId;
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      } else {
        setAuthenticated(true);
      }
    });
  }, [router]);

  function handleCompleted(examId: string) {
    router.push(`/dashboard/workspaces/${workspaceId}/exams/${examId}`);
  }

  function handleRetry() {
    router.push(`/dashboard/workspaces/${workspaceId}/generate`);
  }

  if (!authenticated) {
    return (
      <div className="p-4 md:p-6">
        <LoadingState
          title="Checking request access..."
          description="Preparing the generation status view."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-3">
        <Button variant="ghost" asChild className="w-fit px-0 hover:bg-transparent">
          <Link id="status-back-to-workspace-link" href={`/dashboard/workspaces/${workspaceId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to workspace
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Generation Status
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Monitoring your generation request. You will be redirected to the exam viewer once
            generation is complete.
          </p>
        </div>
      </div>

      <GenerationStatusPoller
        workspaceId={workspaceId}
        requestId={requestId}
        onCompleted={handleCompleted}
        onRetry={handleRetry}
      />
    </div>
  );
}
