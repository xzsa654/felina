import assert from "node:assert/strict";
import test from "node:test";

import { buildInventoryRows } from "../src/lib/components/projects/managed-inventory.ts";

const projectA = "C:/work/projectA";
const projectB = "D:/work/projectB";

function candidate(overrides = {}) {
  return {
    sourcePath: "C:/work/projectA/.claude/skills/foo/SKILL.md",
    sourceAgent: "anthropic",
    skillName: "foo",
    bodyPreview: "local preview",
    conflict: null,
    deferred: null,
    ...overrides,
  };
}

function canonical(name, targets = []) {
  return {
    kind: "ok",
    canonicalId: name,
    skill: {
      canonicalId: name,
      name,
      description: "",
      agents: [],
      frontmatterExtras: {},
      body: "",
      dirty: false,
      lastSynced: null,
      targets,
      lastSync: {},
      agentFields: {},
      siblingsDirty: false,
    },
  };
}

test("local detected sources and Felina targets stay on separate axes", () => {
  const rows = buildInventoryRows(projectA, [candidate()], [
    canonical("foo", [
      { agent: "codex", scope: "global", enabled: true, mode: "manual" },
    ]),
  ]);

  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.managed, false);
  assert.equal(row.relationship, "canonicalGlobalOnly");
  assert.deepEqual(row.detectedSources.map((s) => s.agents), [["anthropic"]]);
  assert.deepEqual(row.felinaTargets.map((t) => [t.agent, t.scope]), [
    ["codex", "global"],
  ]);
});

test("targets for other projects are excluded from selected project coverage", () => {
  const rows = buildInventoryRows(projectA, [candidate()], [
    canonical("foo", [
      {
        agent: "gemini",
        scope: "project",
        project: projectB,
        enabled: true,
        mode: "manual",
      },
    ]),
  ]);

  const row = rows[0];
  assert.equal(row.managed, false);
  assert.equal(row.relationship, "canonicalExistsUnlinked");
  assert.deepEqual(row.felinaTargets, []);
});

test("selected project enabled target makes a row managed", () => {
  const rows = buildInventoryRows(projectA, [candidate()], [
    canonical("foo", [
      {
        agent: "anthropic",
        scope: "project",
        project: projectA,
        enabled: true,
        mode: "manual",
      },
    ]),
  ]);

  const row = rows[0];
  assert.equal(row.managed, true);
  assert.equal(row.relationship, "managedProject");
  assert.deepEqual(row.felinaTargets.map((t) => [t.agent, t.scope, t.project]), [
    ["anthropic", "project", projectA],
  ]);
});

test("global canonical coverage is a resolution state instead of import primary", () => {
  const rows = buildInventoryRows(projectA, [candidate({ skillName: "global-match" })], [
    canonical("global-match", [
      { agent: "codex", scope: "global", enabled: true, mode: "manual" },
    ]),
  ]);

  const row = rows[0];
  assert.equal(row.relationship, "canonicalGlobalOnly");
  assert.equal(row.canonicalExists, true);
  assert.equal(row.managed, false);
});

test("multi-source candidates with the same physical path group by source path and keep attribution indexes", () => {
  const sharedPath = "C:/work/projectA/.agents/skills/foo/SKILL.md";
  const rows = buildInventoryRows(projectA, [
    candidate({
      sourcePath: sharedPath,
      sourceAgent: "codex",
      deferred: {
        agents: ["codex", "gemini"],
        reason: "same skill name found in multiple sources",
        candidates: [
          candidate({ sourcePath: sharedPath, sourceAgent: "codex" }),
          candidate({
            sourcePath: "C:\\work\\projectA\\.agents\\skills\\foo\\SKILL.md",
            sourceAgent: "gemini",
          }),
        ],
      },
    }),
  ], []);

  const row = rows[0];
  assert.equal(row.relationship, "localOnly");
  assert.equal(row.detectedSources.length, 1);
  assert.equal(row.detectedSources[0].sourcePath, sharedPath);
  assert.deepEqual(row.detectedSources[0].agents, ["codex", "gemini"]);
  assert.deepEqual(
    row.detectedSources[0].attributions.map((a) => [a.agent, a.sourceIndex]),
    [
      ["codex", 0],
      ["gemini", 1],
    ],
  );
});

test("multi-source candidates with different physical paths remain separate", () => {
  const rows = buildInventoryRows(projectA, [
    candidate({
      sourceAgent: "anthropic",
      deferred: {
        agents: ["anthropic", "codex"],
        reason: "same skill name found in multiple sources",
        candidates: [
          candidate({
            sourcePath: "C:/work/projectA/.claude/skills/foo/SKILL.md",
            sourceAgent: "anthropic",
          }),
          candidate({
            sourcePath: "C:/work/projectA/.agents/skills/foo/SKILL.md",
            sourceAgent: "codex",
          }),
        ],
      },
    }),
  ], []);

  const row = rows[0];
  assert.equal(row.detectedSources.length, 2);
  assert.deepEqual(row.detectedSources.map((s) => s.agents), [["anthropic"], ["codex"]]);
});
