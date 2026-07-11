import { afterEach, describe, expect, it, vi } from "vitest";
import { todayKeyJst } from "./dateKey";

describe("todayKeyJst", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the JST date for the current timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T00:00:00.000Z"));
    expect(todayKeyJst()).toBe("2026-07-09");
  });

  it("moves to the next JST date at the UTC boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T23:00:00.000Z"));
    expect(todayKeyJst()).toBe("2026-07-10");
  });
});
