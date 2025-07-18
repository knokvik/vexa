export function ScoreBar({
  label,
  value,
  tone = "accent",
}: {
  label: string;
  value: number;
  tone?: "accent" | "mint" | "warn" | "danger";
}) {
  const colors = {
    accent: "bg-accent",
    mint: "bg-mint",
    warn: "bg-warn",
    danger: "bg-danger",
  };
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span className="font-mono text-zinc-200">{Math.round(pct)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full ${colors[tone]} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
