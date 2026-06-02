import { describe, it, expect } from "vitest";
import { flipHunkLines } from "./ManagedInventory";
import type { DiffHunk } from "$lib/types";

const sample: DiffHunk[] = [
  {
    oldStart: 1,
    oldCount: 2,
    newStart: 1,
    newCount: 2,
    lines: [
      { kind: "context", content: "same\n" },
      { kind: "delete", content: "was here\n" },
      { kind: "add", content: "now here\n" },
    ],
  },
];

describe("flipHunkLines (Link dialog direction)", () => {
  it("swaps add ↔ delete and preserves context", () => {
    const flipped = flipHunkLines(sample);
    expect(flipped[0].lines.map((l) => l.kind)).toEqual([
      "context",
      "add",
      "delete",
    ]);
    expect(flipped[0].lines[1].content).toBe("was here\n");
    expect(flipped[0].lines[2].content).toBe("now here\n");
  });

  it("preserves hunk header counts", () => {
    const flipped = flipHunkLines(sample);
    expect(flipped[0].oldStart).toBe(1);
    expect(flipped[0].newStart).toBe(1);
    expect(flipped[0].oldCount).toBe(2);
    expect(flipped[0].newCount).toBe(2);
  });

  it("does not mutate the input", () => {
    flipHunkLines(sample);
    expect(sample[0].lines[1].kind).toBe("delete");
    expect(sample[0].lines[2].kind).toBe("add");
  });
});
