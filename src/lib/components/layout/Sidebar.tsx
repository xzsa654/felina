import { useState, useEffect } from "react";
import { Link, useMatch } from "react-router";
import { getVersion } from "@tauri-apps/api/app";
import { NAV_ITEMS } from "$lib/stores/navigation";
import { useThemeStore } from "$lib/stores/theme";
import { api, type CostSummary } from "$lib/tauri/commands";
import { calculateXP } from "$lib/utils/achievements";
import { formatNumber } from "$lib/utils/format";
import type { StatsCache, Settings } from "$lib/types";
import {
  BarChart3,
  Settings as SettingsIcon,
  Zap,
  BookOpen,
  Brain,
  Server,
  Sparkles,
  Shield,
  Puzzle,
  GitBranch,
  TerminalSquare,
  Activity,
  LayoutGrid,
  Sun,
  Moon,
  History,
  Gauge,
  Keyboard,
  Network,
  ExternalLink,
  GitBranch as GithubIcon,
  X as XIcon,
  Coins,
} from "lucide-react";
import logoUrl from "$lib/assets/logo.png";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  chart: BarChart3,
  gear: SettingsIcon,
  bolt: Zap,
  book: BookOpen,
  brain: Brain,
  server: Server,
  sparkles: Sparkles,
  shield: Shield,
  puzzle: Puzzle,
  git: GitBranch,
  pipelines: Activity,
  sessions: History,
  templates: LayoutGrid,
  terminal: TerminalSquare,
  analytics: Activity,
  tokens: Coins,
  savings: Gauge,
  keybindings: Keyboard,
  network: Network,
};

export default function Sidebar() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const [showAbout, setShowAbout] = useState(false);
  const [appVersion, setAppVersion] = useState("...");
  const [stats, setStats] = useState<StatsCache | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, set, cost, ver] = await Promise.all([
          api.stats.computeLive(),
          api.settings.read("global"),
          api.budget.getCostSummary(),
          getVersion(),
        ]);
        setStats(s as StatsCache);
        setSettings(set);
        setCostSummary(cost);
        setAppVersion(ver);
      } catch {
        // Silently fail — sidebar XP is non-critical
      }
    })();
  }, []);

  const xp = calculateXP(stats, settings);
  const xpPct = Math.min((xp.currentXP / xp.nextLevelXP) * 100, 100);

  return (
    <aside className="flex flex-col h-full w-60 bg-bg-secondary border-r border-border shrink-0">
      {/* Logo */}
      <button
        className="flex items-center gap-2 px-4 py-[13.5px] border-b border-border w-full hover:bg-bg-hover transition-colors text-left"
        onClick={() => setShowAbout(true)}
      >
        <img src={logoUrl} alt="Glyphic" className="w-8 h-8 rounded-lg" />
        <div>
          <h1 className="text-sm font-semibold text-text-primary">Glyphic</h1>
          <p className="text-xs text-text-muted">AI Config Manager</p>
        </div>
      </button>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const IconComponent = ICON_MAP[item.icon];
          const isActive = useMatch(`/${item.id}`) !== null;
          return (
            <Link
              key={item.id}
              to={`/${item.id}`}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-accent-dim text-accent border-r-2 border-accent"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              }`}
            >
              <span className="w-5 h-5 flex items-center justify-center">
                {IconComponent && <IconComponent size={18} />}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Cost Widget */}
      {costSummary && (
        <div className="px-4 py-2 border-t border-border">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-text-muted">Today</span>
            <span
              className={`font-medium ${costSummary.daily_exceeded ? "text-danger" : "text-text-primary"}`}
            >
              ${costSummary.today.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-text-muted">This month</span>
            <span className="font-medium text-text-primary">
              ${costSummary.this_month.toFixed(2)}
            </span>
          </div>
          {costSummary.last_7_days.length > 0 && (() => {
            const max = Math.max(...costSummary.last_7_days, 0.01);
            return (
              <div className="flex items-end gap-px h-4">
                {costSummary.last_7_days.map((val, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-accent/40 rounded-t-sm"
                    style={{ height: `${Math.max((val / max) * 100, 5)}%` }}
                  />
                ))}
              </div>
            );
          })()}
          {(costSummary.daily_exceeded || costSummary.monthly_exceeded) && (
            <p className="text-[10px] text-danger mt-1">Budget exceeded!</p>
          )}
        </div>
      )}

      {/* Theme toggle */}
      <div className="px-4 py-2 border-t border-border">
        <button
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary rounded-md transition-colors"
          onClick={toggleTheme}
        >
          {theme === "dark" ? (
            <>
              <Sun size={16} />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon size={16} />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </div>

      {/* XP Bar */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex items-center justify-between text-xs text-text-muted mb-1">
          <span>
            Level {xp.level} — {xp.levelName}
          </span>
          <span>{formatNumber(xp.currentXP)} XP</span>
        </div>
        <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${xpPct}%` }}
          />
        </div>
      </div>

      {/* About Dialog */}
      {showAbout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <button
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAbout(false)}
            aria-label="Close"
          />
          <div className="relative bg-bg-secondary border border-border rounded-2xl shadow-2xl w-96 p-8 text-center z-10">
            <button
              className="absolute top-3 right-3 p-1 text-text-muted hover:text-text-primary"
              onClick={() => setShowAbout(false)}
              aria-label="Close"
            >
              <XIcon size={16} />
            </button>

            <img
              src={logoUrl}
              alt="Glyphic"
              className="w-20 h-20 rounded-2xl mx-auto mb-4"
            />
            <h2 className="text-xl font-bold text-text-primary">Glyphic</h2>
            <p className="text-sm text-text-muted mt-1">
              AI Config Manager for Claude Code
            </p>
            <p className="text-xs text-text-muted mt-1">Version {appVersion}</p>

            <div className="mt-6 space-y-2">
              <a
                href="https://caioricciuti.com"
                target="_blank"
                rel="noopener"
                className="flex items-center justify-center gap-2 text-sm text-accent hover:text-accent-hover transition-colors"
              >
                <ExternalLink size={14} />
                caioricciuti.com
              </a>
              <a
                href="https://github.com/caioricciuti/glyphic"
                target="_blank"
                rel="noopener"
                className="flex items-center justify-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                <GithubIcon size={14} />
                github.com/caioricciuti/glyphic
              </a>
            </div>

            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-xs text-text-muted">
                Built by{" "}
                <a
                  href="https://caioricciuti.com"
                  target="_blank"
                  rel="noopener"
                  className="text-accent hover:underline"
                >
                  Caio Ricciuti
                </a>
              </p>
              <p className="text-[10px] text-text-muted mt-1">AGPL-3.0 License</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
