"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  GraduationCap,
  ChevronRight,
  Sparkles,
  Wand2,
  FileText,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthUser } from "@/lib/use-auth-user";

const bottomNavigation = [
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function AppSidebar({
  mobile = false,
  onNavigate,
  className,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const { loading, displayName, email, initials, avatarUrl } = useAuthUser();
  const activeWorkspaceMatch = pathname.match(/^\/dashboard\/workspaces\/([^/]+)/);
  const activeWorkspaceId = activeWorkspaceMatch?.[1] ?? null;
  const workspaceHref = activeWorkspaceId ? `/dashboard/workspaces/${activeWorkspaceId}` : null;
  const workspaceInsightsHref = activeWorkspaceId
    ? `/dashboard/workspaces/${activeWorkspaceId}/insights`
    : null;
  const workspaceGenerateHref = activeWorkspaceId
    ? `/dashboard/workspaces/${activeWorkspaceId}/generate`
    : null;
  const workspaceExamsHref = activeWorkspaceId
    ? `/dashboard/workspaces/${activeWorkspaceId}/exams`
    : null;

  const navigation = [
    { name: "All Workspaces", href: "/dashboard", icon: LayoutDashboard },
    ...(workspaceHref
      ? [{ name: "Workspace Materials", href: workspaceHref, icon: FolderOpen }]
      : []),
    ...(workspaceInsightsHref
      ? [{ name: "Workspace Insights", href: workspaceInsightsHref, icon: Sparkles }]
      : []),
    ...(workspaceGenerateHref
      ? [{ name: "Generate", href: workspaceGenerateHref, icon: Wand2 }]
      : []),
    ...(workspaceExamsHref
      ? [{ name: "Exams", href: workspaceExamsHref, icon: FileText }]
      : []),
  ];

  const rootClassName = mobile
    ? "flex h-full w-full flex-col border-r border-border bg-sidebar"
    : "fixed left-0 top-0 z-40 h-screen w-64 flex-col border-r border-border bg-sidebar";

  return (
    <aside className={cn(rootClassName, className)}>
      <div className="flex h-full flex-col">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex h-16 items-center gap-2 border-b border-border px-6"
          onClick={onNavigate}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-foreground">ExamProfile</span>
          <span className="text-xs font-medium text-muted-foreground">AI</span>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className={cn(
                  "h-5 w-5 shrink-0 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} />
                <span className="flex-1">{item.name}</span>
                {isActive && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </Link>
            );
          })}

          {!activeWorkspaceId && (
            <div className="mx-2 mt-4 rounded-lg border border-dashed border-border bg-background/40 p-3">
              <p className="text-xs font-medium text-foreground">Workspace context</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Select a workspace to upload materials and review its documents.
              </p>
            </div>
          )}
        </nav>

        {/* Bottom Navigation */}
        <div className="border-t border-border px-3 py-4">
          {bottomNavigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* User Section */}
        <div className="border-t border-border p-4">
          {loading ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={avatarUrl ?? undefined} alt={displayName ?? email ?? "User"} />
                <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 truncate">
                <p className="truncate text-sm font-medium text-foreground">
                  {displayName ?? email ?? "Account"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {email ?? "No email available"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
