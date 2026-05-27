import assert from "node:assert/strict";
import test from "node:test";

import { getImportConflictWarning, hasImportConflict } from "../src/lib/components/skills/import-conflict-warning.ts";

const canonicalPath = "C:\\Users\\A11410004\\.felina\\skills\\session-update\\SKILL.md";

const groupedCandidate = {
  sourcePath: "C:\\Users\\A11410004\\.claude\\skills\\session-update\\SKILL.md",
  sourceAgent: "anthropic",
  skillName: "session-update",
  bodyPreview: "anthropic preview",
  conflict: {
    canonicalPath,
    canonicalBodyPreview: "canonical preview",
    diffSummary: "representative summary",
  },
  deferred: {
    agents: ["anthropic", "codex"],
    reason: "same skill name found in multiple sources",
    candidates: [
      {
        sourcePath: "C:\\Users\\A11410004\\.claude\\skills\\session-update\\SKILL.md",
        sourceAgent: "anthropic",
        skillName: "session-update",
        bodyPreview: "anthropic preview",
        conflict: {
          canonicalPath,
          canonicalBodyPreview: "canonical preview",
          diffSummary: "source: 219 lines / 12503 bytes; canonical: 221 lines / 12519 bytes",
        },
        deferred: null,
      },
      {
        sourcePath: "C:\\Users\\A11410004\\.agents\\skills\\session-update\\SKILL.md",
        sourceAgent: "codex",
        skillName: "session-update",
        bodyPreview: "codex preview",
        conflict: {
          canonicalPath,
          canonicalBodyPreview: "canonical preview",
          diffSummary: "source: 200 lines / 11000 bytes; canonical: 221 lines / 12519 bytes",
        },
        deferred: null,
      },
    ],
  },
};

test("multi-source canonical conflict prompts for source before comparing", () => {
  const warning = getImportConflictWarning(groupedCandidate, null);

  assert.equal(warning?.canonicalPath, canonicalPath);
  assert.equal(warning?.requiresSourceSelection, true);
  assert.equal(warning?.diffSummary, null);
});

test("multi-source canonical conflict follows the selected source diff summary", () => {
  const anthropicWarning = getImportConflictWarning(groupedCandidate, 0);
  const codexWarning = getImportConflictWarning(groupedCandidate, 1);

  assert.match(anthropicWarning?.diffSummary ?? "", /219 lines/);
  assert.match(codexWarning?.diffSummary ?? "", /200 lines/);
});

test("multi-source conflict detection does not depend on the representative candidate", () => {
  const candidateWithOnlyPerSourceConflict = {
    ...groupedCandidate,
    conflict: null,
  };

  assert.equal(hasImportConflict(candidateWithOnlyPerSourceConflict), true);
});
