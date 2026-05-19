import type { Settings, EffortLevel } from "$lib/types";

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
}

export default function GeneralSettings({ settings, onChange }: Props) {
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-medium text-text-secondary">General</h3>

      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-text-primary">Model</span>
          <p className="text-xs text-text-muted">Override the default model</p>
        </div>
        <select
          aria-label="Model"
          className="w-64 px-3 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary focus:outline-none focus:border-accent"
          value={settings.model ?? ""}
          onChange={(e) =>
            onChange({ ...settings, model: e.target.value || undefined })
          }
        >
          <option value="">Default (system-selected)</option>
          <option value="claude-opus-4-6">Claude Opus 4.6 (most capable)</option>
          <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (fast + capable)</option>
          <option value="claude-haiku-4-5">Claude Haiku 4.5 (fastest)</option>
        </select>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-text-primary">Effort Level</span>
          <p className="text-xs text-text-muted">Controls reasoning depth</p>
        </div>
        <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1" role="group" aria-label="Effort Level">
          {(["low", "medium", "high"] as EffortLevel[]).map((level) => (
            <button
              key={level}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                settings.effortLevel === level
                  ? "bg-accent text-white"
                  : "text-text-muted hover:text-text-secondary"
              }`}
              onClick={() => onChange({ ...settings, effortLevel: level })}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-text-primary">Extended Thinking</span>
          <p className="text-xs text-text-muted">Always enable extended thinking</p>
        </div>
        <button
          role="switch"
          aria-checked={settings.alwaysThinkingEnabled ?? false}
          aria-label="Toggle extended thinking"
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
            settings.alwaysThinkingEnabled ? "bg-accent" : "bg-bg-tertiary border border-border"
          }`}
          onClick={() =>
            onChange({ ...settings, alwaysThinkingEnabled: !settings.alwaysThinkingEnabled })
          }
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              settings.alwaysThinkingEnabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-text-primary">Auto Memory</span>
          <p className="text-xs text-text-muted">Allow Claude to save context between sessions</p>
        </div>
        <button
          role="switch"
          aria-checked={settings.autoMemoryEnabled !== false}
          aria-label="Toggle auto memory"
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
            settings.autoMemoryEnabled !== false ? "bg-accent" : "bg-bg-tertiary border border-border"
          }`}
          onClick={() =>
            onChange({
              ...settings,
              autoMemoryEnabled: settings.autoMemoryEnabled === false ? true : false,
            })
          }
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              settings.autoMemoryEnabled !== false ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
