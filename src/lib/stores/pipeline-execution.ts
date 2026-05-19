import { create } from "zustand";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type NodeStatus = "idle" | "running" | "done" | "error";

export interface NodeResult {
  nodeId: string;
  label: string;
  output: string;
  input: string;
  config: string;
  nodeType: string;
  status: NodeStatus;
  duration: number;
}

export interface RustPipelineFormat {
  id: string;
  name: string;
  nodes: {
    id: string;
    type: string;
    label: string;
    x: number;
    y: number;
    config: Record<string, string>;
  }[];
  connections: { id: string; from_node: string; to_node: string }[];
  created_at: string;
  updated_at: string;
  schedule?: string | null;
  schedule_enabled?: boolean;
}

interface PipelineExecutionStore {
  running: boolean;
  results: NodeResult[];
  nodeStatuses: Record<string, NodeStatus>;
  interactiveNodeId: string | null;
  interactiveNodeLabel: string | null;
  _set: (partial: Partial<Omit<PipelineExecutionStore, "_set">>) => void;
}

export const usePipelineExecutionStore = create<PipelineExecutionStore>(
  (set) => ({
    running: false,
    results: [],
    nodeStatuses: {},
    interactiveNodeId: null,
    interactiveNodeLabel: null,
    _set: (partial) => set(partial as Parameters<typeof set>[0]),
  }),
);

// Non-reactive terminal state (managed manually)
let interactiveSessionId: string | null = null;
let pipelineTerminal: Terminal | null = null;
let pipelineFitAddon: FitAddon | null = null;
let pipelineTermContainerEl: HTMLDivElement | null = null;
let eventUnlisten: UnlistenFn | null = null;
let unlistenTermOutput: UnlistenFn | null = null;
let unlistenTermExit: UnlistenFn | null = null;
let pendingSpawn: {
  sessionId: string;
  workingDir: string;
  prompt: string;
  skipPerms: boolean;
} | null = null;
let ptySpawned = false;

const TERM_THEME = {
  background: "#0d1117",
  foreground: "#e6edf3",
  cursor: "#c084fc",
  selectionBackground: "#c084fc40",
  black: "#0d1117",
  red: "#f85149",
  green: "#3fb950",
  yellow: "#d29922",
  blue: "#58a6ff",
  magenta: "#c084fc",
  cyan: "#39d353",
  white: "#e6edf3",
  brightBlack: "#8b949e",
  brightRed: "#f85149",
  brightGreen: "#3fb950",
  brightYellow: "#d29922",
  brightBlue: "#58a6ff",
  brightMagenta: "#c084fc",
  brightCyan: "#39d353",
  brightWhite: "#ffffff",
};

export function hasTerminal(): boolean {
  return pipelineTermContainerEl !== null;
}

