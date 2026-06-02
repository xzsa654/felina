import { Fragment, useMemo } from "react";
import { AlertCircle, AlertTriangle, Folder, Globe, Search, Send, X } from "lucide-react";
import {
  skillListEntryCanonicalId,
  type AgentId,
  type DriftStatus,
  type SkillListEntry,
  type SkillTarget,
} from "$lib/types";
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
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

type DriftMap = Record<string, Record<string, DriftStatus>>;

/** Whether any of this skill's targets has drifted (external edits on the
 *  agent side). Single source of truth for both grouping and the row icon. */
function isEntryDrifted(canonicalId: string, driftMap: DriftMap): boolean {
  const targets = driftMap[canonicalId];
  return !!targets && Object.values(targets).some((s) => s === "drifted");
}

/**
 * Sort rank: 0 = needs attention (broken / drifted), 1 = needs push (dirty),
 * 2 = not configured (zero targets), 3 = ready. Order is intentional so that
 * "needs attention" wins over "dirty" and "no-target" when multiple flags
 * apply to the same skill.
 */
export function sortRank(e: SkillListEntry, drifted: boolean): 0 | 1 | 2 | 3 {
  if (e.kind === "broken") return 0;
  if (drifted) return 0;
  if (e.skill.dirty) return 1;
  if (!e.skill.targets.some((t) => t.enabled)) return 2;
  return 3;
}

const GROUP_KEY = {
  0: "skills.list.groupNeedsAttention",
  1: "skills.list.groupNeedsPush",
  2: "skills.list.groupNotConfigured",
  3: "skills.list.groupReady",
} as const;

function entryName(e: SkillListEntry): string {
  return e.kind === "ok" ? e.skill.name : e.name;
}

function entryDescription(e: SkillListEntry): string {
  return e.kind === "ok" ? e.skill.description : "";
}

/**
 * Per-agent scope aggregation: for each agent with at least one enabled,
 * tracked/manual/auto target, record whether the skill has any global and/or
 * project target for that agent. Disabled / detached / forked targets are
 * excluded — they should not advertise a scope marker.
 */
export function agentScopeMap(
  targets: SkillTarget[],
): Map<AgentId, { global: boolean; project: boolean }> {
  const map = new Map<AgentId, { global: boolean; project: boolean }>();
  for (const t of targets) {
    if (!t.enabled) continue;
    if (t.mode === "detached" || t.mode === "forked") continue;
    const cur = map.get(t.agent) ?? { global: false, project: false };
    if (t.scope === "global") cur.global = true;
    else cur.project = true;
    map.set(t.agent, cur);
  }
  return map;
}

/** Case-insensitive substring match against name + description. Empty query
 *  short-circuits to the original array reference for cheap identity checks. */
export function filterEntriesByQuery(
  entries: SkillListEntry[],
  query: string,
): SkillListEntry[] {
  const q = query.trim().toLowerCase();
  if (q === "") return entries;
  return entries.filter((e) => {
    const hay = `${entryName(e)}\n${entryDescription(e)}`.toLowerCase();
    return hay.includes(q);
  });
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
  searchQuery,
  onSearchChange,
}: Props) {
  const locale = useLocaleStore((s) => s.locale);

  const sortedEntries = useMemo(() => {
    const filtered = filterEntriesByQuery(entries, searchQuery);
    const rankOf = (e: SkillListEntry) =>
      sortRank(e, isEntryDrifted(skillListEntryCanonicalId(e), driftMap));
    return [...filtered].sort((a, b) => {
      const rank = rankOf(a) - rankOf(b);
      if (rank !== 0) return rank;
      return entryName(a).localeCompare(entryName(b));
    });
  }, [entries, driftMap, searchQuery]);

  const searchInput = (
    <div className="flex items-center gap-2 px-4 pt-3 pb-2">
      <Search size={14} className="text-text-muted shrink-0" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={t(locale, "skills.list.searchPlaceholder")}
        className="flex-1 bg-transparent border-0 outline-none text-sm text-text-primary placeholder:text-text-muted focus:bg-bg-secondary/40 rounded px-1 py-0.5 transition-colors"
      />
      {searchQuery !== "" && (
        <button
          type="button"
          onClick={() => onSearchChange("")}
          aria-label={t(locale, "skills.list.searchClear")}
          title={t(locale, "skills.list.searchClear")}
          className="shrink-0 text-text-muted hover:text-text-primary transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );

  if (entries.length === 0) {
    return (
      <div>
        {searchInput}
        <div className="text-sm text-text-secondary px-3 py-6">
          {t(locale, "skills.list.empty")}
        </div>
      </div>
    );
  }

  if (sortedEntries.length === 0) {
    return (
      <div>
        {searchInput}
        <div className="text-sm text-text-secondary px-3 py-6">
          {t(locale, "skills.list.empty")}
        </div>
      </div>
    );
  }

  let prevRank: number = -1;

  return (
    <div>
      {searchInput}
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
                {t(locale, GROUP_KEY[rank])}
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
          const scopeMap = agentScopeMap(skill.targets);

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
                    {scopeMap.size > 0 && (
                      <div className="hidden @[200px]:flex mt-1 gap-2 flex-wrap items-center">
                        {[...scopeMap.entries()].map(([agent, scope]) => {
                          const icon = AGENT_ICON[agent];
                          return (
                            <span key={agent} className="inline-flex items-center gap-0.5">
                              {icon ? (
                                <img
                                  src={icon}
                                  alt={agent}
                                  title={agent}
                                  className="w-4 h-4 rounded-sm object-contain"
                                />
                              ) : (
                                <span className="text-[10px] tracking-wide px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                                  {agent}
                                </span>
                              )}
                              {scope.global && (
                                <Globe size={12} className="text-text-muted shrink-0" />
                              )}
                              {scope.project && (
                                <Folder size={12} className="text-text-muted shrink-0" />
                              )}
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
    </div>
  );
}
