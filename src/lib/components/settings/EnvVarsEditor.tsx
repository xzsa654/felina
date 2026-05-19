import { useState } from "react";
import type { Settings } from "$lib/types";

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
}

export default function EnvVarsEditor({ settings, onChange }: Props) {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const envVars = Object.entries(settings.env ?? {});

  function addVar() {
    if (!newKey.trim()) return;
    const current = { ...(settings.env ?? {}) };
    current[newKey.trim()] = newValue;
    onChange({ ...settings, env: current });
    setNewKey("");
    setNewValue("");
  }

  function removeVar(key: string) {
    const current = { ...(settings.env ?? {}) };
    delete current[key];
    onChange({ ...settings, env: Object.keys(current).length > 0 ? current : undefined });
  }

  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-medium text-text-secondary">Environment Variables</h3>

      <div className="flex gap-2">
        <input
          type="text"
          className="w-48 px-3 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent font-mono"
          placeholder="KEY"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addVar()}
        />
        <input
          type="text"
          className="flex-1 px-3 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent font-mono"
          placeholder="value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addVar()}
        />
        <button
          className="px-3 py-1.5 text-sm bg-accent hover:bg-accent-hover text-white rounded-md transition-colors"
          onClick={addVar}
        >
          Add
        </button>
      </div>

      {envVars.length > 0 ? (
        <div className="space-y-1">
          {envVars.map(([key, value]) => (
            <div
              key={key}
              className="flex items-center justify-between px-3 py-1.5 bg-bg-tertiary rounded-md group"
            >
              <div className="flex items-center gap-2 font-mono text-sm">
                <span className="text-accent">{key}</span>
                <span className="text-text-muted">=</span>
                <span className="text-text-primary">{value}</span>
              </div>
              <button
                className="text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                onClick={() => removeVar(key)}
              >
                remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-muted">No environment variables configured</p>
      )}
    </div>
  );
}
