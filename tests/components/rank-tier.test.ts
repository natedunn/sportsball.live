import { describe, expect, it } from "vitest";
import { getRankTier } from "@/components/team-details/format-utils";

describe("getRankTier", () => {
  it("marks the top ten", () => {
    expect(getRankTier(1, 30)).toBe("top");
    expect(getRankTier(10, 30)).toBe("top");
  });

  it("marks the bottom five", () => {
    expect(getRankTier(25, 30)).toBeUndefined();
    expect(getRankTier(26, 30)).toBe("bottom");
    expect(getRankTier(30, 30)).toBe("bottom");
  });

  it("prefers top ten when the tiers overlap", () => {
    expect(getRankTier(10, 13)).toBe("top");
    expect(getRankTier(11, 13)).toBe("bottom");
  });

  it("skips the bottom tier without a team count", () => {
    expect(getRankTier(30, undefined)).toBeUndefined();
  });

  it("ignores missing ranks", () => {
    expect(getRankTier(undefined, 30)).toBeUndefined();
    expect(getRankTier(0, 30)).toBeUndefined();
  });
});
