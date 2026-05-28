import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import type { SkillFieldDefinition, FieldAgent, SkillTarget } from "$lib/types";
import { api } from "$lib/tauri/commands";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";

interface Props {
  agentFields: Record<string, unknown>;
  targets: SkillTarget[];
  onChange: (fields: Record<string, unknown>) => void;
}

type AgentFieldValues = Record<string, string>;

export default function AgentFieldsEditor({ agentFields, targets, onChange }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const [catalog, setCatalog] = useState<SkillFieldDefinition[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void api.skillFields
      .list()
      .then(setCatalog)
      .catch((e) => setCatalogError(String(e)));
  }, []);

  const enabledAgents = new Set<string>();
  for (const tgt of targets) {
    if (tgt.enabled && tgt.mode !== "detached") {
      enabledAgents.add(tgt.agent);
    }
  }
  enabledAgents.add("standard");

  const groupedCatalog = new Map<FieldAgent, SkillFieldDefinition[]>();
  for (const def of catalog) {
    if (!enabledAgents.has(def.agent)) continue;
    const group = groupedCatalog.get(def.agent) ?? [];
    group.push(def);
    groupedCatalog.set(def.agent, group);
  }

  function getAgentValues(agent: string): AgentFieldValues {
    const raw = agentFields[agent];
    if (!raw || typeof raw !== "object") return {};
    const out: AgentFieldValues = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      out[k] = typeof v === "string" ? v : JSON.stringify(v);
    }
    return out;
  }

  function setFieldValue(agent: string, canonicalKey: string, value: string) {
    const current = { ...agentFields };
    const agentObj = (current[agent] && typeof current[agent] === "object")
      ? { ...(current[agent] as Record<string, unknown>) }
      : {};
    agentObj[canonicalKey] = parseFieldValue(value);
    current[agent] = agentObj;
    onChange(current);
  }

  function removeField(agent: string, canonicalKey: string) {
    const current = { ...agentFields };
    const agentObj = (current[agent] && typeof current[agent] === "object")
      ? { ...(current[agent] as Record<string, unknown>) }
      : {};
    delete agentObj[canonicalKey];
    if (Object.keys(agentObj).length === 0) {
      delete current[agent];
    } else {
      current[agent] = agentObj;
    }
    onChange(current);
  }

  if (catalogError) {
    return (
      <div className="text-xs text-danger bg-danger-dim border border-danger/30 rounded px-3 py-2">
        {t(locale, "skills.fields.catalogError")}: {catalogError}
      </div>
    );
  }

  if (catalog.length === 0) return null;

  const agentLabels: Record<string, string> = {
    anthropic: "Claude Code",
    codex: "Codex",
    gemini: "Gemini CLI",
    standard: "Standard",
  };

  const sortedGroups = [...groupedCatalog.entries()].sort(([a], [b]) => {
    const order: FieldAgent[] = ["anthropic", "codex", "gemini", "standard"];
    return order.indexOf(a) - order.indexOf(b);
  });

  return (
    <div className="flex flex-col gap-3">
      {sortedGroups.map(([agent, fields]) => {
        const open = openGroups[agent] ?? false;
        const values = getAgentValues(agent);
        const activeCount = Object.keys(values).length;
        return (
          <div key={agent} className="border border-border rounded">
            <button
              type="button"
              onClick={() => setOpenGroups((prev) => ({ ...prev, [agent]: !open }))}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-text-primary hover:bg-bg-secondary"
            >
              <span className="flex items-center gap-1">
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {agentLabels[agent] ?? agent}
                {activeCount > 0 && (
                  <span className="ml-1 text-text-muted">({activeCount})</span>
                )}
              </span>
            </button>
            {open && (
              <div className="px-3 pb-3 flex flex-col gap-2">
                {fields.map((def) => {
                  const key = def.outputKey;
                  const hasValue = key in values;
                  if (!hasValue) return null;
                  return (
                    <FieldRow
                      key={def.canonicalPath}
                      def={def}
                      value={values[key] ?? ""}
                      onChangeValue={(v) => setFieldValue(agent, key, v)}
                      onRemove={() => removeField(agent, key)}
                    />
                  );
                })}
                <FieldAdder
                  fields={fields}
                  activeKeys={new Set(Object.keys(values))}
                  onAdd={(key) => setFieldValue(agent, key, "")}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const FIELD_PLACEHOLDERS: Record<string, string> = {
  "allowed-tools": 'Read Edit Grep',
  "effort": "high",
  "model": "sonnet",
  "when_to_use": "When the user asks about...",
  "argument-hint": "[issue-number]",
  "arguments": '["target", "scope"]',
  "context": "fork",
  "agent": "code-reviewer",
  "hooks": '{"preToolUse": {...}}',
  "paths": '["src/**/*.ts", "*.config.*"]',
  "shell": "bash",
  "interface.display_name": "My Helper Skill",
  "interface.short_description": "A brief summary for the skill list",
  "interface.icon_small": "./assets/icon-sm.svg",
  "interface.icon_large": "./assets/icon-lg.png",
  "interface.brand_color": "#3B82F6",
  "interface.default_prompt": "Use this skill to...",
  "dependencies.tools": '[{"type":"mcp","value":"..."}]',
  "license": "MIT",
  "compatibility": "Requires git",
  "metadata": '{"owner": "platform"}',
};

function FieldRow({
  def,
  value,
  onChangeValue,
  onRemove,
}: {
  def: SkillFieldDefinition;
  value: string;
  onChangeValue: (v: string) => void;
  onRemove: () => void;
}) {
  const locale = useLocaleStore((s) => s.locale);
  const helpText = t(locale, def.helpKey as never);
  const placeholder = FIELD_PLACEHOLDERS[def.outputKey] ?? def.outputKey;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <label className="text-xs text-text-secondary w-1/3 truncate" title={def.canonicalPath}>
          {t(locale, def.labelKey as never) ?? def.outputKey}
        </label>
        {def.valueKind === "enum" && def.enumValues && def.enumValues.length > 0 ? (
          <select
            value={value}
            onChange={(e) => onChangeValue(e.target.value)}
            className="px-2 py-1 rounded bg-bg-primary border border-border text-xs flex-1"
          >
            <option value="">{t(locale, "skills.fields.selectValue")}</option>
            {def.enumValues.map((ev) => (
              <option key={ev} value={ev}>
                {ev}
              </option>
            ))}
          </select>
        ) : def.valueKind === "boolean" ? (
          <select
            value={value}
            onChange={(e) => onChangeValue(e.target.value)}
            className="px-2 py-1 rounded bg-bg-primary border border-border text-xs flex-1"
          >
            <option value="">{t(locale, "skills.fields.selectValue")}</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChangeValue(e.target.value)}
            placeholder={placeholder}
            className="px-2 py-1 rounded bg-bg-primary border border-border text-xs flex-1"
          />
        )}
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-text-secondary hover:text-danger"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {helpText && (
        <div className="text-[10px] text-text-muted pl-[33.33%] ml-2">
          {helpText}
        </div>
      )}
    </div>
  );
}

function FieldAdder({
  fields,
  activeKeys,
  onAdd,
}: {
  fields: SkillFieldDefinition[];
  activeKeys: Set<string>;
  onAdd: (key: string) => void;
}) {
  const locale = useLocaleStore((s) => s.locale);
  const available = fields.filter((f) => !activeKeys.has(f.outputKey));
  const [selecting, setSelecting] = useState(false);

  if (available.length === 0) return null;

  if (!selecting) {
    return (
      <button
        type="button"
        onClick={() => setSelecting(true)}
        className="self-start inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-text-secondary hover:text-text-primary hover:border-accent"
      >
        <Plus size={12} /> {t(locale, "skills.fields.addField")}
      </button>
    );
  }

  return (
    <select
      autoFocus
      className="px-2 py-1 rounded bg-bg-primary border border-accent text-xs w-full"
      value=""
      onChange={(e) => {
        if (e.target.value) {
          onAdd(e.target.value);
          setSelecting(false);
        }
      }}
      onBlur={() => setSelecting(false)}
    >
      <option value="">{t(locale, "skills.fields.selectField")}</option>
      {available.map((def) => (
        <option key={def.canonicalPath} value={def.outputKey}>
          {t(locale, def.labelKey as never) ?? def.outputKey}
        </option>
      ))}
    </select>
  );
}

function parseFieldValue(s: string): unknown {
  if (s === "true") return true;
  if (s === "false") return false;
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed) || (typeof parsed === "object" && parsed !== null)) {
      return parsed;
    }
  } catch {
    // not JSON
  }
  return s;
}