function startInteractiveTerminal(
  sessionId: string,
  prompt: string,
  workingDir: string,
  skipPerms: boolean,
) {
  if (pipelineTerminal) fullDispose();

  interactiveSessionId = sessionId;

  const term = new Terminal({
    cursorBlink: true,
    fontSize: 11,
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
    theme: TERM_THEME,
    allowProposedApi: true,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);

  term.onData((data) => {
    const encoded = btoa(data);
    invoke("write_terminal", { id: sessionId, data: encoded }).catch(() => {});
  });

  term.onResize(({ cols, rows }) => {
    invoke("resize_terminal", { id: sessionId, cols, rows }).catch(() => {});
  });

  const containerEl = document.createElement("div");
  containerEl.style.width = "100%";
  containerEl.style.height = "100%";
  containerEl.style.padding = "4px";
  containerEl.style.boxSizing = "border-box";
  containerEl.style.position = "absolute";
  containerEl.style.left = "-9999px";
  document.body.appendChild(containerEl);
  term.open(containerEl);

  pipelineTerminal = term;
  pipelineFitAddon = fit;
  pipelineTermContainerEl = containerEl;

  listen<{ id: string; data: string }>("terminal-output", (event) => {
    if (
      event.payload.id === interactiveSessionId &&
      pipelineTerminal
    ) {
      const bytes = Uint8Array.from(atob(event.payload.data), (c) =>
        c.charCodeAt(0),
      );
      pipelineTerminal.write(bytes);
    }
  }).then((fn) => {
    unlistenTermOutput = fn;
  });

  listen<{ id: string }>("terminal-exit", (event) => {
    if (event.payload.id === interactiveSessionId) {
      invoke("resume_pipeline_node", {
        output: "(interactive session completed)",
      }).catch(console.error);
      fullDispose();
    }
  }).then((fn) => {
    unlistenTermExit = fn;
  });

  pendingSpawn = { sessionId, workingDir, prompt, skipPerms };
  ptySpawned = false;
}

function fullDispose() {
  unlistenTermOutput?.();
  unlistenTermExit?.();
  unlistenTermOutput = null;
  unlistenTermExit = null;
  pipelineTerminal?.dispose();
  pipelineTerminal = null;
  pipelineFitAddon = null;
  pipelineTermContainerEl?.remove();
  pipelineTermContainerEl = null;
  interactiveSessionId = null;
  pendingSpawn = null;
  ptySpawned = false;
  usePipelineExecutionStore.getState()._set({
    interactiveNodeId: null,
    interactiveNodeLabel: null,
  });
}

export async function startPipelineRun(pipeline: RustPipelineFormat) {
  usePipelineExecutionStore.getState()._set({
    running: true,
    results: [],
    nodeStatuses: {},
  });
  fullDispose();

  if (eventUnlisten) eventUnlisten();
  eventUnlisten = await listen<Record<string, string>>(
    "pipeline-event",
    (event) => {
      const d = event.payload;
      const store = usePipelineExecutionStore.getState();
      if (d.type === "started") {
        store._set({
          results: [
            ...store.results,
            {
              nodeId: "",
              label: "Pipeline",
              output: d.message ?? "Started",
              input: "",
              config: "",
              nodeType: "",
              status: "done" as NodeStatus,
              duration: 0,
            },
          ],
        });
      } else if (d.type === "node_interactive_start") {
        store._set({
          interactiveNodeId: d.node_id,
          interactiveNodeLabel: d.label ?? "Claude",
          nodeStatuses: { ...store.nodeStatuses, [d.node_id]: "running" },
          results: [
            ...store.results.filter(
              (r) => !(r.nodeId === d.node_id && r.status === "running"),
            ),
            {
              nodeId: d.node_id,
              label: d.label ?? "",
              output: "Interactive — waiting for user...",
              input: "",
              config: "",
              nodeType: "claude",
              status: "running" as NodeStatus,
              duration: 0,
            },
          ],
        });
        startInteractiveTerminal(
          d.session_id,
          d.prompt,
          d.working_dir,
          d.dangerously_skip_permissions === "true",
        );
      } else if (d.type === "node_start") {
        store._set({
          nodeStatuses: { ...store.nodeStatuses, [d.node_id]: "running" },
          results: [
            ...store.results,
            {
              nodeId: d.node_id,
              label: d.label ?? "",
              output: "Running...",
              input: d.input ?? "",
              config: d.config ?? "",
              nodeType: d.node_type ?? "",
              status: "running" as NodeStatus,
              duration: 0,
            },
          ],
        });
      } else if (d.type === "node_done") {
        const idx = store.results.findIndex(
          (r) => r.nodeId === d.node_id && r.status === "running",
        );
        const updated = [...store.results];
        if (idx >= 0) {
          updated[idx] = {
            ...updated[idx],
            output: d.output || "(empty)",
            status: "done",
            duration: parseInt(d.duration ?? "0"),
          };
        } else {
          updated.push({
            nodeId: d.node_id,
            label: d.label ?? "",
            output: d.output || "(empty)",
            input: "",
            config: "",
            nodeType: "",
            status: "done",
            duration: parseInt(d.duration ?? "0"),
          });
        }
        store._set({
          nodeStatuses: { ...store.nodeStatuses, [d.node_id]: "done" },
          results: updated,
        });
      } else if (d.type === "node_error") {
        const idx = store.results.findIndex(
          (r) => r.nodeId === d.node_id && r.status === "running",
        );
        const updated = [...store.results];
        if (idx >= 0) {
          updated[idx] = {
            ...updated[idx],
            output: d.output ?? "Error",
            status: "error",
            duration: parseInt(d.duration ?? "0"),
          };
        } else {
          updated.push({
            nodeId: d.node_id,
            label: d.label ?? "",
            output: d.output ?? "Error",
            input: "",
            config: "",
            nodeType: "",
            status: "error",
            duration: parseInt(d.duration ?? "0"),
          });
        }
        store._set({
          nodeStatuses: { ...store.nodeStatuses, [d.node_id]: "error" },
          results: updated,
        });
        fullDispose();
      } else if (d.type === "completed" || d.type === "cancelled") {
        store._set({
          running: false,
          results: [
            ...store.results,
            {
              nodeId: "",
              label: "Pipeline",
              output: d.message ?? d.type,
              input: "",
              config: "",
              nodeType: "",
              status: "done" as NodeStatus,
              duration: 0,
            },
          ],
        });
        fullDispose();
        if (eventUnlisten) {
          eventUnlisten();
          eventUnlisten = null;
        }
      }
    },
  );

  try {
    await invoke("start_pipeline_run", { pipeline });
  } catch (e) {
    usePipelineExecutionStore.getState()._set({
      running: false,
      results: [
        ...usePipelineExecutionStore.getState().results,
        {
          nodeId: "",
          label: "Error",
          output: `${e}`,
          input: "",
          config: "",
          nodeType: "",
          status: "error" as NodeStatus,
          duration: 0,
        },
      ],
    });
    fullDispose();
  }
}

export async function cancelPipelineRun() {
  await invoke("cancel_pipeline_run");
}

export function clearResults() {
  usePipelineExecutionStore.getState()._set({ results: [], nodeStatuses: {} });
}

export function attachTerminal(parentEl: HTMLDivElement) {
  if (pipelineTermContainerEl) {
    pipelineTermContainerEl.style.position = "relative";
pipelineTermContainerEl.style.left = "0";
    parentEl.appendChild(pipelineTermContainerEl);
    requestAnimationFrame(() => {
      pipelineFitAddon?.fit();
      if (pendingSpawn && !ptySpawned) {
        ptySpawned = true;
        const { sessionId, workingDir, prompt, skipPerms } = pendingSpawn;
        const cols = pipelineTerminal?.cols ?? 40;
        const rows = pipelineTerminal?.rows ?? 20;
        invoke("spawn_terminal", {
          id: sessionId,
          path: workingDir,
          cols,
          rows,
          prompt,
          dangerouslySkipPermissions: skipPerms || null,
        }).catch(console.error);
        pendingSpawn = null;
      }
    });
  }
}

export function detachTerminal() {
  if (pipelineTermContainerEl) {
    pipelineTermContainerEl.style.position = "absolute";
    pipelineTermContainerEl.style.left = "-9999px";
    document.body.appendChild(pipelineTermContainerEl);
  }
}
