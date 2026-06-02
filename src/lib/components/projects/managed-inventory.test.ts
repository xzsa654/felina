import { describe, it, expect } from "vitest";
import {
  resolutionOptionsFor,
  type InventoryRow,
  type InventoryRelationship,
} from "./managed-inventory";

function rowWith(relationship: InventoryRelationship): InventoryRow {
  return {
    skillName: "x",
    managed: false,
    relationship,
    canonicalExists: true,
    canonicalId: null,
    canonicalEntry: null,
    detectedSources: [],
    felinaTargets: [],
    agentsPresent: new Set(),
    candidate: null,
    deferred: false,
  };
}

describe("resolutionOptionsFor", () => {
  it("canonicalGlobalOnly returns link + overwrite + rename + discard in order", () => {
    expect(resolutionOptionsFor(rowWith("canonicalGlobalOnly"))).toEqual([
      "link",
      "overwrite",
      "rename",
      "discard",
    ]);
  });

  it("canonicalExistsUnlinked omits discard (no safe fallback)", () => {
    expect(resolutionOptionsFor(rowWith("canonicalExistsUnlinked"))).toEqual([
      "link",
      "overwrite",
      "rename",
    ]);
  });

  it("managedProject has no resolution path", () => {
    expect(resolutionOptionsFor(rowWith("managedProject"))).toEqual([]);
  });

  it("localOnly has no resolution path", () => {
    expect(resolutionOptionsFor(rowWith("localOnly"))).toEqual([]);
  });
});
