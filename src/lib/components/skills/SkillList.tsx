import { useMemo } from "react";
import { AlertCircle, Send } from "lucide-react";
import { skillListEntryCanonicalId, type SkillListEntry } from "$lib/types";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";

interface Props {
  entries: SkillListEntry[];
  selectedName: string | null;
  onSelect: (canonicalId: string) => void;
  onPush: (canonicalId: string) => void;
  pushingNames?: Set<string>;
}

/** Sort key: skills that need the user's attention float to the top —
 *  broken-frontmatter rows, dirty (unpushed) skills, and freshly-created
 *  skills with NO targets configured yet (a "configure me" reminder, since
 *  a target-less skill is dirty=false and would otherwise sink into the
 *  alphabetical list). Everything else stays alphabetical. */
function sortRank(e: SkillListEntry): number {
  if (e.kind === "broken") return 0;
  if (e.skill.dirty) return 0;
  if (e.skill.targets.length === 0) return 0;
  return 1;
}

function entryName(e: SkillListEntry): string {
  return e.kind === "ok" ? e.skill.name : e.name;
}

/**
 * Skill list — one row per canonical skill, dirty dot + per-skill Push.
 * Broken-frontmatter rows render as a non-selectable warning row so the
 * user can still see what's there and jump to the raw file to fix it.
 *
 * The scope toggle lives in SkillsPage (not here) so this component stays
 * a pure presenter of the current scope's entries.
 */
export default function SkillList({
  entries,
  selectedName,
  onSelect,
  onPush,
  pushingNames = new Set(),
}: Props) {
  const locale = useLocaleStore((s) => s.locale);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const rank = sortRank(a) - sortRank(b);
      if (rank !== 0) return rank;
      return entryName(a).localeCompare(entryName(b));
    });
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="text-sm text-text-secondary px-3 py-6">
        {t(locale, "skills.list.empty")}
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {sortedEntries.map((entry) => {
        const canonicalId = skillListEntryCanonicalId(entry);
        if (entry.kind === "broken") {
          const isSelected = selectedName === canonicalId;
          return (
            <li key={`broken-${canonicalId}`}>
              <button
                type="button"
                onClick={() => onSelect(canonicalId)}
                title={entry.error}
                className={`w-full flex items-start gap-2 px-3 py-2 text-left border-l-2 transition-colors ${
                  isSelected
                    ? "border-danger bg-danger-dim"
                    : "border-danger/60 bg-danger/5 hover:bg-danger-dim"
                }`}
              >
                <AlertCircle className="text-danger shrink-0 mt-0.5" size={16} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text-primary truncate">
                    {entry.name}
                  </div>
                  <div className="text-xs text-danger truncate">
                    {t(locale, "skills.list.frontmatterBroken")}
                  </div>
                  <div className="text-[10px] text-text-secondary truncate font-mono">
                    {entry.path}
                  </div>
                </div>
              </button>
            </li>
          );
        }

        const { skill } = entry;
        const isSelected = selectedName === canonicalId;
        const isPushing = pushingNames.has(canonicalId);

        return (
          <li key={canonicalId}>
            <button
              type="button"
              onClick={() => onSelect(canonicalId)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left border-l-2 transition-colors ${
                isSelected
                  ? "border-accent bg-accent/10"
                  : "border-transparent hover:bg-accent/5"
              }`}
            >
              {/* Dirty dot: visible only when the skill has pending changes */}
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  skill.dirty ? "bg-danger" : "bg-transparent"
                }`}
                aria-label={skill.dirty ? t(locale, "skills.list.hasUnpushed") : undefined}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-text-primary truncate">
                  {skill.name}
                </div>
                <div className="text-xs text-text-secondary truncate">
                  {skill.description || <span className="italic">{t(locale, "skills.list.noDescription")}</span>}
                </div>
                {skill.targets.length > 0 && (
                  <div className="mt-1 flex gap-1 flex-wrap">
                    {[...new Set(skill.targets.map((tgt) => tgt.agent))].map((a) => (
                      <span
                        key={a}
                        className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent/10 text-accent"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {(skill.dirty || isPushing) && (
                <button
                  type="button"
                  disabled={isPushing}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPush(canonicalId);
                  }}
                  className={`shrink-0 inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                    isPushing
                      ? "text-text-secondary opacity-50 cursor-wait"
                      : "bg-accent text-white hover:bg-accent-hover"
                  }`}
                  title={t(locale, "skills.list.pushTitle")}
                >
                  <Send size={12} />
                  {isPushing ? t(locale, "skills.list.pushing") : t(locale, "skills.list.push")}
                </button>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
