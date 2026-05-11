"use client";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function LoadingState({
  title = "Loading...",
  description,
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border/70 bg-card/40 px-6 py-12 text-center",
        className,
      )}
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <div className="space-y-1">
        <p className="text-base font-medium text-foreground">{title}</p>
        {description ? (
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
