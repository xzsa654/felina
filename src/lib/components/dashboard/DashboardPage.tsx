import { useState, useEffect } from "react";
import { api, type CostSummary } from "$lib/tauri/commands";
import { formatNumber } from "$lib/utils/format";
import { calculateStreak, getDaysActive } from "$lib/utils/streaks";
import { calculateXP, evaluateAchievements } from "$lib/utils/achievements";
import { useNavigationStore } from "$lib/stores/navigation";
import type { StatsCache, Settings, DailyActivity } from "$lib/types";
import StatsOverview from "./StatsOverview";
import StreakCard from "./StreakCard";
import ConfigCompletenessRing from "./ConfigCompletenessRing";
import ActivityHeatmap from "./ActivityHeatmap";
import AchievementGrid from "./AchievementGrid";
import SessionMonitor from "$lib/components/sessions/SessionMonitor";
import { DollarSign, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  const navigateTo = useNavigationStore((s) => s.navigateTo);
  const [stats, setStats] = useState<StatsCache | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, set, cost] = await Promise.all([
          api.stats.computeLive(),
          api.settings.read("global"),
          api.budget.getCostSummary(),
        ]);
        setStats(s as StatsCache);
        setSettings(set);
        setCostSummary(cost);
      } catch (e) {
        console.error("Failed to load dashboard data:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalMessages = stats?.totalMessages ?? 0;
  const totalSessions = stats?.totalSessions ?? 0;
  const totalToolCalls =
    stats?.dailyActivity?.reduce(
      (sum: number, d: DailyActivity) => sum + d.toolCallCount,
      0,
    ) ?? 0;
  const daysActive = getDaysActive(stats?.dailyActivity ?? []);
  const streak = calculateStreak(stats?.dailyActivity ?? []);
  const xp = calculateXP(stats, settings);
  const achievements = evaluateAchievements(stats, settings, streak.current);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Level Banner */}
      <div className="bg-gradient-to-r from-accent/20 to-accent/5 border border-accent/30 rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wider">
            Level {xp.level}
          </p>
          <p className="text-xl font-bold text-accent">{xp.levelName}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-text-secondary">
            {formatNumber(xp.currentXP)} / {formatNumber(xp.nextLevelXP)} XP
          </p>
          <div className="w-48 h-2 bg-bg-tertiary rounded-full mt-1 overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-1000"
              style={{
                width: `${Math.min((xp.currentXP / xp.nextLevelXP) * 100, 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      <StatsOverview
        totalSessions={totalSessions}
        totalMessages={totalMessages}
        totalToolCalls={totalToolCalls}
        daysActive={daysActive}
      />

      <div className="grid grid-cols-3 gap-4">
        <StreakCard
          current={streak.current}
          longest={streak.longest}
          lastActiveDate={streak.lastActiveDate}
        />
        <ConfigCompletenessRing settings={settings} />

        {/* Cost Overview */}
        <div className="bg-bg-secondary border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-1.5">
            <DollarSign size={14} />
            Cost Overview
          </h3>
          {costSummary ? (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-text-muted">Today</span>
                  <span
                    className={`font-medium ${costSummary.daily_exceeded ? "text-danger" : "text-text-primary"}`}
                  >
                    ${costSummary.today.toFixed(2)}
                  </span>
                </div>
                {costSummary.daily_limit && (
                  <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className={`h-full ${costSummary.daily_exceeded ? "bg-danger" : "bg-accent"} rounded-full`}
                      style={{
                        width: `${Math.min((costSummary.today / costSummary.daily_limit) * 100, 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-text-muted">This month</span>
                  <span className="font-medium text-text-primary">
                    ${costSummary.this_month.toFixed(2)}
                  </span>
                </div>
                {costSummary.monthly_limit && (
                  <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className={`h-full ${costSummary.monthly_exceeded ? "bg-danger" : "bg-accent"} rounded-full`}
                      style={{
                        width: `${Math.min((costSummary.this_month / costSummary.monthly_limit) * 100, 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted flex items-center gap-1">
                  <TrendingUp size={10} /> Projection
                </span>
                <span className="text-text-secondary">
                  ${costSummary.monthly_projection.toFixed(2)}/mo
                </span>
              </div>
              <button
                className="w-full text-xs text-accent hover:text-accent-hover py-1 transition-colors"
                onClick={() => navigateTo("analytics")}
              >
                View full analytics →
              </button>
            </div>
          ) : (
            <p className="text-xs text-text-muted">Loading...</p>
          )}
        </div>
      </div>

      <ActivityHeatmap dailyActivity={stats?.dailyActivity ?? []} />

      <div className="grid grid-cols-2 gap-4">
        <SessionMonitor />
        <AchievementGrid achievements={achievements} />
      </div>
    </div>
  );
}
