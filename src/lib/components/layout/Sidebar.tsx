import { useRef, useState, useEffect, useMemo } from "react";
import { useMatch, useNavigate } from "react-router";
import { getVersion } from "@tauri-apps/api/app";
import {
  getMergedNavItems,
  useNavigationStore,
  type NavItem,
} from "$lib/stores/navigation";
import QuickSettingsPopover from "./QuickSettingsPopover";
import { t } from "$lib/i18n";
import { useLocaleStore } from "$lib/stores/locale";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Settings as SettingsIcon,
  Brain,
  Sparkles,
  ExternalLink,
  GitBranch as GithubIcon,
  X as XIcon,
  Coins,
  FolderOpen,
  History,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import logoUrl from "$lib/assets/logo.png";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  sparkles: Sparkles,
  folder: FolderOpen,
  tokens: Coins,
  brain: Brain,
  history: History,
};

function SortableSidebarItem({ item, collapsed, didDrag }: { item: NavItem; collapsed: boolean; didDrag: React.MutableRefObject<boolean> }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const navigate = useNavigate();
  const isActive = useMatch(`/${item.id}`) !== null;
  const IconComponent = ICON_MAP[item.icon];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      title={collapsed ? item.label : undefined}
      onClick={() => { if (!didDrag.current) navigate(`/${item.id}`); }}
      onKeyDown={(e) => { if (e.key === "Enter" && !didDrag.current) navigate(`/${item.id}`); }}
      className={`w-full flex items-center py-2.5 text-sm transition-colors select-none cursor-pointer ${
        collapsed ? "justify-center px-0" : "gap-3 px-4"
      } ${
        isDragging
          ? "opacity-50 bg-bg-hover"
          : isActive
            ? "bg-accent-dim text-accent border-r-2 border-accent"
            : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
      }`}
    >
      <span className="w-5 h-5 flex items-center justify-center shrink-0">
        {IconComponent && <IconComponent size={18} />}
      </span>
      {!collapsed && <span>{item.label}</span>}
    </div>
  );
}

export default function Sidebar() {
  const locale = useLocaleStore((s) => s.locale);
  const customOrder = useNavigationStore((s) => s.customOrder);
  const setCustomOrder = useNavigationStore((s) => s.setCustomOrder);
  const collapsed = useNavigationStore((s) => s.collapsed);
  const toggleCollapsed = useNavigationStore((s) => s.toggleCollapsed);

  const [showAbout, setShowAbout] = useState(false);
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const [appVersion, setAppVersion] = useState("...");
  const quickSettingsButtonRef = useRef<HTMLButtonElement | null>(null);

  const navItems = useMemo(() => getMergedNavItems(customOrder), [customOrder]);
  const didDrag = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    didDrag.current = true;
    requestAnimationFrame(() => { didDrag.current = false; });
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = navItems.findIndex((item) => item.id === active.id);
    const newIndex = navItems.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...navItems];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    setCustomOrder(reordered.map((item) => item.id));
  }

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
    <aside className={`relative flex flex-col h-full bg-bg-secondary border-r border-border shrink-0 transition-[width] duration-200 ${collapsed ? "w-14" : "w-60"}`}>
      {/* Logo */}
      <button
        className={`flex items-center border-b border-border w-full hover:bg-bg-hover transition-colors ${collapsed ? "justify-center px-0 py-[13.5px]" : "gap-2 px-4 py-[13.5px] text-left"}`}
        onClick={() => setShowAbout(true)}
      >
        <img src={logoUrl} alt="Felina" className="w-8 h-8 rounded-lg shrink-0" />
        {!collapsed && (
          <div>
            <h1 className="text-sm font-semibold text-text-primary">Felina</h1>
            <p className="text-xs text-text-muted">AI Config Manager</p>
          </div>
        )}
      </button>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={navItems.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            {navItems.map((item) => (
              <SortableSidebarItem key={item.id} item={item} collapsed={collapsed} didDrag={didDrag} />
            ))}
          </SortableContext>
        </DndContext>
      </nav>

      {/* Bottom controls */}
      <div className={`flex items-center ${collapsed ? "flex-col gap-1 px-1" : "px-4 gap-1"} mb-2 mt-2`}>
        <button
          ref={quickSettingsButtonRef}
          className={`flex h-9 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary ${
            collapsed ? "w-full" : "flex-1"
          } ${showQuickSettings ? "bg-bg-hover text-text-primary" : ""}`}
          onClick={() => setShowQuickSettings((value) => !value)}
          title={t(locale, "quickSettings.open")}
          aria-label={t(locale, "quickSettings.open")}
          aria-expanded={showQuickSettings}
        >
          <SettingsIcon size={17} />
        </button>
        <button
          className={`flex h-9 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary ${collapsed ? "w-full" : "w-9"}`}
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
        </button>
      </div>
      <QuickSettingsPopover
        open={showQuickSettings}
        onClose={() => setShowQuickSettings(false)}
        anchorRef={quickSettingsButtonRef}
      />

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
