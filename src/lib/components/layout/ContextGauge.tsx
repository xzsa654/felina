interface Props {
  used: number;
  max: number;
  label?: string;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export default function ContextGauge({ used, max, label = "Context" }: Props) {
  const pct = Math.min((used / max) * 100, 100);
  const color =
    pct > 90 ? "bg-danger" : pct > 70 ? "bg-warning" : pct > 50 ? "bg-info" : "bg-success";
  const textColor =
    pct > 90 ? "text-danger" : pct > 70 ? "text-warning" : "text-text-secondary";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-text-muted">{label}</span>
        <span className={textColor}>
          {formatTokens(used)} / {formatTokens(max)}
        </span>
      </div>
      <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {pct > 80 && (
        <p className={`text-[9px] ${textColor}`}>
          {pct > 90 ? "Context nearly full — compaction imminent" : "Context filling up"}
        </p>
      )}
    </div>
  );
}
