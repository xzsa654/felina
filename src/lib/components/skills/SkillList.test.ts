import { describe, it, expect } from "vitest";
import {
  sortRank,
  agentScopeMap,
  filterEntriesByQuery,
} from "./SkillList";
import type {
  AgentId,
  CanonicalSkill,
  SkillListEntry,
  SkillTarget,
} from "$lib/types";

function makeSkill(partial: Partial<CanonicalSkill> & { name: string }): CanonicalSkill {
  return {
    canonicalId: partial.canonicalId ?? partial.name,
    name: partial.name,
    description: partial.description ?? "",
    agents: partial.agents ?? [],
    frontmatterExtras: {},
    body: "",
    dirty: partial.dirty ?? false,
    lastSynced: null,
    targets: partial.targets ?? [],
    lastSync: {},
    agentFields: {},
    siblingsDirty: false,
  };
}

function okEntry(skill: CanonicalSkill): SkillListEntry {
  return { kind: "ok", canonicalId: skill.canonicalId, skill };
}

function brokenEntry(name: string): SkillListEntry {
  return { kind: "broken", canonicalId: name, name, path: `${name}.md`, error: "x" };
}

function tgt(
  agent: AgentId,
  scope: "global" | "project",
  opts: Partial<SkillTarget> = {},
): SkillTarget {
  return {
    agent,
    scope,
    project: scope === "project" ? (opts.project ?? "/p1") : undefined,
    enabled: opts.enabled ?? true,
    mode: opts.mode ?? "manual",
  };
}

describe("sortRank", () => {
  it("rank 0 for broken entry", () => {
    expect(sortRank(brokenEntry("x"), false)).toBe(0);
  });
  it("rank 0 for drifted ok entry", () => {
    expect(sortRank(okEntry(makeSkill({ name: "x", targets: [tgt("anthropic", "global")] })), true)).toBe(0);
  });
  it("rank 1 for dirty entry (and not drifted/broken)", () => {
    expect(
      sortRank(okEntry(makeSkill({ name: "x", dirty: true, targets: [tgt("anthropic", "global")] })), false),
    ).toBe(1);
  });
  it("rank 2 for entry with zero targets", () => {
    expect(sortRank(okEntry(makeSkill({ name: "x", targets: [] })), false)).toBe(2);
  });
  it("rank 2 when all targets are disabled", () => {
    expect(
      sortRank(
        okEntry(
          makeSkill({
            name: "x",
            targets: [tgt("anthropic", "global", { enabled: false })],
          }),
        ),
        false,
      ),
    ).toBe(2);
  });
  it("rank 3 for clean entry with targets", () => {
    expect(
      sortRank(okEntry(makeSkill({ name: "x", targets: [tgt("anthropic", "global")] })), false),
    ).toBe(3);
  });
});

describe("agentScopeMap", () => {
  it("single global target", () => {
    const m = agentScopeMap([tgt("anthropic", "global")]);
    expect(m.get("anthropic")).toEqual({ global: true, project: false });
  });
  it("mixed scope same agent collapses project duplicates", () => {
    const m = agentScopeMap([
      tgt("anthropic", "global"),
      tgt("anthropic", "project", { project: "/p1" }),
      tgt("anthropic", "project", { project: "/p2" }),
    ]);
    expect(m.get("anthropic")).toEqual({ global: true, project: true });
    expect(m.size).toBe(1);
  });
  it("multi-agent mixed scope", () => {
    const m = agentScopeMap([
      tgt("anthropic", "global"),
      tgt("codex", "project", { project: "/p1" }),
    ]);
    expect(m.get("anthropic")).toEqual({ global: true, project: false });
    expect(m.get("codex")).toEqual({ global: false, project: true });
  });
  it("disabled / detached / forked excluded", () => {
    const m = agentScopeMap([
      tgt("anthropic", "global", { enabled: false }),
      tgt("anthropic", "project", { project: "/p1", mode: "detached" }),
      tgt("anthropic", "project", { project: "/p2", mode: "forked" }),
      tgt("anthropic", "project", { project: "/p3" }),
    ]);
    expect(m.get("anthropic")).toEqual({ global: false, project: true });
  });
});

describe("filterEntriesByQuery", () => {
  const alpha = okEntry(makeSkill({ name: "alpha", description: "" }));
  const beta = okEntry(makeSkill({ name: "beta-tester", description: "" }));
  const gamma = okEntry(makeSkill({ name: "gamma", description: "" }));
  const foo = okEntry(makeSkill({ name: "foo", description: "handles bar parsing" }));

  it("name substring match (case-insensitive)", () => {
    expect(filterEntriesByQuery([alpha, beta, gamma], "BET").map((e) => entryName(e))).toEqual([
      "beta-tester",
    ]);
  });
  it("empty query restores all", () => {
    expect(filterEntriesByQuery([alpha, beta, gamma], "")).toEqual([alpha, beta, gamma]);
  });
  it("description substring match", () => {
    expect(filterEntriesByQuery([foo, alpha], "bar").map((e) => entryName(e))).toEqual(["foo"]);
  });
});

function entryName(e: SkillListEntry): string {
  return e.kind === "ok" ? e.skill.name : e.name;
}
