import { describe, it, expect } from "vitest";
import { getMergedNavItems, NAV_ITEMS } from "./navigation";

describe("getMergedNavItems", () => {
  it("returns default order when customOrder is null", () => {
    expect(getMergedNavItems(null)).toBe(NAV_ITEMS);
  });

  it("preserves custom order and appends new items", () => {
    const custom = ["tokens", "skills"];
    const result = getMergedNavItems(custom);
    expect(result[0].id).toBe("tokens");
    expect(result[1].id).toBe("skills");
    expect(result.length).toBe(NAV_ITEMS.length);
    expect(result.slice(2).every((item) => !custom.includes(item.id))).toBe(true);
  });

  it("omits removed items from custom order", () => {
    const custom = ["skills", "GONE" as string, "tokens"];
    const result = getMergedNavItems(custom);
    expect(result.find((item) => item.id === ("GONE" as string))).toBeUndefined();
    expect(result[0].id).toBe("skills");
    expect(result[1].id).toBe("tokens");
  });
});
