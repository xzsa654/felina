export type LeaderboardSort = "tokens" | "cost" | "active_days";

export interface LeaderboardEntry {
  rank: number;
  handle: string;
  totalTokens: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
  totalCostUsd: number;
  eventCount?: number;
  activeDays: number;
  topModel: string | null;
  submitCount: number;
  isMe: boolean;
}

export interface LeaderboardAggregates {
  userCount: number;
  totalTokens: number;
  totalCostUsd: number;
}

export interface LeaderboardListResponse {
  entries: LeaderboardEntry[];
  aggregates: LeaderboardAggregates;
}

export interface LeaderboardDaily {
  day: string;
  tokens: number;
  cost: number;
}

export interface LeaderboardModel {
  model: string;
  provider: string | null;
  tokens: number;
  cost: number;
  eventCount: number;
}

export interface SubmitResult {
  rank: number | null;
  submitCount: number;
}
