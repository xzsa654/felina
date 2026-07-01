export type JesseAssistantAction = "summary" | "explain" | "plan";

export type JesseAssistantProvider = "codex" | "claude";

export type JesseContextKind =
  | "token-overview"
  | "top-session"
  | "model-breakdown"
  | "quota-snapshot"
  | "skill"
  | "project"
  | "memory-entry"
  | "history-session"
  | "hub-item"
  | "app";

export type JesseMetricValue = string | number | boolean | null;

export interface JesseContextRow {
  label: string;
  metrics?: Record<string, JesseMetricValue>;
  note?: string;
}

export interface JesseContextBase {
  kind: JesseContextKind;
  title: string;
  source: string;
  capturedAt: string;
  summary: string;
}

export interface JesseMetricsContext extends JesseContextBase {
  kind:
    | "token-overview"
    | "top-session"
    | "quota-snapshot"
    | "skill"
    | "project"
    | "memory-entry"
    | "history-session"
    | "hub-item"
    | "app";
  metrics: Record<string, JesseMetricValue>;
  rows?: never;
}

export interface JesseRowsContext extends JesseContextBase {
  kind: "model-breakdown";
  rows: JesseContextRow[];
  metrics?: Record<string, JesseMetricValue>;
}

export type JesseContextPayload = JesseMetricsContext | JesseRowsContext;

export interface JesseAssistantRequest {
  provider: JesseAssistantProvider;
  action: JesseAssistantAction;
  context: JesseContextPayload;
}

export interface JesseChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface JesseChatRequest {
  provider: JesseAssistantProvider;
  context: JesseContextPayload;
  messages: JesseChatMessage[];
}

export interface JesseAssistantResponse {
  markdown: string;
  provider: JesseAssistantProvider;
  model: string;
  generated_at: string;
}
