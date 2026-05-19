import type { Settings } from "$lib/types";

interface Props {
  settings: Settings | null;
}

export default function ConfigCompletenessRing({ settings }: Props) {
  const pct = (() => {
    if (!settings) return 0;
    let score = 0;
    const total = 6;
    if (Object.keys(settings).length > 0) score++;
    if (settings.hooks && Object.keys(settings.hooks).length > 0) score++;
    if (settings.mcpServers && Object.keys(settings.mcpServers).length > 0) score++;
    if (settings.permissions) score++;
    if (settings.env && Object.keys(settings.env).length > 0) score++;
    if (settings.effortLevel) score++;
    return Math.round((score / total) * 100);
  })();

  const dashArray = `${pct}, 100`;

  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-text-secondary mb-3">Config Completeness</h3>
      <div className="flex items-center justify-center">
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="var(--color-bg-tertiary)"
              strokeWidth="3"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="3"
              strokeDasharray={dashArray}
              className="transition-all duration-1000"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-text-primary">
            {pct}%
          </span>
        </div>
      </div>
    </div>
  );
}
