import { useState, useEffect } from "react";
import { api } from "$lib/tauri/commands";
import type { BudgetSettings, DiskUsageReport } from "$lib/tauri/commands";
import type { Settings } from "$lib/types";
import GeneralSettings from "./GeneralSettings";
import PermissionsEditor from "./PermissionsEditor";
import EnvVarsEditor from "./EnvVarsEditor";
import AgentPathsSection from "./AgentPathsSection";
import ProjectPicker from "$lib/components/shared/ProjectPicker";
import { useProjectContextStore } from "$lib/stores/project-context";
import { Info, CreditCard, HardDrive, Trash2 } from "lucide-react";

export default function SettingsPage() {
  const { selectedProjectPath } = useProjectContextStore();
  const [activeTab, setActiveTab] = useState<"global" | "project">("global");
  const [globalSettings, setGlobalSettings] = useState<Settings>({});
  const [projectSettings, setProjectSettings] = useState<Settings>({});
  const [localSettings, setLocalSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [savingLocal, setSavingLocal] = useState(false);
  const [budgetSettings, setBudgetSettings] = useState<BudgetSettings | null>(null);
  const [diskUsage, setDiskUsage] = useState<DiskUsageReport | null>(null);
  const [cleaning, setCleaning] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const isProjectTab = activeTab === "project";

  function showSave(msg: string) {
    setSaveMessage(msg);
    setTimeout(() => setSaveMessage(null), 2000);
  }

  async function loadBudget() {
    try { setBudgetSettings(await api.budget.get()); } catch { /* silent */ }
  }

  async function loadDiskUsage() {
    try { setDiskUsage(await api.maintenance.getDiskUsage()); } catch { /* silent */ }
  }

  async function loadSettings(tab = activeTab, path = selectedProjectPath) {
    setLoading(true);
    try {
      if (tab === "global") {
        setGlobalSettings(await api.settings.read("global"));
      } else if (path) {
        const [proj, local] = await Promise.all([
          api.settings.read("project", path),
          api.settings.read("local", path),
        ]);
        setProjectSettings(proj);
        setLocalSettings(local);
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    } finally {
      setLoading(false);
    }
  }

  async function saveGlobal() {
    setSavingGlobal(true);
    try {
      await api.settings.write("global", globalSettings);
      showSave("Global settings saved!");
    } catch (e) {
      showSave(`Error: ${e}`);
    } finally {
      setSavingGlobal(false);
    }
  }

  async function saveProject() {
    if (!selectedProjectPath) return;
    setSavingProject(true);
    try {
      await api.settings.write("project", projectSettings, selectedProjectPath);
      showSave("Project settings saved!");
    } catch (e) {
      showSave(`Error: ${e}`);
    } finally {
      setSavingProject(false);
    }
  }

  async function saveLocal() {
    if (!selectedProjectPath) return;
    setSavingLocal(true);
    try {
      await api.settings.write("local", localSettings, selectedProjectPath);
      showSave("Local overrides saved!");
    } catch (e) {
      showSave(`Error: ${e}`);
    } finally {
      setSavingLocal(false);
    }
  }

  async function saveBudget() {
    if (!budgetSettings) return;
    try {
      await api.budget.set(
        budgetSettings.daily_limit,
        budgetSettings.monthly_limit,
        budgetSettings.plan_type,
        budgetSettings.quota_ttl_seconds,
      );
      showSave("Felina settings saved!");
    } catch (e) {
      showSave(`Error: ${e}`);
    }
  }

  async function cleanupDir(name: string) {
    setCleaning(name);
    try {
      await api.maintenance.cleanup(name);
      await loadDiskUsage();
      showSave(`Cleaned ${name}!`);
    } catch (e) {
      showSave(`Error: ${e}`);
    } finally {
      setCleaning(null);
    }
  }

  function handleTabChange(tab: "global" | "project") {
    setActiveTab(tab);
    loadSettings(tab);
  }

  useEffect(() => {
    loadSettings();
    loadBudget();
    loadDiskUsage();
  }, []);

  const tabs = [
    { id: "global" as const, label: "Global", hint: "~/.claude/settings.json — applies to all projects" },
    { id: "project" as const, label: "Project", hint: "Per-project settings (shared + local overrides)" },
  ];

  return (
    <div className="p-6 overflow-y-auto h-full">
      <h1 className="text-xl font-semibold text-text-primary mb-4">Settings</h1>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                  activeTab === tab.id
                    ? "bg-bg-secondary text-text-primary"
                    : "text-text-muted hover:text-text-secondary"
                }`}
                onClick={() => handleTabChange(tab.id)}
                title={tab.hint}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {isProjectTab && <ProjectPicker onselect={() => loadSettings()} />}
        </div>
        {saveMessage && (
          <span className={`text-xs ${saveMessage.startsWith("Error") ? "text-danger" : "text-success"}`}>
            {saveMessage}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading...</p>
      ) : activeTab === "global" ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Info size={12} />
              <span className="font-mono">~/.claude/settings.json</span>
              <span>— applies to every project on your machine</span>
            </div>
            <button
              className="px-4 py-1.5 text-sm bg-accent hover:bg-accent-hover text-white rounded-md transition-colors disabled:opacity-50"
              onClick={saveGlobal}
              disabled={savingGlobal}
            >
              {savingGlobal ? "Saving..." : "Save"}
            </button>
          </div>

          {budgetSettings && (
            <div className="bg-bg-secondary border border-border rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
                <CreditCard size={14} />
                Felina Settings
              </h3>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-text-primary">Plan Type</span>
                  <p className="text-xs text-text-muted">Affects how costs are displayed</p>
                </div>
                <select
                  className="w-48 px-3 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary focus:outline-none focus:border-accent"
                  value={budgetSettings.plan_type}
                  onChange={(e) =>
                    setBudgetSettings({ ...budgetSettings, plan_type: e.target.value })
                  }
                >
                  <option value="max">Max Plan ($100/mo — unlimited)</option>
                  <option value="pro">Pro Plan ($20/mo)</option>
                  <option value="api">API (pay per token)</option>
                  <option value="team">Team Plan</option>
                  <option value="free">Free</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-text-primary">Daily Budget Alert</span>
                  <p className="text-xs text-text-muted">Notify when daily API cost exceeds</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-text-muted">$</span>
                  <input
                    type="number"
                    className="w-20 px-2 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary focus:outline-none focus:border-accent"
                    placeholder="—"
                    value={budgetSettings.daily_limit ?? ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setBudgetSettings({ ...budgetSettings, daily_limit: isNaN(val) ? null : val });
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-text-primary">Monthly Budget Alert</span>
                  <p className="text-xs text-text-muted">Notify when monthly API cost exceeds</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-text-muted">$</span>
                  <input
                    type="number"
                    className="w-20 px-2 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary focus:outline-none focus:border-accent"
                    placeholder="—"
                    value={budgetSettings.monthly_limit ?? ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setBudgetSettings({ ...budgetSettings, monthly_limit: isNaN(val) ? null : val });
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-text-primary">Quota Refresh TTL</span>
                  <p className="text-xs text-text-muted">Lower values may hit provider rate limits</p>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0.5}
                    max={60}
                    step={0.5}
                    className="w-20 px-2 py-1.5 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary focus:outline-none focus:border-accent"
                    value={Math.round((budgetSettings.quota_ttl_seconds ?? 180) / 30) / 2}
                    onChange={(e) => {
                      const minutes = parseFloat(e.target.value);
                      const seconds = Number.isFinite(minutes)
                        ? Math.round(Math.min(60, Math.max(0.5, minutes)) * 60)
                        : 180;
                      setBudgetSettings({ ...budgetSettings, quota_ttl_seconds: seconds });
                    }}
                  />
                  <span className="text-sm text-text-muted">min</span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  className="px-4 py-1.5 text-sm bg-accent hover:bg-accent-hover text-white rounded-md transition-colors"
                  onClick={saveBudget}
                >
                  Save Felina Settings
                </button>
              </div>
            </div>
          )}

          <GeneralSettings settings={globalSettings} onChange={setGlobalSettings} />
          <PermissionsEditor settings={globalSettings} onChange={setGlobalSettings} />
          <EnvVarsEditor settings={globalSettings} onChange={setGlobalSettings} />
          {/* Multi-agent-skills-foundation: per-agent skill directory overrides.
              Global only — paths are persisted to ~/.claude/settings.json. */}
          <AgentPathsSection />

          {diskUsage && (
            <div className="bg-bg-secondary border border-border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
                  <HardDrive size={14} />
                  Storage — {diskUsage.total_display}
                </h3>
                <button className="text-xs text-accent hover:text-accent-hover" onClick={loadDiskUsage}>
                  Refresh
                </button>
              </div>

              <div className="space-y-2">
                {diskUsage.entries.map((entry) => (
                  <div
                    key={entry.name}
                    className={`flex items-center justify-between py-1.5 ${entry.safe_to_delete ? "" : "opacity-60"}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-text-primary font-mono">{entry.name}</span>
                        <span className="text-xs text-text-muted">{entry.description}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-medium text-text-secondary">{entry.size_display}</span>
                      {entry.safe_to_delete ? (
                        <button
                          className="flex items-center gap-1 px-2 py-1 text-[10px] bg-danger/10 text-danger rounded hover:bg-danger/20 transition-colors disabled:opacity-50"
                          onClick={() => cleanupDir(entry.name)}
                          disabled={cleaning === entry.name}
                        >
                          <Trash2 size={10} />
                          {cleaning === entry.name ? "..." : "Clean"}
                        </button>
                      ) : (
                        <span className="text-[10px] text-text-muted px-2">protected</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : !selectedProjectPath ? (
        <div className="flex items-center justify-center h-48 text-sm text-text-muted">
          Select a project to edit its settings
        </div>
      ) : (
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
                  Shared Settings
                  <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-info/10 text-info">
                    git tracked
                  </span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5 font-mono">
                  .claude/settings.json — committed to git, shared with team
                </p>
              </div>
              <button
                className="px-4 py-1.5 text-sm bg-accent hover:bg-accent-hover text-white rounded-md transition-colors disabled:opacity-50"
                onClick={saveProject}
                disabled={savingProject}
              >
                {savingProject ? "Saving..." : "Save Shared"}
              </button>
            </div>
            <GeneralSettings settings={projectSettings} onChange={setProjectSettings} />
            <PermissionsEditor settings={projectSettings} onChange={setProjectSettings} />
            <EnvVarsEditor settings={projectSettings} onChange={setProjectSettings} />
          </div>

          <div className="border-t border-border" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
                  Local Overrides
                  <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-warning/10 text-warning">
                    gitignored
                  </span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5 font-mono">
                  .claude/settings.local.json — your machine only, overrides shared
                </p>
              </div>
              <button
                className="px-4 py-1.5 text-sm bg-accent hover:bg-accent-hover text-white rounded-md transition-colors disabled:opacity-50"
                onClick={saveLocal}
                disabled={savingLocal}
              >
                {savingLocal ? "Saving..." : "Save Local"}
              </button>
            </div>
            <GeneralSettings settings={localSettings} onChange={setLocalSettings} />
            <PermissionsEditor settings={localSettings} onChange={setLocalSettings} />
            <EnvVarsEditor settings={localSettings} onChange={setLocalSettings} />
          </div>
        </div>
      )}
    </div>
  );
}
