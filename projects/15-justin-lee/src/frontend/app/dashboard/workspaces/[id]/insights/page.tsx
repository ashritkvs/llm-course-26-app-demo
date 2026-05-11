"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles, TriangleAlert } from "lucide-react";

import {
  apiClient,
  ApiError,
  type ProfessorProfile,
  type Workspace,
} from "@/lib/apiClient";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { ProfileInsightsDashboard } from "@/components/profile-insights/ProfileInsightsDashboard";
import { ProfileInsightsSkeleton } from "@/components/profile-insights/ProfileInsightsSkeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage, isUnauthorizedError } from "@/lib/errorMessages";

export default function WorkspaceInsightsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const workspaceId = params.id;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [profile, setProfile] = useState<ProfessorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileMissing, setProfileMissing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  async function loadInsights(): Promise<void> {
    setLoading(true);
    setLoadError(null);

    try {
      const workspacePromise = apiClient.getWorkspace(workspaceId);
      const profilePromise = apiClient
        .getProfessorProfile(workspaceId)
        .then((value) => ({ value }))
        .catch((error: unknown) => ({ error }));

      const [nextWorkspace, nextProfileResult] = await Promise.all([
        workspacePromise,
        profilePromise,
      ]);

      setWorkspace(nextWorkspace);

      if ("value" in nextProfileResult) {
        setProfile(nextProfileResult.value);
        setProfileMissing(false);
        return;
      }

      if (nextProfileResult.error instanceof ApiError && nextProfileResult.error.status === 404) {
        setProfile(null);
        setProfileMissing(true);
        return;
      }

      throw nextProfileResult.error;
    } catch (error) {
      console.error("Failed to load workspace insights", error);
      const message =
        error instanceof ApiError && error.status === 404
          ? "No profile has been generated for this workspace yet."
          : getErrorMessage(error);
      setLoadError(
        message,
      );
      toast({
        variant: "destructive",
        title: "Unable to load insights",
        description: message,
      });
      if (isUnauthorizedError(error)) {
        router.replace("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateProfile(): Promise<void> {
    setActionError(null);
    setIsGenerating(true);

    try {
      const nextProfile = await apiClient.generateProfessorProfile(workspaceId);
      setProfile(nextProfile);
      setProfileMissing(false);
    } catch (error) {
      console.error("Failed to generate professor profile", error);
      const message = getErrorMessage(error);
      setActionError(message);
      toast({
        variant: "destructive",
        title: "Profile generation failed",
        description: message,
      });
      if (isUnauthorizedError(error)) {
        router.replace("/login");
      }
    } finally {
      setIsGenerating(false);
    }
  }

  useEffect(() => {
    const supabase = getSupabaseClient();
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) {
        return;
      }

      if (!data.session) {
        router.replace("/login");
        return;
      }

      void loadInsights();
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, workspaceId]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Button variant="ghost" asChild className="w-fit px-0 hover:bg-transparent">
            <Link id="workspace-materials-link" href={`/dashboard/workspaces/${workspaceId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to workspace materials
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Insights</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Review the live professor profile for this workspace and see what the backend expects
              on your next exam.
            </p>
          </div>
        </div>

        <Button
          id="generate-or-update-profile-button"
          onClick={() => void handleGenerateProfile()}
          disabled={loading || isGenerating}
          className="w-full sm:min-w-[220px] sm:w-auto"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating profile...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              {profile ? "Generate or Update Profile" : "Generate Profile"}
            </>
          )}
        </Button>
      </div>

      {isGenerating ? (
        <Alert className="border-primary/20 bg-primary/5">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <AlertTitle>Gemini 1.5 Flash is processing your profile</AlertTitle>
          <AlertDescription>
            The backend is retrieving indexed evidence and rebuilding the latest professor profile
            for this workspace.
          </AlertDescription>
        </Alert>
      ) : null}

      {actionError ? (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Profile generation failed</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? <ProfileInsightsSkeleton /> : null}

      {!loading && loadError ? (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col gap-4 px-6 py-8">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Unable to load insights</h2>
              <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
            </div>
            <Button
              id="retry-load-insights-button"
              variant="outline"
              className="w-fit"
              onClick={() => void loadInsights()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!loading && !loadError && workspace && profile ? (
        <ProfileInsightsDashboard
          profile={profile}
          workspaceTitle={workspace.title}
          courseCode={workspace.course_code}
        />
      ) : null}

      {!loading && !loadError && workspace && profileMissing ? (
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
          <CardContent className="px-6 py-10">
            <div className="max-w-2xl space-y-4">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
                No profile yet
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                Generate the first insight dashboard for {workspace.title}
              </h2>
              <p className="text-sm leading-7 text-muted-foreground">
                Once your uploaded materials have been indexed, the backend can retrieve evidence
                and create a live professor profile showing likely topics, question formats,
                difficulty, and exam structure.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  id="empty-state-generate-profile-button"
                  onClick={() => void handleGenerateProfile()}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating profile...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Profile
                    </>
                  )}
                </Button>
                <Button variant="outline" asChild>
                  <Link
                    id="empty-state-workspace-materials-link"
                    href={`/dashboard/workspaces/${workspaceId}`}
                  >
                    Review workspace materials
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
