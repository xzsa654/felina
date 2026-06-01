import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deriveStagingStatus,
  createStagingItem,
  resolveStagingConflict,
  selectSource,
  hasUnresolved,
} from "$lib/components/skills/import/staging-logic";
import type { ImportCandidate } from "$lib/types";

function makeCandidate(name: string): ImportCandidate {
  return {
    sourcePath: `/fake/${name}/SKILL.md`,
    sourceAgent: "anthropic",
    skillName: name,
    bodyPreview: "",
    conflict: null,
    deferred: null,
  };
}

function makeDeferredCandidate(name: string): ImportCandidate {
  return {
    sourcePath: "",
    sourceAgent: "anthropic",
    skillName: name,
    bodyPreview: "",
    conflict: null,
    deferred: {
      agents: ["anthropic", "codex"],
      candidates: [
        { sourcePath: `/claude/${name}/SKILL.md`, sourceAgent: "anthropic", skillName: name, bodyPreview: "", conflict: null, deferred: null },
        { sourcePath: `/codex/${name}/SKILL.md`, sourceAgent: "codex", skillName: name, bodyPreview: "", conflict: null, deferred: null },
      ],
      reason: "Found in multiple agent directories",
    },
  };
}

describe("deriveStagingStatus", () => {
  it("returns ready when no collision and not deferred", () => {
    assert.equal(deriveStagingStatus("new-skill", new Set(["other"]), false), "ready");
  });

  it("returns conflict when name exists and not deferred", () => {
    assert.equal(deriveStagingStatus("existing", new Set(["existing"]), false), "conflict");
  });

  it("returns pending-source when deferred", () => {
    assert.equal(deriveStagingStatus("any", new Set(), true), "pending-source");
  });
});

describe("createStagingItem", () => {
  it("creates ready item for non-conflicting candidate", () => {
    const item = createStagingItem(makeCandidate("fresh"), new Set());
    assert.equal(item.status, "ready");
    assert.equal(item.selectedSourceIndex, null);
  });

  it("creates conflict item for colliding candidate", () => {
    const item = createStagingItem(makeCandidate("taken"), new Set(["taken"]));
    assert.equal(item.status, "conflict");
  });

  it("creates pending-source for deferred candidate", () => {
    const item = createStagingItem(makeDeferredCandidate("multi"), new Set());
    assert.equal(item.status, "pending-source");
    assert.equal(item.selectedSourceIndex, null);
  });
});

describe("selectSource", () => {
  it("transitions from pending-source to ready", () => {
    const item = createStagingItem(makeDeferredCandidate("multi"), new Set());
    const selected = selectSource(item, 1, new Set());
    assert.equal(selected.status, "ready");
    assert.equal(selected.selectedSourceIndex, 1);
  });

  it("transitions to conflict if name collides after source selection", () => {
    const item = createStagingItem(makeDeferredCandidate("dup"), new Set(["dup"]));
    const selected = selectSource(item, 0, new Set(["dup"]));
    assert.equal(selected.status, "conflict");
    assert.equal(selected.selectedSourceIndex, 0);
  });
});

describe("resolveStagingConflict", () => {
  it("resolves with overwrite", () => {
    const item = createStagingItem(makeCandidate("dup"), new Set(["dup"]));
    const resolved = resolveStagingConflict(item, "overwrite");
    assert.equal(resolved.status, "ready");
    assert.equal(resolved.resolution, "overwrite");
  });

  it("resolves with rename", () => {
    const item = createStagingItem(makeCandidate("dup"), new Set(["dup"]));
    const resolved = resolveStagingConflict(item, "rename", "dup-v2");
    assert.equal(resolved.status, "ready");
    assert.equal(resolved.resolvedName, "dup-v2");
  });
});

describe("hasUnresolved", () => {
  it("returns false for all-ready items", () => {
    assert.equal(hasUnresolved([createStagingItem(makeCandidate("a"), new Set())]), false);
  });

  it("returns true for unresolved conflict", () => {
    assert.equal(hasUnresolved([createStagingItem(makeCandidate("x"), new Set(["x"]))]), true);
  });

  it("returns true for pending-source", () => {
    assert.equal(hasUnresolved([createStagingItem(makeDeferredCandidate("m"), new Set())]), true);
  });

  it("returns false after source selected and no conflict", () => {
    const item = selectSource(createStagingItem(makeDeferredCandidate("m"), new Set()), 0, new Set());
    assert.equal(hasUnresolved([item]), false);
  });

  it("returns false after conflict resolved", () => {
    const item = resolveStagingConflict(createStagingItem(makeCandidate("x"), new Set(["x"])), "overwrite");
    assert.equal(hasUnresolved([item]), false);
  });
});
