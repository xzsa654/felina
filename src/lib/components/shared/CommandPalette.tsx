import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router";
import { NAV_ITEMS } from "$lib/stores/navigation";
import { useThemeStore } from "$lib/stores/theme";
import {
  Settings,
  Brain,
  Sparkles,
  LayoutGrid,
  Sun,
  Moon,
  Search,
  Command as CommandIcon,
  Coins,
  History,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  sparkles: Sparkles,
  gear: Settings,
  templates: LayoutGrid,
  brain: Brain,
  tokens: Coins,
  history: History,
};

interface PaletteAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: "navigate" | "action";
  handler: () => void;
}

export default function CommandPalette() {
  const navigate = useNavigate();
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions: PaletteAction[] = useMemo(
    () => [
      ...NAV_ITEMS.map((item) => ({
        id: `nav-${item.id}`,
        label: item.label,
        description: `Go to ${item.label}`,
        icon: item.icon,
        category: "navigate" as const,
        handler: () => navigate(`/${item.id}`),
      })),
      {
        id: "action-theme",
        label: "Toggle Theme",
        description: "Switch between dark and light mode",
        icon: "theme",
        category: "action" as const,
        handler: toggleTheme,
      },
    ],
    [navigate, toggleTheme],
  );

  const filtered = useMemo(() => {
    if (query.trim() === "") return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(query.toLowerCase()) ||
        a.description.toLowerCase().includes(query.toLowerCase()),
    );
  }, [actions, query]);

  useEffect(() => {
    if (filtered.length > 0 && selectedIndex >= filtered.length) {
      setSelectedIndex(0);
    }
  }, [filtered, selectedIndex]);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => {
          if (!prev) {
            setQuery("");
            setSelectedIndex(0);
            requestAnimationFrame(() => inputRef.current?.focus());
          }
          return !prev;
        });
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "9") {
        const index = parseInt(e.key) - 1;
        if (index < NAV_ITEMS.length) {
          e.preventDefault();
          navigate(`/${NAV_ITEMS[index].id}`);
        }
        return;
      }

      if (!open) return;

      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].handler();
          setOpen(false);
        }
      }
    }

    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [open, filtered, selectedIndex, navigate]);

  function handleSelect(action: PaletteAction) {
    action.handler();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <>
      <button
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
        onClick={() => setOpen(false)}
        aria-label="Close command palette"
      />

      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-[560px] bg-bg-secondary border border-border rounded-xl shadow-2xl z-[101] overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={18} className="text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, actions..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="px-1.5 py-0.5 text-[10px] bg-bg-tertiary text-text-muted rounded border border-border font-mono">
            ESC
          </kbd>
        </div>

        <div className="max-h-[320px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text-muted">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((action, i) => {
              const IconComponent =
                action.icon === "theme"
                  ? theme === "dark"
                    ? Sun
                    : Moon
                  : ICON_MAP[action.icon];
              return (
                <button
                  key={action.id}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === selectedIndex
                      ? "bg-accent/15 text-accent"
                      : "text-text-secondary hover:bg-bg-hover"
                  }`}
                  onClick={() => handleSelect(action)}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <span
                    className={`w-8 h-8 flex items-center justify-center rounded-lg ${
                      i === selectedIndex ? "bg-accent/20" : "bg-bg-tertiary"
                    }`}
                  >
                    {IconComponent && <IconComponent size={16} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{action.label}</p>
                    <p className="text-xs text-text-muted truncate">
                      {action.description}
                    </p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted uppercase">
                    {action.category === "navigate" ? "page" : "action"}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-border text-[10px] text-text-muted">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-bg-tertiary rounded border border-border font-mono">
                ↑↓
              </kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-bg-tertiary rounded border border-border font-mono">
                ↵
              </kbd>
              select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <CommandIcon size={10} />
            <span>+K to toggle</span>
          </span>
        </div>
      </div>
    </>
  );
}
