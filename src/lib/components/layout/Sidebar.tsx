import { useState, useEffect } from "react";
import { Link, useMatch } from "react-router";
import { getVersion } from "@tauri-apps/api/app";
import { NAV_ITEMS } from "$lib/stores/navigation";
import { useThemeStore } from "$lib/stores/theme";
import LanguageSwitcher from "$lib/components/shared/LanguageSwitcher";
import {
  Settings as SettingsIcon,
  Brain,
  Sparkles,
  LayoutGrid,
  Sun,
  Moon,
  ExternalLink,
  GitBranch as GithubIcon,
  X as XIcon,
  Coins,
  FolderOpen,
  History,
} from "lucide-react";
import logoUrl from "$lib/assets/logo.png";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  sparkles: Sparkles,
  folder: FolderOpen,
  gear: SettingsIcon,
  templates: LayoutGrid,
  tokens: Coins,
  brain: Brain,
  history: History,
};

export default function Sidebar() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const [showAbout, setShowAbout] = useState(false);
  const [appVersion, setAppVersion] = useState("...");

  useEffect(() => {
    (async () => {
      try {
        setAppVersion(await getVersion());
      } catch {
        // Silently fail — version display is non-critical
      }
    })();
  }, []);

  return (
    <aside className="flex flex-col h-full w-60 bg-bg-secondary border-r border-border shrink-0">
      {/* Logo */}
      <button
        className="flex items-center gap-2 px-4 py-[13.5px] border-b border-border w-full hover:bg-bg-hover transition-colors text-left"
        onClick={() => setShowAbout(true)}
      >
        <img src={logoUrl} alt="Felina" className="w-8 h-8 rounded-lg" />
        <div>
          <h1 className="text-sm font-semibold text-text-primary">Felina</h1>
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

      {/* Global UI preferences */}
      <div className="px-4 py-2 border-t border-border">
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
        <button
          className="shrink-0 flex items-center justify-center w-8 h-8 text-text-secondary hover:bg-bg-hover hover:text-text-primary rounded-md transition-colors"
          onClick={toggleTheme}
          title={theme === "dark" ? "Light Mode" : "Dark Mode"}
          aria-label={theme === "dark" ? "Light Mode" : "Dark Mode"}
        >
          {theme === "dark" ? (
            <Sun size={16} />
          ) : (
            <Moon size={16} />
          )}
        </button>
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
              alt="Felina"
              className="w-20 h-20 rounded-2xl mx-auto mb-4"
            />
            <h2 className="text-xl font-bold text-text-primary">Felina</h2>
            <p className="text-sm text-text-muted mt-1">
              Local agent CLI control plane
            </p>
            <p className="text-xs text-text-muted mt-1">Version {appVersion}</p>

            <div className="mt-6 space-y-2">
              <a
                href="https://github.com/xzsa654/felina"
                target="_blank"
                rel="noopener"
                className="flex items-center justify-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                <GithubIcon size={14} />
                github.com/xzsa654/felina
              </a>
              <a
                href="https://github.com/xzsa654/felina/issues"
                target="_blank"
                rel="noopener"
                className="flex items-center justify-center gap-2 text-sm text-accent hover:text-accent-hover transition-colors"
              >
                <ExternalLink size={14} />
                Report an issue
              </a>
            </div>

            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-xs text-text-muted">Built for local agent CLI workflows</p>
              <p className="text-[10px] text-text-muted mt-1">AGPL-3.0 License</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
