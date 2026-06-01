import { Fragment, useMemo } from "react";
import { AlertCircle, AlertTriangle, Send } from "lucide-react";
import { skillListEntryCanonicalId, type AgentId, type DriftStatus, type SkillListEntry } from "$lib/types";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import claudeIcon from "$lib/assets/claude.svg";
import codexIcon from "$lib/assets/codex.png";
import antigravityIcon from "$lib/assets/antigravity.png";

/** Brand icon per agent. Agents absent from this map fall back to their text
 *  identifier in the chip. `gemini` temporarily uses the antigravity icon —
 *  a follow-up change will replace gemini with antigravity wholesale. */
const AGENT_ICON: Partial<Record<AgentId, string>> = {
  anthropic: claudeIcon,
  codex: codexIcon,
  gemini: antigravityIcon,
};

interface Props {
  entries: SkillListEntry[];
  selectedName: string | null;
  onSelect: (canonicalId: string) => void;
  onPush: (canonicalId: string) => void;
  pushingNames?: Set<string>;
  driftMap?: Record<string, Record<string, DriftStatus>>;
}

type DriftMap = Record<string, Record<string, DriftStatus>>;

/** Whether any of this skill's targets has drifted (external edits on the
 *  agent side). Single source of truth for both grouping and the row icon. */
function isEntryDrifted(canonicalId: string, driftMap: DriftMap): boolean {
  const targets = driftMap[canonicalId];
  return !!targets && Object.values(targets).some((s) => s === "drifted");
}

/** Sort key: skills that need the user's attention float to the top —
 *  broken-frontmatter rows, dirty (unpushed) skills, freshly-created skills
 *  with NO targets configured yet (a "configure me" reminder, since a
 *  target-less skill is dirty=false and would otherwise sink into the
 *  alphabetical list), and skills with a drifted target. Everything else
 *  stays alphabetical. */
function sortRank(e: SkillListEntry, drifted: boolean): number {
  if (e.kind === "broken") return 0;
  if (e.skill.dirty) return 0;
  if (e.skill.targets.length === 0) return 0;
  if (drifted) return 0;
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
  driftMap = {},
}: Props) {
  const locale = useLocaleStore((s) => s.locale);

  const sortedEntries = useMemo(() => {
    const rankOf = (e: SkillListEntry) =>
      sortRank(e, isEntryDrifted(skillListEntryCanonicalId(e), driftMap));
    return [...entries].sort((a, b) => {
      const rank = rankOf(a) - rankOf(b);
      if (rank !== 0) return rank;
      return entryName(a).localeCompare(entryName(b));
    });
  }, [entries, driftMap]);

  if (entries.length === 0) {
    return (
      <div className="text-sm text-text-secondary px-3 py-6">
        {t(locale, "skills.list.empty")}
      </div>
    );
  }

  // Track group boundaries (sortRank: 0 = Action Required, 1 = All Skills) so
  // a non-interactive header li is emitted above the first item of each group.
  let prevRank = -1;

  return (
    <ul className="flex flex-col py-1">
      {sortedEntries.map((entry) => {
        const canonicalId = skillListEntryCanonicalId(entry);
        const drifted = isEntryDrifted(canonicalId, driftMap);
        const rank = sortRank(entry, drifted);
        const header =
          rank !== prevRank ? (
            <li
              key={`group-${rank}`}
              className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-secondary select-none"
            >
              {t(locale, rank === 0 ? "skills.list.groupActionRequired" : "skills.list.groupAllSkills")}
            </li>
          ) : null;
        prevRank = rank;

        if (entry.kind === "broken") {
          const isSelected = selectedName === canonicalId;
          return (
            <Fragment key={`broken-${canonicalId}`}>
              {header}
              <li>
                <button
                  type="button"
                  onClick={() => onSelect(canonicalId)}
                  title={entry.error}
                  className={`w-full flex items-start gap-2 mx-2 rounded-md px-3 py-2 text-left transition-colors ${
                    isSelected ? "bg-danger-dim" : "bg-danger/5 hover:bg-danger-dim"
                  }`}
                >
                  <AlertCircle className="text-danger shrink-0 mt-0.5" size={16} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-text-primary truncate">
                      {entry.name}
                    </div>
                    <div className="hidden @[200px]:block text-xs text-danger truncate">
                      {t(locale, "skills.list.frontmatterBroken")}
                    </div>
                    <div className="hidden @[200px]:block text-[10px] text-text-secondary truncate font-mono">
                      {entry.path}
                    </div>
                  </div>
                </button>
              </li>
            </Fragment>
          );
        }

        const { skill } = entry;
        const isSelected = selectedName === canonicalId;
        const isPushing = pushingNames.has(canonicalId);
        const chips = [...new Set(skill.targets.map((tgt) => tgt.agent))];

        return (
          <Fragment key={canonicalId}>
            {header}
            <li>
              <button
                type="button"
                onClick={() => onSelect(canonicalId)}
                className={`group w-full flex items-center gap-2 mx-2 rounded-md px-3 py-2 text-left transition-colors ${
                  isSelected ? "bg-bg-secondary" : "hover:bg-bg-secondary/50"
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
                  <div className="hidden @[200px]:block text-xs text-text-secondary truncate">
                    {skill.description || <span className="italic">{t(locale, "skills.list.noDescription")}</span>}
                  </div>
                  {chips.length > 0 && (
                    <div className="hidden @[200px]:flex mt-1 gap-1 flex-wrap items-center">
                      {chips.map((chip) => {
                        const icon = AGENT_ICON[chip];
                        return icon ? (
                          <img
                            key={chip}
                            src={icon}
                            alt={chip}
                            title={chip}
                            className="w-4 h-4 rounded-sm object-contain"
                          />
                        ) : (
                          <span
                            key={chip}
                            className="text-[10px] tracking-wide px-1.5 py-0.5 rounded bg-accent/10 text-accent"
                          >
                            {chip}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                {drifted && (
                  <span className="hidden @[200px]:inline" title={t(locale, "skills.list.drifted")}>
                    <AlertTriangle size={14} className="shrink-0 text-warning" />
                  </span>
                )}
                <button
                  type="button"
                  disabled={isPushing}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPush(canonicalId);
                  }}
                  className={`hidden @[200px]:inline-flex shrink-0 items-center gap-1 text-xs px-2 py-1 rounded transition ${
                    skill.dirty || isPushing ? "" : "opacity-0 group-hover:opacity-100"
                  } ${
                    isPushing
                      ? "text-text-secondary opacity-50 cursor-wait"
                      : "bg-accent text-white hover:bg-accent-hover"
                  }`}
                  title={t(locale, "skills.list.pushTitle")}
                >
                  <Send size={12} />
                  {isPushing ? t(locale, "skills.list.pushing") : t(locale, "skills.list.push")}
                </button>
              </button>
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}
