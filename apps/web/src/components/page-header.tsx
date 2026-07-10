import { cn } from "@/lib/utils";

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
        "flex flex-col justify-between gap-4 md:flex-row md:items-end",
        className
      )}
    >
      <div className="space-y-1.5">
        {eyebrow && (
          <p className="text-sm font-medium text-primary">{eyebrow}</p>
        )}
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
