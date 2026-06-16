import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Crown, Medal } from "lucide-react";
import Prism from "./Prism";
import Silk from "./Silk";
import LightRays from "./LightRays";
import BorderGlow from "./BorderGlow";
import ElectricBorder from "./ElectricBorder";
import StarBorder from "./StarBorder";
import { api } from "$lib/tauri/commands";
import { t } from "$lib/i18n";
import type { Locale } from "$lib/i18n";
import { formatNumber, formatCost } from "$lib/utils/format";
import {
  StatCard,
  ActionButton,
  EmptyState,
  LoadingLine,
  glassListSurfaceClass,
  glassListRowClass,
  glassListSelectedRowClass,
} from "$lib/components/shared/PageScaffold";
import Modal from "$lib/components/shared/Modal";
import ErrorNotice from "$lib/components/shared/ErrorNotice";
import LoginDialog from "$lib/components/hub/LoginDialog";
import ContributionGraph from "$lib/components/tokens/components/ContributionGraph";
import type { LeaderboardSort, LeaderboardEntry, TokenBucket } from "$lib/types";
import {
  useLeaderboard,
  useLeaderboardGraph,
  useLeaderboardModels,
  useSubmitLeaderboard,
  useRemoveLeaderboardEntry,
} from "./hooks/useLeaderboardQueries";

const HANDLE_PATTERN = /^[A-Za-z0-9_-]{2,32}$/;
const SORTS: LeaderboardSort[] = ["tokens", "cost", "active_days"];

const NOOP_DAY = () => {};

interface Tone {
  card: string;
  label: string;
  value: string;
  primary: string;
  secondary: string;
  muted: string;
  /** Optional contribution-calendar palette override (0=empty … 4=high). */
  levels?: readonly string[];
}

// Per-rank styling for the expanded panel. #1 sits on a bright Prism, so it uses
// a light frosted card with dark text; #2/#3 use dark glass with light text; the
// rest follow the theme system.
function toneFor(rank: number): Tone {
  if (rank === 1) {
    return {
      card: "border border-amber-300/40 bg-gradient-to-br from-amber-100/85 via-amber-50/75 to-yellow-200/75 backdrop-blur-md",
      label: "text-amber-700/80",
      value: "text-neutral-900",
      primary: "text-neutral-900",
      secondary: "text-neutral-700",
      muted: "text-amber-700/70",
      // Amber/gold dots to match the #1 gradient instead of the default green.
      levels: ["bg-amber-900/10", "bg-amber-300", "bg-amber-500", "bg-amber-600", "bg-amber-800"],
    };
  }
  if (rank === 2) {
    // #655999 violet scheme over the Silk background.
    return {
      card: "border border-violet-300/25 bg-violet-500/10 backdrop-blur-md",
      label: "text-violet-200/75",
      value: "text-white",
      primary: "text-white",
      secondary: "text-violet-100/90",
      muted: "text-violet-200/60",
      levels: ["bg-white/5", "bg-violet-800", "bg-violet-600", "bg-violet-400", "bg-violet-300"],
    };
  }
  if (rank === 3) {
    // White scheme over the LightRays background.
    return {
      card: "border border-white/20 bg-white/10 backdrop-blur-md",
      label: "text-white/70",
      value: "text-white",
      primary: "text-white",
      secondary: "text-white/90",
      muted: "text-white/60",
      levels: ["bg-white/5", "bg-white/25", "bg-white/45", "bg-white/70", "bg-white"],
    };
  }
  if (rank <= 3) {
    return {
      card: "border border-white/15 bg-white/10 backdrop-blur-md",
      label: "text-white/60",
      value: "text-white",
      primary: "text-white",
      secondary: "text-white/90",
      muted: "text-white/50",
    };
  }
  return {
    card: "border border-border bg-bg-secondary",
    label: "text-text-muted",
    value: "text-text-primary",
    primary: "text-text-primary",
    secondary: "text-text-secondary",
    muted: "text-text-muted",
  };
}

function StatTile({ label, value, tone }: { label: string; value: ReactNode; tone: Tone }) {
  return (
    <div className={`rounded-lg p-4 ${tone.card}`}>
      <p className={`mb-2 text-[10px] uppercase tracking-wider ${tone.label}`}>{label}</p>
      <p className={`text-2xl font-semibold ${tone.value}`}>{value}</p>
    </div>
  );
}

