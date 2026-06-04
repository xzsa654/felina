import assert from "node:assert/strict";
import test from "node:test";

import { classifyTarget, isCascadeEligible, targetKey, STATUS_CONFIG, STATUS_ORDER } from "../src/lib/components/skills/sync-status-utils.ts";
import type { SkillTarget } from "../src/lib/types/index.ts";

const globalTarget: SkillTarget = {
  agent: "claude",
  scope: "global",
  enabled: true,
  mode: "tracked",
};

const projectTarget: SkillTarget = {
  agent: "gemini",
  scope: "project",
  project: "C:/Users/dev/myapp",
  enabled: true,
  mode: "tracked",
};

const knownProjects = [
  { path: "C:/Users/dev/myapp", exists: true },
  { path: "C:/Users/dev/deleted-app", exists: false },
];

const syncEntry = { pushedHash: "abc123", at: "2026-06-01T10:30:00Z" };

test("targetKey: global target", () => {
  assert.equal(targetKey(globalTarget), "claude:global");
});

test("targetKey: project target", () => {
  assert.equal(targetKey(projectTarget), "gemini:project:C:/Users/dev/myapp");
});

test("classifyTarget: synced — global target with lastSync entry", () => {
  assert.equal(classifyTarget(globalTarget, syncEntry, knownProjects), "synced");
});

test("classifyTarget: pending — global target without lastSync entry", () => {
  assert.equal(classifyTarget(globalTarget, undefined, knownProjects), "pending");
});

test("classifyTarget: synced — project target with existing project and lastSync", () => {
  assert.equal(classifyTarget(projectTarget, syncEntry, knownProjects), "synced");
});

test("classifyTarget: pending — project target with existing project but no lastSync", () => {
  assert.equal(classifyTarget(projectTarget, undefined, knownProjects), "pending");
});

test("classifyTarget: missing — project target whose project does not exist", () => {
  const missingProjectTarget: SkillTarget = {
    agent: "codex",
    scope: "project",
    project: "C:/Users/dev/deleted-app",
    enabled: true,
    mode: "tracked",
  };
  assert.equal(classifyTarget(missingProjectTarget, syncEntry, knownProjects), "missing");
});

test("classifyTarget: pending — project target not in knownProjects at all", () => {
  const unknownProjectTarget: SkillTarget = {
    agent: "codex",
    scope: "project",
    project: "C:/Users/dev/unknown-app",
    enabled: true,
    mode: "tracked",
  };
  assert.equal(classifyTarget(unknownProjectTarget, undefined, knownProjects), "pending");
});

test("STATUS_ORDER has all three statuses", () => {
  assert.deepEqual(STATUS_ORDER, ["synced", "pending", "missing"]);
});

test("STATUS_CONFIG has entries for all statuses", () => {
  for (const status of STATUS_ORDER) {
    assert.ok(STATUS_CONFIG[status].icon);
    assert.ok(STATUS_CONFIG[status].chipClass);
  }
});

test("isCascadeEligible: enabled auto → true", () => {
  assert.equal(isCascadeEligible({ agent: "claude", scope: "global", enabled: true, mode: "auto" }), true);
});

test("isCascadeEligible: enabled manual → true", () => {
  assert.equal(isCascadeEligible({ agent: "claude", scope: "global", enabled: true, mode: "manual" }), true);
});

test("isCascadeEligible: enabled tracked (legacy) → true", () => {
  assert.equal(isCascadeEligible({ agent: "claude", scope: "global", enabled: true, mode: "tracked" }), true);
});

test("isCascadeEligible: disabled auto → false", () => {
  assert.equal(isCascadeEligible({ agent: "claude", scope: "global", enabled: false, mode: "auto" }), false);
});

test("isCascadeEligible: enabled detached → false", () => {
  assert.equal(isCascadeEligible({ agent: "claude", scope: "global", enabled: true, mode: "detached" }), false);
});

test("isCascadeEligible: enabled forked → false", () => {
  assert.equal(isCascadeEligible({ agent: "claude", scope: "global", enabled: true, mode: "forked" }), false);
});
