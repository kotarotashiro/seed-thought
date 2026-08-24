import { afterEach, describe, expect, it } from "vitest";
import { getScopes } from "./oauth";

const originalScopes = process.env.X_SCOPES;

afterEach(() => {
  if (originalScopes === undefined) {
    delete process.env.X_SCOPES;
  } else {
    process.env.X_SCOPES = originalScopes;
  }
});

describe("getScopes", () => {
  it("includes write access in the default X authorization scopes", () => {
    delete process.env.X_SCOPES;

    expect(getScopes()).toContain("tweet.write");
  });

  it("adds required write access when configured scopes omit it", () => {
    process.env.X_SCOPES =
      "tweet.read users.read offline.access like.read bookmark.read";

    const scopes = getScopes();

    expect(scopes).toContain("tweet.write");
    expect(new Set(scopes).size).toBe(scopes.length);
  });
});
