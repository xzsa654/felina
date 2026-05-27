import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { useSkillsStore } from "$lib/stores/skills-store";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import { api } from "$lib/tauri/commands";
import SyncPreviewDialog from "./SyncPreviewDialog";
import type { SkillSyncPreview, SkillSyncResolution } from "$lib/types";

/**
 * Banner at the top of the Skills page that summarises how many canonical
 * skills have unpushed changes and offers a single "Push all" action.
 * Hidden when nothing is dirty (decision 5).
 *
 * Lives in normal flow (not sticky) inside the page's fixed header region,
 * so it never overlaps the scrolling list/editor columns below it.
 */
export default function PendingPushBar() {
  const locale = useLocaleStore((s) => s.locale);
  const entries = useSkillsStore((s) => s.entries);
  const loadEntries = useSkillsStore((s) => s.loadEntries);
  const [pushing, setPushing] = useState(false);
  const [preview, setPreview] = useState<SkillSyncPreview[] | null>(null);

  const dirtyCount = useMemo(
    () => entries.filter((e) => e.kind === "ok" && e.skill.dirty && e.skill.targets.length > 0).length,
    [entries],
  );

  if (dirtyCount === 0) {
    return null;
  }

  const label =
    dirtyCount === 1
      ? t(locale, "skills.pendingPush.changedSingle")
      : t(locale, "skills.pendingPush.changed", { n: dirtyCount });

  return (
    <div
      role="status"
      className="mb-4 px-4 py-2.5 rounded border border-warning/30 bg-warning-dim flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2 text-sm text-warning">
        <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
        {label}
      </div>
      <button
        type="button"
        disabled={pushing}
        onClick={async () => {
          setPushing(true);
          try {
            const next = await api.skillSync.previewAll();
            setPreview(next.skills);
          } finally {
            setPushing(false);
          }
        }}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
      >
        <Send size={12} />
        {pushing ? t(locale, "skills.pendingPush.pushing") : t(locale, "skills.pendingPush.pushAll")}
      </button>
      <SyncPreviewDialog
        open={preview !== null}
        previews={preview ?? []}
        busy={pushing}
        oncancel={() => setPreview(null)}
        onconfirm={async (resolutionsBySkill: Record<string, SkillSyncResolution[]>) => {
          setPushing(true);
          try {
            await api.skillSync.commitAll({ resolutionsBySkill });
            await loadEntries();
            setPreview(null);
          } finally {
            setPushing(false);
          }
        }}
      />
    </div>
  );
}
