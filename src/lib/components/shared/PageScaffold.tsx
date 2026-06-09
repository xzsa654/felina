import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export const glassListSurfaceClass =
  "border-glass-surface-border bg-glass-surface shadow-inner backdrop-blur-xl";

export const glassListRowClass =
  "border border-transparent hover:bg-white/[0.08] hover:shadow-sm hover:backdrop-blur-xl";

export const glassListSelectedRowClass =
  "border-accent/25 bg-accent-soft shadow-[0_10px_30px_rgba(0,0,0,0.16)] backdrop-blur-xl";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  bottomSlot?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  bottomSlot,
}: PageHeaderProps) {
  return (
    <header className="px-8 pt-5 pb-4 border-b border-border">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className="p-2.5 rounded-lg bg-accent/10 text-accent shrink-0">
              <Icon size={22} />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
            {subtitle && (
              <p className="text-sm text-text-secondary truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {bottomSlot && <div className="mt-5">{bottomSlot}</div>}
    </header>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return <div className="p-6 overflow-y-auto flex-1 min-h-0">{children}</div>;
}

export function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <div className="border border-dashed border-border rounded-lg p-8 text-center">
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {detail && <p className="text-xs text-text-muted mt-1">{detail}</p>}
    </div>
  );
}

export function ErrorBanner({ error }: { error: string }) {
  return (
    <div className="mb-4 px-4 py-3 rounded-lg border border-danger/30 bg-danger/10 text-danger text-sm">
      {error}
    </div>
  );
}

export function LoadingLine({ label = "Loading..." }: { label?: string }) {
  return <p className="text-sm text-text-muted">{label}</p>;
}

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">
        {label}
      </p>
      <p className="text-2xl font-semibold text-text-primary">{value}</p>
      {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
    </div>
  );
}

export function ActionButton({
  children,
  onClick,
  disabled,
  variant = "secondary",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  title?: string;
}) {
  const classes = {
    primary: "bg-accent hover:bg-accent-hover text-white border-accent",
    secondary:
      "bg-bg-secondary hover:bg-bg-hover text-text-secondary hover:text-text-primary border-border",
    danger: "bg-danger/10 hover:bg-danger/20 text-danger border-danger/30",
  }[variant];

  return (
    <button
      type="button"
      title={title}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${classes}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
