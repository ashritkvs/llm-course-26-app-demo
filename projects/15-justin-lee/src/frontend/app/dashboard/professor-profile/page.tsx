"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FolderSearch, Sparkles } from "lucide-react";

import { apiClient, type Workspace } from "@/lib/apiClient";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage, isUnauthorizedError } from "@/lib/errorMessages";

export default function ProfessorProfilePage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadWorkspaces(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const nextWorkspaces = await apiClient.listWorkspaces();
      setWorkspaces(nextWorkspaces);
    } catch (err) {
      console.error("Failed to load workspaces for professor profile hub", err);
      const message = getErrorMessage(err);
      setError(message);
      toast({
        variant: "destructive",
        title: "Unable to load workspaces",
        description: message,
      });
      if (isUnauthorizedError(err)) {
        router.replace("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }

      void loadWorkspaces();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardContent className="px-6 py-8">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
              Professor Profile
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Choose a workspace to view its insight dashboard
            </h1>
            <p className="text-sm leading-7 text-muted-foreground">
              Each workspace has its own retrieved evidence and generated professor profile.
              Open a workspace-specific insights page to see likely topics, question mix,
              difficulty signals, and exam structure.
            </p>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && error ? (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col gap-4 px-6 py-8">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              id="retry-professor-profile-directory-button"
              variant="outline"
              className="w-fit"
              onClick={() => void loadWorkspaces()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!loading && !error && workspaces.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-10">
            <div className="max-w-xl space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <FolderSearch className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">No workspaces yet</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Create a workspace and upload course materials before generating a professor
                  profile.
                </p>
              </div>
              <Button asChild>
                <Link id="go-to-workspaces-button" href="/dashboard">
                  Go to workspaces
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!loading && !error && workspaces.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((workspace) => (
            <Card
              key={workspace.id}
              className="border-border/70 transition-colors hover:border-primary/30"
            >
              <CardHeader>
                <CardTitle>{workspace.title}</CardTitle>
                <CardDescription>
                  {workspace.course_code ?? "No course code"}
                  {workspace.description ? ` · ${workspace.description}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                  {workspace.profile_status ?? "Profile ready when generated"}
                </div>
                <Button asChild>
                  <Link
                    id={`workspace-insights-link-${workspace.id}`}
                    href={`/dashboard/workspaces/${workspace.id}/insights`}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Open insights
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
