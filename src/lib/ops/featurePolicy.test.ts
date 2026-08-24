import { describe, expect, it } from "vitest";
import {
  FEATURE_POLICY,
  getJstHour,
  isScheduledGrokRefreshAllowed,
} from "./featurePolicy";

describe("stopped feature policy", () => {
  it("keeps automatic and new media generation features off", () => {
    expect(FEATURE_POLICY).toEqual({
      autoLearn: false,
      autoRecommendations: false,
      trendGeneration: false,
      newImageGeneration: false,
      newVideoGeneration: false,
    });
  });
});

describe("scheduled Grok refresh policy", () => {
  it.each([
    ["00:59 JST", "2026-07-27T15:59:00.000Z", 0, true],
    ["01:00 JST", "2026-07-27T16:00:00.000Z", 1, false],
    ["07:59 JST", "2026-07-27T22:59:00.000Z", 7, false],
    ["08:00 JST", "2026-07-27T23:00:00.000Z", 8, true],
    ["23:00 JST", "2026-07-27T14:00:00.000Z", 23, true],
  ])("%s", (_label, iso, expectedHour, expectedAllowed) => {
    const date = new Date(iso);
    expect(getJstHour(date)).toBe(expectedHour);
    expect(isScheduledGrokRefreshAllowed(date)).toBe(expectedAllowed);
  });
});
