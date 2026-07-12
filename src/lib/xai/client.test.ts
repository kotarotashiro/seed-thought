import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getXaiAccessToken: vi.fn(),
  findXaiAuth: vi.fn(),
}));

vi.mock("@/lib/xai/refresh", () => ({
  getXaiAccessToken: mocks.getXaiAccessToken,
}));

vi.mock("@/lib/xai/authStore", () => ({
  findXaiAuth: mocks.findXaiAuth,
}));

import { xaiFetch } from "./client";

const originalClientId = process.env.XAI_CLIENT_ID;

describe("xaiFetch", () => {
  beforeEach(() => {
    process.env.XAI_CLIENT_ID = "test-client-id";
    mocks.getXaiAccessToken.mockReset();
    mocks.findXaiAuth.mockReset();
    vi.restoreAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    if (originalClientId === undefined) delete process.env.XAI_CLIENT_ID;
    else process.env.XAI_CLIENT_ID = originalClientId;
  });

  it("refreshes once and retries when an OAuth request returns 401", async () => {
    mocks.getXaiAccessToken
      .mockResolvedValueOnce({
        token: "old-access",
        storedAccessToken: "stored-old-access",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        refreshed: false,
        rotated: false,
      })
      .mockResolvedValueOnce({
        token: "new-access",
        storedAccessToken: "stored-new-access",
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
        refreshed: true,
        rotated: true,
      });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("expired", { status: 401 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await xaiFetch("https://api.x.ai/v1/responses", {
      method: "POST",
      body: "{}",
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers.get("Authorization")).toBe(
      "Bearer old-access"
    );
    expect(fetchMock.mock.calls[1][1].headers.get("Authorization")).toBe(
      "Bearer new-access"
    );
    expect(mocks.getXaiAccessToken).toHaveBeenNthCalledWith(2, {
      force: true,
      expectedStoredAccessToken: "stored-old-access",
    });
  });
});
