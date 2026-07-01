import type {
  JesseContextKind,
  JesseContextPayload,
  JesseContextRow,
  JesseMetricValue,
} from "$lib/types/assistant";

const JESSE_CONTEXT_KINDS = new Set<JesseContextKind>([
  "token-overview",
  "top-session",
  "model-breakdown",
  "quota-snapshot",
  "skill",
  "project",
  "memory-entry",
  "history-session",
  "hub-item",
  "app",
]);

export const JESSE_CONTEXT_MIME = "application/x-felina-jesse-context+json";
const JESSE_CONTEXT_VERSION = 1;
const MAX_ROWS = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMetricValue(value: unknown): value is JesseMetricValue {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function cleanMetrics(value: unknown): Record<string, JesseMetricValue> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value).filter((entry): entry is [string, JesseMetricValue] =>
    typeof entry[0] === "string" && isMetricValue(entry[1]),
  );
  return Object.fromEntries(entries);
}

function cleanRows(value: unknown): JesseContextRow[] | null {
  if (!Array.isArray(value)) return null;
  const rows: JesseContextRow[] = [];
  for (const item of value.slice(0, MAX_ROWS)) {
    if (!isRecord(item) || typeof item.label !== "string" || !item.label.trim()) {
      return null;
    }
    const row: JesseContextRow = { label: item.label };
    const metrics = cleanMetrics(item.metrics);
    if (metrics) row.metrics = metrics;
    if (typeof item.note === "string") row.note = item.note;
    rows.push(row);
  }
  return rows;
}

export function isJesseContextPayload(value: unknown): value is JesseContextPayload {
  if (!isRecord(value)) return false;
  if (
    typeof value.kind !== "string" ||
    !JESSE_CONTEXT_KINDS.has(value.kind as JesseContextKind) ||
    typeof value.title !== "string" ||
    !value.title.trim() ||
    typeof value.source !== "string" ||
    !value.source.trim() ||
    typeof value.capturedAt !== "string" ||
    !value.capturedAt.trim() ||
    typeof value.summary !== "string"
  ) {
    return false;
  }

  if (value.kind === "model-breakdown") {
    const rows = cleanRows(value.rows);
    return rows !== null;
  }

  return cleanMetrics(value.metrics) !== null;
}

export function normalizeJesseContextPayload(
  payload: JesseContextPayload,
): JesseContextPayload {
  const base = {
    kind: payload.kind,
    title: payload.title.trim(),
    source: payload.source.trim(),
    capturedAt: payload.capturedAt,
    summary: payload.summary.trim(),
  };

  if (payload.kind === "model-breakdown") {
    const rows = cleanRows(payload.rows) ?? [];
    return {
      ...base,
      kind: "model-breakdown",
      rows,
      metrics: cleanMetrics(payload.metrics) ?? undefined,
    };
  }

  return {
    ...base,
    kind: payload.kind,
    metrics: cleanMetrics(payload.metrics) ?? {},
  };
}

export function buildJesseContextDragData(payload: JesseContextPayload): string {
  return JSON.stringify({
    felinaJesseContextVersion: JESSE_CONTEXT_VERSION,
    payload: normalizeJesseContextPayload(payload),
  });
}

function createJesseDragImage(label: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const ghost = document.createElement("div");
  ghost.textContent = label;
  ghost.style.position = "fixed";
  ghost.style.top = "-1000px";
  ghost.style.left = "-1000px";
  ghost.style.maxWidth = "260px";
  ghost.style.padding = "8px 12px";
  ghost.style.border = "2px dashed rgba(244, 114, 182, 0.9)";
  ghost.style.borderRadius = "8px";
  ghost.style.background = "rgba(244, 114, 182, 0.14)";
  ghost.style.color = "rgb(244, 244, 245)";
  ghost.style.font = "600 12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ghost.style.whiteSpace = "nowrap";
  ghost.style.overflow = "hidden";
  ghost.style.textOverflow = "ellipsis";
  ghost.style.boxShadow = "0 10px 24px rgba(0, 0, 0, 0.24)";
  ghost.style.pointerEvents = "none";
  document.body.appendChild(ghost);
  return ghost;
}

export function setJesseContextDragData(
  dataTransfer: DataTransfer,
  dragData: string,
  label: string,
) {
  dataTransfer.setData("text/plain", dragData);
  dataTransfer.setData(JESSE_CONTEXT_MIME, dragData);
  dataTransfer.effectAllowed = "copy";

  const ghost = createJesseDragImage(label);
  if (!ghost) return;
  dataTransfer.setDragImage(ghost, 14, 14);
  window.setTimeout(() => ghost.remove(), 0);
}

export function parseJesseContextDragData(raw: string): JesseContextPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.felinaJesseContextVersion !== JESSE_CONTEXT_VERSION) {
      return null;
    }
    if (!isJesseContextPayload(parsed.payload)) return null;
    return normalizeJesseContextPayload(parsed.payload);
  } catch {
    return null;
  }
}
