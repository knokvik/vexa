import { cn } from "@/lib/utils";

/**
 * Page title row — matches title-bar pill style (rounded, muted track for actions).
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-3 sm:gap-4 md:flex-row md:items-center",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center gap-1.5 rounded-full bg-muted/60 p-1 sm:w-auto [&>a]:rounded-full [&>button]:rounded-full">
          {actions}
        </div>
      )}
    </div>
  );
}
