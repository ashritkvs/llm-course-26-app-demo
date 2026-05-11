"use client";

import type React from "react";

import { Badge } from "@/components/ui/badge";
import type { DocumentProcessingStatus } from "@/lib/apiClient";

export function DocumentStatusBadge({ status }: { status: DocumentProcessingStatus }) {
  const variant: React.ComponentProps<typeof Badge>["variant"] =
    status === "ready" || status === "indexed"
      ? "default"
      : status === "failed"
        ? "destructive"
        : status === "parsed"
          ? "secondary"
          : "outline";

  return <Badge variant={variant}>{status}</Badge>;
}
