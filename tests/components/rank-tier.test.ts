import { describe, expect, it } from "vitest";
import { getRankTier } from "@/components/team-details/format-utils";

describe("getRankTier", () => {
  it("uses top 10 / bottom 5 for a 30-team league", () => {
    expect(getRankTier(1, 30)).toBe("top");
    expect(getRankTier(10, 30)).toBe("top");
    expect(getRankTier(11, 30)).toBeUndefined();
    expect(getRankTier(25, 30)).toBeUndefined();
    expect(getRankTier(26, 30)).toBe("bottom");
    expect(getRankTier(30, 30)).toBe("bottom");
  });

  it("keeps top 10 / bottom 5 for a 31-team league", () => {
    expect(getRankTier(10, 31)).toBe("top");
    expect(getRankTier(11, 31)).toBeUndefined();
    expect(getRankTier(26, 31)).toBeUndefined();
    expect(getRankTier(27, 31)).toBe("bottom");
  });

  it("scales down to top 5 / bottom 3 for a 15-team league", () => {
    expect(getRankTier(5, 15)).toBe("top");
    expect(getRankTier(6, 15)).toBeUndefined();
    expect(getRankTier(12, 15)).toBeUndefined();
    expect(getRankTier(13, 15)).toBe("bottom");
  });

  it("falls back to top ten without a team count", () => {
    expect(getRankTier(10, undefined)).toBe("top");
    expect(getRankTier(30, undefined)).toBeUndefined();
  });

  it("ignores missing ranks", () => {
    expect(getRankTier(undefined, 30)).toBeUndefined();
    expect(getRankTier(0, 30)).toBeUndefined();
  });
});
