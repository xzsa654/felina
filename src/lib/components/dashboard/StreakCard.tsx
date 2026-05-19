import { Flame } from "lucide-react";
import { timeAgo } from "$lib/utils/format";

interface Props {
  current: number;
  longest: number;
  lastActiveDate: string;
}

export default function StreakCard({ current, longest, lastActiveDate }: Props) {
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-text-secondary mb-3">Streak</h3>
      <div className="flex items-baseline gap-2">
        {current > 0 && <Flame size={24} className="text-accent" />}
        <p className="text-4xl font-bold text-accent">{current}</p>
        <p className="text-sm text-text-muted">day{current !== 1 ? "s" : ""}</p>
      </div>
      <div className="mt-2 space-y-1">
        <p className="text-xs text-text-muted">
          Longest: <span className="text-text-secondary">{longest} day{longest !== 1 ? "s" : ""}</span>
        </p>
        {lastActiveDate && (
          <p className="text-xs text-text-muted">
            Last active: <span className="text-text-secondary">{timeAgo(lastActiveDate)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
