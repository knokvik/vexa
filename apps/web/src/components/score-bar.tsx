"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function ScoreBar({
  label,
  value,
  tone = "primary",
}: {
  label: string;
  value: number;
  tone?: "primary" | "success" | "warning" | "destructive";
}) {
  const pct = Math.max(0, Math.min(100, value));
  const indicator = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
  }[tone];

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono text-foreground">{Math.round(pct)}</span>
      </div>
      <Progress
        value={pct}
        className="h-1.5"
        indicatorClassName={cn(indicator)}
      />
    </div>
  );
}
