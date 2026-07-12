import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshXaiToken } from "./oauth";

const originalClientId = process.env.XAI_CLIENT_ID;

describe("xAI OAuth token response", () => {
  beforeEach(() => {
    process.env.XAI_CLIENT_ID = "test-client-id";
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    if (originalClientId === undefined) delete process.env.XAI_CLIENT_ID;
    else process.env.XAI_CLIENT_ID = originalClientId;
  });

  it("accepts expires_in when the OAuth server returns it as a string", async () => {
    const discovery = {
      authorization_endpoint: "https://auth.x.ai/authorize",
      token_endpoint: "https://auth.x.ai/oauth/token",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(discovery), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "access-token",
            refresh_token: "refresh-token",
            expires_in: "21600",
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const before = Date.now();
    const result = await refreshXaiToken("refresh-token");

    expect(result.accessToken).toBe("access-token");
    expect(result.refreshToken).toBe("refresh-token");
    expect(result.expiresAt?.getTime()).toBeGreaterThanOrEqual(before + 21_599_000);
    expect(result.expiresAt?.getTime()).toBeLessThanOrEqual(Date.now() + 21_600_000);
  });
});
