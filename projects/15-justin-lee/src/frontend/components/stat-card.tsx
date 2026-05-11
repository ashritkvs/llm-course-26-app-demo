"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "stable";
  trendValue?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/30",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            {icon}
          </div>
        )}
      </div>
      {trend && trendValue && (
        <div className="mt-4 flex items-center gap-1.5">
          {trend === "up" && (
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          )}
          {trend === "down" && (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          {trend === "stable" && (
            <Minus className="h-4 w-4 text-muted-foreground" />
          )}
          <span
            className={cn(
              "text-sm font-medium",
              trend === "up" && "text-emerald-500",
              trend === "down" && "text-red-500",
              trend === "stable" && "text-muted-foreground"
            )}
          >
            {trendValue}
          </span>
          <span className="text-sm text-muted-foreground">vs last week</span>
        </div>
      )}
    </div>
  );
}
