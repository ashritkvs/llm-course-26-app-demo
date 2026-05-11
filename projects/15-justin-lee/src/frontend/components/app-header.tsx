"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, Search, ChevronDown, PanelLeft, FolderOpenDot } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useAuthUser } from "@/lib/use-auth-user";

function getWorkspaceSectionLabel(pathname: string): string {
  if (pathname.includes("/generation-requests/")) {
    return "Generation Status";
  }

  if (pathname.includes("/generate")) {
    return "Generate";
  }

  if (pathname.includes("/insights")) {
    return "Insights";
  }

  if (pathname.includes("/exams/")) {
    return "Exam Viewer";
  }

  if (pathname.endsWith("/exams")) {
    return "Exams";
  }

  if (pathname.includes("/workspaces/")) {
    return "Materials";
  }

  return "Dashboard";
}

export function AppHeader({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, displayName, email, initials, avatarUrl } = useAuthUser();
  const [signingOut, setSigningOut] = useState(false);
  const activeWorkspaceMatch = pathname.match(/^\/dashboard\/workspaces\/([^/]+)/);
  const activeWorkspaceId = activeWorkspaceMatch?.[1] ?? null;
  const sectionLabel = getWorkspaceSectionLabel(pathname);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = getSupabaseClient();

    try {
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="md:hidden"
          onClick={onOpenSidebar}
          aria-label="Open navigation"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>

        <div className="min-w-0 shrink-0">
          {activeWorkspaceId ? (
            <div className="flex min-w-0 items-center gap-2">
              <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex">
                <FolderOpenDot className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Active Workspace
                </p>
                <p className="truncate text-sm font-medium text-foreground">
                  {sectionLabel} · {activeWorkspaceId}
                </p>
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Workspace Context
              </p>
              <p className="truncate text-sm font-medium text-foreground">
                Select a workspace to access materials and exams
              </p>
            </div>
          )}
        </div>

        <div className="relative hidden w-full max-w-md lg:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search workspaces and documents..."
            className="h-10 w-full rounded-lg border border-input bg-secondary/50 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative hidden sm:inline-flex">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
        </Button>

        {loading ? (
          <div className="flex items-center gap-2 px-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="hidden h-4 w-28 md:block" />
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={avatarUrl ?? undefined} alt={displayName ?? email ?? "User"} />
                  <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-40 truncate text-sm font-medium md:inline-block">
                  {displayName ?? email ?? "Account"}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span>{displayName ?? email ?? "Account"}</span>
                {email && (
                  <span className="text-xs font-normal text-muted-foreground">{email}</span>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                disabled={signingOut}
                onSelect={(event) => {
                  event.preventDefault();
                  void handleSignOut();
                }}
              >
                {signingOut ? "Signing out..." : "Sign out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
