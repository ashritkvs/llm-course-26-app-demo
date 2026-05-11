"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getSupabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { GenerationForm } from "@/components/generation/GenerationForm";
import { LoadingState } from "@/components/ui/loading-state";

export default function GeneratePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const workspaceId = params.id;
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

  function handleCreated(requestId: string) {
    router.push(`/dashboard/workspaces/${workspaceId}/generation-requests/${requestId}`);
  }

  if (!authenticated) {
    return (
      <div className="p-4 md:p-6">
        <LoadingState
          title="Checking your workspace session..."
          description="Preparing the generation form."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-3">
        <Button variant="ghost" asChild className="w-fit px-0 hover:bg-transparent">
          <Link id="generate-back-to-workspace-link" href={`/dashboard/workspaces/${workspaceId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to workspace
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Generate</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Configure and generate a practice set or simulated exam based on your professor
            profile and indexed course materials.
          </p>
        </div>
      </div>

      <GenerationForm workspaceId={workspaceId} onCreated={handleCreated} />
    </div>
  );
}
