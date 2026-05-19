import { useState } from "react";
import type { Settings } from "$lib/types";

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
}

export default function PermissionsEditor({ settings, onChange }: Props) {
  const [newRule, setNewRule] = useState("");
  const [newRuleAction, setNewRuleAction] = useState<"allow" | "ask" | "deny">("allow");

  const permissions = settings.permissions ?? { allow: [], ask: [], deny: [] };

  function addRule() {
    if (!newRule.trim()) return;
    const current = { ...permissions };
    const list = current[newRuleAction] ?? [];
    if (!list.includes(newRule.trim())) {
      current[newRuleAction] = [...list, newRule.trim()];
      onChange({ ...settings, permissions: current });
    }
    setNewRule("");
  }

  function removeRule(action: "allow" | "ask" | "deny", rule: string) {
    const current = { ...permissions };
    current[action] = (current[action] ?? []).filter((r) => r !== rule);
    onChange({ ...settings, permissions: current });
  }

  const sections = [
    { key: "allow" as const, label: "Allow", color: "text-success" },
    { key: "ask" as const, label: "Ask", color: "text-warning" },
    { key: "deny" as const, label: "Deny", color: "text-danger" },
  ];

  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-medium text-text-secondary">Permissions</h3>

      <div className="flex gap-2">
        <select
          className="px-2 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary focus:outline-none focus:border-accent"
          value={newRuleAction}
          onChange={(e) => setNewRuleAction(e.target.value as "allow" | "ask" | "deny")}
        >
          <option value="allow">Allow</option>
          <option value="ask">Ask</option>
          <option value="deny">Deny</option>
        </select>
        <input
          type="text"
          className="flex-1 px-3 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          placeholder="e.g. Bash(npm run *), Edit(/src/**/*.ts), WebFetch(domain:github.com)"
          value={newRule}
          onChange={(e) => setNewRule(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addRule()}
        />
        <button
          className="px-3 py-1.5 text-sm bg-accent hover:bg-accent-hover text-white rounded-md transition-colors"
          onClick={addRule}
        >
          Add
        </button>
      </div>

      {sections.map(({ key, label, color }) => {
        const rules = permissions[key] ?? [];
        if (rules.length === 0) return null;
        return (
          <div key={key}>
            <p className={`text-xs uppercase tracking-wider ${color} mb-2`}>{label}</p>
            <div className="space-y-1">
              {rules.map((rule) => (
                <div
                  key={rule}
                  className="flex items-center justify-between px-3 py-1.5 bg-bg-tertiary rounded-md group"
                >
                  <code className="text-sm text-text-primary font-mono">{rule}</code>
                  <button
                    className="text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    onClick={() => removeRule(key, rule)}
                  >
                    remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
