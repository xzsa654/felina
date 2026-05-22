import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { useSkillsStore } from "$lib/stores/skills-store";

/**
 * Banner at the top of the Skills page that summarises how many canonical
 * skills have unpushed changes and offers a single "Push all" action.
 * Hidden when nothing is dirty (decision 5).
 *
 * Lives in normal flow (not sticky) inside the page's fixed header region,
 * so it never overlaps the scrolling list/editor columns below it.
 */
export default function PendingPushBar() {
  const entries = useSkillsStore((s) => s.entries);
  const syncAll = useSkillsStore((s) => s.syncAll);
  const [pushing, setPushing] = useState(false);

  const dirtyCount = useMemo(
    () => entries.filter((e) => e.kind === "ok" && e.skill.dirty).length,
    [entries],
  );

  if (dirtyCount === 0) {
    return null;
  }

  const label =
    dirtyCount === 1 ? "1 skill changed since last sync" : `${dirtyCount} skills changed since last sync`;

  return (
    <div
      role="status"
      className="mb-4 px-4 py-2.5 rounded border border-amber-500/30 bg-amber-500/10 flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2 text-sm text-amber-200">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        {label}
      </div>
      <button
        type="button"
        disabled={pushing}
        onClick={async () => {
          setPushing(true);
          try {
            await syncAll();
          } finally {
            setPushing(false);
          }
        }}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
      >
        <Send size={12} />
        {pushing ? "Pushing…" : "Push all"}
      </button>
    </div>
  );
}