const MODEL_PREVIEW_COUNT = 5;

function ModelBreakdown({
  handle,
  locale,
  tone,
  themed,
}: {
  handle: string;
  locale: Locale;
  tone: Tone;
  themed: boolean;
}) {
  const { data, isLoading } = useLeaderboardModels(handle);
  const [showAll, setShowAll] = useState(false);
  const models = data ?? [];
  const visible = showAll ? models : models.slice(0, MODEL_PREVIEW_COUNT);
  const hiddenCount = models.length - visible.length;

  const titleC = tone.label;
  const mutedC = tone.muted;
  const primaryC = tone.primary;
  const secondaryC = tone.secondary;
  // Themed (rank 4+) keeps the existing glass list surface; top-3 uses the tone card.
  const surface = themed ? glassListSurfaceClass : tone.card;

  return (
    <div className={`rounded-lg p-1 ${surface}`}>
      <p className={`px-3 pb-1 pt-1.5 text-[10px] uppercase tracking-wider ${titleC}`}>
        {t(locale, "leaderboard.models.title")}
      </p>
      {isLoading ? (
        <p className={`px-3 pb-1.5 text-xs ${mutedC}`}>{t(locale, "leaderboard.graph.loading")}</p>
      ) : models.length === 0 ? (
        <p className={`px-3 pb-1.5 text-xs ${mutedC}`}>{t(locale, "leaderboard.models.empty")}</p>
      ) : (
        <>
          {visible.map((m) => (
            <div
              key={m.model}
              className="grid grid-cols-[1fr_6rem_5rem] items-center gap-2 px-3 py-1.5 text-xs"
            >
              <span className={`truncate ${primaryC}`} title={m.model}>
                {m.model}
                {m.provider && <span className={`ml-1.5 ${mutedC}`}>{m.provider}</span>}
              </span>
              <span className={`text-right tabular-nums ${secondaryC}`}>
                {formatNumber(m.tokens, locale)}
              </span>
              <span className={`text-right tabular-nums ${mutedC}`}>
                {formatCost(m.cost, locale)}
              </span>
            </div>
          ))}
          {models.length > MODEL_PREVIEW_COUNT && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className={`mt-0.5 w-full rounded-md px-3 py-1.5 text-xs transition-colors hover:bg-white/[0.06] ${mutedC}`}
            >
              {showAll
                ? t(locale, "leaderboard.models.showLess")
                : t(locale, "leaderboard.models.showMore", { count: hiddenCount })}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ExpandedDetail({ entry, locale }: { entry: LeaderboardEntry; locale: Locale }) {
  const { data, isLoading } = useLeaderboardGraph(entry.handle);

  // Map the leaderboard daily series onto TokenBucket so we can reuse the
  // GitHub-style contribution calendar; tokens go in input_tokens so the
  // component's per-cell total equals the day's tokens.
  const buckets = useMemo<TokenBucket[]>(
    () =>
      (data ?? []).map((d) => ({
        label: d.day,
        input_tokens: d.tokens,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        reasoning_tokens: 0,
        cost_usd: d.cost,
        event_count: 0,
        agent_count: 0,
        model_count: 0,
      })),
    [data],
  );

  // Top-3 get an animated Prism background behind the expanded panel; hue
  // varies per rank so #1/#2/#3 feel distinct.
  const fancy = entry.rank <= 3;
  const onLight = entry.rank === 1;
  const tone = toneFor(entry.rank);
  const hue = entry.rank === 1 ? 0 : entry.rank === 2 ? 2.6 : 4.6;
  // BorderGlow edge colors per rank (gold / silver / bronze).
  const glow =
    entry.rank === 1
      ? { color: "45 90 60", colors: ["#fde68a", "#f59e0b", "#fbbf24"] }
      : entry.rank === 2
        ? { color: "251 55 66", colors: ["#c4b5fd", "#8b5cf6", "#a78bfa"] }
        : { color: "0 0 100", colors: ["#ffffff", "#e5e7eb", "#f3f4f6"] };
  // Stat tiles sit on gold/silver/bronze surfaces; an electric cyan stroke pops
  // on any of them. Per-rank tint keeps the medal identity.
  const electricColor = entry.rank === 1 ? "#22d3ee" : entry.rank === 2 ? "#f0abfc" : "#ffffff";
  const electricSpeed = entry.rank === 2 ? 0.2 : 1;
  const electricChaos = entry.rank === 2 ? 0.03 : entry.rank === 3 ? 0.01 : 0.04;
  const withElectric = (node: ReactNode) =>
    fancy ? (
      <ElectricBorder color={electricColor} speed={electricSpeed} chaos={electricChaos} borderRadius={12}>
        {node}
      </ElectricBorder>
    ) : (
      node
    );

  const stats = [
    { key: "tokens", label: t(locale, "leaderboard.columns.tokens"), value: formatNumber(entry.totalTokens, locale) },
    { key: "cost", label: t(locale, "leaderboard.columns.cost"), value: formatCost(entry.totalCostUsd, locale) },
    { key: "activeDays", label: t(locale, "leaderboard.columns.activeDays"), value: entry.activeDays },
    { key: "submits", label: t(locale, "leaderboard.columns.submits"), value: entry.submitCount },
  ];

  const body = (
    <>
      {/* Per-user summary cards (top-3 wrap each tile in a hover BorderGlow) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) =>
          fancy ? (
            <ElectricBorder
              key={s.key}
              color={electricColor}
              speed={electricSpeed}
              chaos={electricChaos}
              borderRadius={10}
            >
              <StatTile tone={tone} label={s.label} value={s.value} />
            </ElectricBorder>
          ) : (
            <StatTile key={s.key} tone={tone} label={s.label} value={s.value} />
          ),
        )}
      </div>

      {/* 每日活動 → 使用模型, stacked vertically */}
      <div className="flex flex-col gap-3">
        {isLoading ? (
          <p className={`text-xs ${fancy ? tone.muted : "text-text-muted"}`}>
            {t(locale, "leaderboard.graph.loading")}
          </p>
        ) : (
          withElectric(
            <ContributionGraph
              data={buckets}
              locale={locale}
              onSelectDate={NOOP_DAY}
              getDayHref={() => "#"}
              transparent={fancy}
              transparentTone={onLight ? "light" : "dark"}
              surfaceClassName={fancy ? tone.card : undefined}
              levels={tone.levels}
            />,
          )
        )}

        {/* Per-model token breakdown */}
        {withElectric(<ModelBreakdown handle={entry.handle} locale={locale} tone={tone} themed={!fancy} />)}
      </div>
    </>
  );

  if (!fancy) {
    return <div className="mx-2 mb-2 flex flex-col gap-3 rounded-lg bg-bg-secondary/40 p-3">{body}</div>;
  }

  return (
    <BorderGlow
      className="mx-2 mb-2"
      backgroundColor="#0a0a12"
      borderRadius={12}
      glowRadius={28}
      glowIntensity={1}
      coneSpread={25}
      edgeSensitivity={28}
      glowColor={glow.color}
      colors={glow.colors}
      animated
    >
      <div className="relative overflow-hidden rounded-[11px]">
        <div className="absolute inset-0">
          {entry.rank === 2 ? (
            <Silk speed={4} scale={1.8} color="#655999" noiseIntensity={1} rotation={0} />
          ) : entry.rank === 3 ? (
            <LightRays
              raysOrigin="top-center"
              raysColor="#ffffff"
              raysSpeed={1.2}
              lightSpread={0.8}
              rayLength={1.4}
              followMouse={false}
              noiseAmount={0.1}
              distortion={0.05}
            />
          ) : (
            <Prism
              animationType="rotate"
              timeScale={0.5}
              scale={4}
              glow={1.2}
              bloom={1.3}
              noise={0}
              colorFrequency={1.2}
              hueShift={hue}
            />
          )}
        </div>
        <div className="relative z-10 flex flex-col gap-3 p-3">{body}</div>
      </div>
    </BorderGlow>
  );
}

const RANGES: { key: "all" | "d7" | "d30" | "d60" | "d90"; days: number | null }[] = [
  { key: "all", days: null },
  { key: "d7", days: 7 },
  { key: "d30", days: 30 },
  { key: "d60", days: 60 },
  { key: "d90", days: 90 },
];

export default function LeaderboardPanel({ locale }: { locale: Locale }) {
  const [sort, setSort] = useState<LeaderboardSort>("tokens");
  const [days, setDays] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listQuery = useLeaderboard(sort, days);
  const submitMutation = useSubmitLeaderboard();
  const removeMutation = useRemoveLeaderboardEntry();

  useEffect(() => {
    void api.market.getAuthStatus().then((status) => setAuthEmail(status?.email ?? null));
    void api.leaderboard.getHandle().then((h) => {
      if (h) setHandle(h);
    });
  }, []);

  const entries = listQuery.data?.entries ?? [];
  const aggregates = listQuery.data?.aggregates;
  const myEntry = useMemo(() => entries.find((e: LeaderboardEntry) => e.isMe), [entries]);
  const handleValid = HANDLE_PATTERN.test(handle);

  function openSubmit() {
    setError(null);
    if (!authEmail) {
      setLoginOpen(true);
      return;
    }
    setSubmitOpen(true);
  }

  async function doSubmit() {
    setError(null);
    try {
      const result = await submitMutation.mutateAsync(handle);
      setSubmitOpen(false);
      setMessage(t(locale, "leaderboard.submit.success", { rank: result.rank ?? 0 }));
    } catch (e) {
      setError(t(locale, "leaderboard.submit.failure", { detail: String(e) }));
    }
  }

  async function doRemove() {
    setError(null);
    try {
      await removeMutation.mutateAsync();
      setMessage(t(locale, "leaderboard.remove.success"));
    } catch (e) {
      setError(t(locale, "leaderboard.remove.failure", { detail: String(e) }));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">{t(locale, "leaderboard.subtitle")}</p>
        <div className="flex items-center gap-2">
          {myEntry && (
            <ActionButton variant="danger" onClick={doRemove} disabled={removeMutation.isPending}>
              {t(locale, "leaderboard.remove.button")}
            </ActionButton>
          )}
          <ActionButton variant="primary" onClick={openSubmit}>
            {myEntry ? t(locale, "leaderboard.submit.update") : t(locale, "leaderboard.submit.button")}
          </ActionButton>
        </div>
      </div>

      {error && (
        <ErrorNotice title={t(locale, "leaderboard.title")} detail={error} onDismiss={() => setError(null)} />
      )}
      {message && (
        <div className="px-4 py-3 rounded-lg border border-accent/30 bg-accent/10 text-sm text-text-primary">
          {message}
        </div>
      )}
      {!authEmail && <p className="text-xs text-text-muted">{t(locale, "leaderboard.loggedOutHint")}</p>}

      {aggregates && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label={t(locale, "leaderboard.stats.users")} value={formatNumber(aggregates.userCount, locale)} />
          <StatCard label={t(locale, "leaderboard.stats.tokens")} value={formatNumber(aggregates.totalTokens, locale)} />
          <StatCard label={t(locale, "leaderboard.stats.cost")} value={formatCost(aggregates.totalCostUsd, locale)} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">{t(locale, "leaderboard.sort.label")}:</span>
          {SORTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                sort === s
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border text-text-secondary hover:text-text-primary"
              }`}
            >
              {t(locale, `leaderboard.sort.${s === "active_days" ? "activeDays" : s}` as const)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">{t(locale, "leaderboard.range.label")}:</span>
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setDays(r.days)}
              className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                days === r.days
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border text-text-secondary hover:text-text-primary"
              }`}
            >
              {t(locale, `leaderboard.range.${r.key}` as const)}
            </button>
          ))}
        </div>
      </div>

      {listQuery.isLoading ? (
        <LoadingLine label={t(locale, "leaderboard.loading")} />
      ) : listQuery.isError ? (
        <ErrorNotice
          title={t(locale, "leaderboard.title")}
          detail={t(locale, "leaderboard.connectionError", { detail: String(listQuery.error) })}
        />
      ) : entries.length === 0 ? (
        <EmptyState title={t(locale, "leaderboard.empty")} />
      ) : (
        <div
          className={`rounded-xl p-1 transition-opacity ${glassListSurfaceClass} ${
            listQuery.isFetching ? "opacity-60" : "opacity-100"
          }`}
        >
          <div className="grid grid-cols-[3rem_1fr_6rem_6rem_5rem_4rem] px-3 py-2 text-[10px] uppercase tracking-wider text-text-muted">
            <span>{t(locale, "leaderboard.columns.rank")}</span>
            <span>{t(locale, "leaderboard.columns.handle")}</span>
            <span className="text-right">{t(locale, "leaderboard.columns.tokens")}</span>
            <span className="text-right">{t(locale, "leaderboard.columns.cost")}</span>
            <span className="text-right">{t(locale, "leaderboard.columns.activeDays")}</span>
            <span className="text-right">{t(locale, "leaderboard.columns.submits")}</span>
          </div>
          {entries.map((entry: LeaderboardEntry) => {
            const medal =
              entry.rank === 1 ? (
                <Crown size={15} className="text-yellow-400" />
              ) : entry.rank === 2 ? (
                <Medal size={15} className="text-violet-300" />
              ) : entry.rank === 3 ? (
                <Medal size={15} className="text-white" />
              ) : null;
            const tintClass =
              entry.rank === 1
                ? "bg-gradient-to-r from-yellow-400/15 to-transparent"
                : entry.rank === 2
                  ? "bg-gradient-to-r from-violet-400/15 to-transparent"
                  : entry.rank === 3
                    ? "bg-gradient-to-r from-white/15 to-transparent"
                    : "";

            const isTop3 = entry.rank <= 3;
            const starColor =
              entry.rank === 1 ? "#fcd34d" : entry.rank === 2 ? "#a78bfa" : "#ffffff";
            // Stagger so #1 sweeps first, then #2, then #3.
            const starDelay = entry.rank === 1 ? "0s" : entry.rank === 2 ? "1.3s" : "2.6s";
            const row = (
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpanded(expanded === entry.handle ? null : entry.handle)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setExpanded(expanded === entry.handle ? null : entry.handle);
                }}
                className={`grid grid-cols-[3rem_1fr_6rem_6rem_5rem_4rem] items-center px-3 py-2 rounded-lg cursor-pointer text-sm ${
                  entry.isMe ? glassListSelectedRowClass : glassListRowClass
                } ${tintClass}`}
              >
                <span className="flex items-center gap-1 font-semibold text-text-secondary">
                  {medal}#{entry.rank}
                </span>
                <span className="truncate text-text-primary">
                  {entry.handle}
                  {entry.isMe && (
                    <span className="ml-2 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent">
                      {t(locale, "leaderboard.you")}
                    </span>
                  )}
                </span>
                <span className="text-right tabular-nums">{formatNumber(entry.totalTokens, locale)}</span>
                <span className="text-right tabular-nums">{formatCost(entry.totalCostUsd, locale)}</span>
                <span className="text-right tabular-nums">{entry.activeDays}</span>
                <span className="text-right tabular-nums text-text-muted">{entry.submitCount}</span>
              </div>
            );

            return (
              <div key={entry.handle}>
                {isTop3 ? (
                  <StarBorder color={starColor} thickness={5} speed="4s" delay={starDelay}>
                    {row}
                  </StarBorder>
                ) : (
                  row
                )}
                {expanded === entry.handle && <ExpandedDetail entry={entry} locale={locale} />}
              </div>
            );
          })}
        </div>
      )}

      <LoginDialog
        open={loginOpen}
        locale={locale}
        onClose={() => setLoginOpen(false)}
        onSuccess={(email) => {
          setAuthEmail(email);
          setLoginOpen(false);
          setSubmitOpen(true);
        }}
      />

      <Modal open={submitOpen} onClose={() => setSubmitOpen(false)} title={t(locale, "leaderboard.submit.title")} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1">
              {t(locale, "leaderboard.submit.handleLabel")}
            </label>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder={t(locale, "leaderboard.submit.handlePlaceholder")}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg-secondary text-sm text-text-primary"
            />
            <p className="text-[11px] text-text-muted mt-1">{t(locale, "leaderboard.submit.handleHint")}</p>
          </div>
          <label className="flex items-start gap-2 text-xs text-text-secondary">
            <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-0.5" />
            <span>{t(locale, "leaderboard.submit.optIn")}</span>
          </label>
          <div className="flex justify-end gap-2">
            <ActionButton
              variant="primary"
              onClick={doSubmit}
              disabled={!handleValid || !optIn || submitMutation.isPending}
            >
              {submitMutation.isPending
                ? t(locale, "leaderboard.submit.submitting")
                : t(locale, "leaderboard.submit.confirm")}
            </ActionButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
