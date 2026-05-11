"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";

import { apiClient, type Workspace } from "@/lib/apiClient";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { CreateWorkspaceDialog } from "@/components/workspace/CreateWorkspaceDialog";
import { WorkspaceCard } from "@/components/workspace/WorkspaceCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function DashboardPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.listWorkspaces();
      setWorkspaces(data);
    } catch (err) {
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
      if (!data.session) router.replace("/login");
      else refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Workspaces</h1>
          <p className="text-muted-foreground">
            Create a workspace per course or exam-prep context.
          </p>
        </div>
        <CreateWorkspaceDialog onCreated={refresh} />
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="p-4">
              <div className="space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-28" />
              </div>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col gap-4 px-6 py-8">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Unable to load workspaces</h2>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" className="w-fit" onClick={() => void refresh()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : workspaces.length === 0 ? (
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
          <CardContent className="px-6 py-10">
            <Empty className="border-none p-0 md:p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderPlus className="h-5 w-5" />
                </EmptyMedia>
                <EmptyTitle>No workspaces yet</EmptyTitle>
                <EmptyDescription>
                  Create your first workspace to get started.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <CreateWorkspaceDialog onCreated={refresh} />
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((w) => (
            <WorkspaceCard key={w.id} workspace={w} onDeleted={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
