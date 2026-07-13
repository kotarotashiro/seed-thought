import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findXaiAuth: vi.fn(),
  upsertXaiAuth: vi.fn(),
  deleteXaiAuth: vi.fn(),
  getXaiTokenEncryptionKey: vi.fn(() => "test-encryption-key"),
  refreshXaiToken: vi.fn(),
}));

vi.mock("@/lib/xai/authStore", () => ({
  findXaiAuth: mocks.findXaiAuth,
  upsertXaiAuth: mocks.upsertXaiAuth,
  deleteXaiAuth: mocks.deleteXaiAuth,
}));

vi.mock("@/lib/xai/oauth", () => ({
  getXaiTokenEncryptionKey: mocks.getXaiTokenEncryptionKey,
  refreshXaiToken: mocks.refreshXaiToken,
  isTerminalXaiRefreshError: (error: unknown) =>
    error instanceof Error && error.message.includes("invalid_grant"),
}));

vi.mock("@/lib/x/tokenStore", () => ({
  decryptToken: (value: string) => `plain:${value}`,
  encryptToken: (value: string) => `enc:${value}`,
}));

import {
  getXaiAccessToken,
  isXaiAccessTokenRefreshDue,
  refreshStoredXaiTokens,
} from "./refresh";

const originalClientId = process.env.XAI_CLIENT_ID;

function auth(overrides: Partial<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  updatedAt: Date;
}> = {}) {
  return {
    id: "xai-oauth",
    accessToken: "enc:old-access",
    refreshToken: "enc:old-refresh",
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    scope: "offline_access",
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("xAI OAuth refresh policy", () => {
  beforeEach(() => {
    process.env.XAI_CLIENT_ID = "00000000-0000-4000-8000-000000000001";
    mocks.findXaiAuth.mockReset();
    mocks.upsertXaiAuth.mockReset();
    mocks.deleteXaiAuth.mockReset();
    mocks.refreshXaiToken.mockReset();
    mocks.findXaiAuth.mockResolvedValue(auth());
    mocks.upsertXaiAuth.mockResolvedValue(undefined);
  });

  afterAll(() => {
    if (originalClientId === undefined) delete process.env.XAI_CLIENT_ID;
    else process.env.XAI_CLIENT_ID = originalClientId;
  });

  it("refreshes four hours before a known expiry and not earlier", () => {
    const now = Date.now();
    expect(
      isXaiAccessTokenRefreshDue(
        { expiresAt: new Date(now + 5 * 60 * 60 * 1000), updatedAt: new Date(now) },
        now
      )
    ).toBe(false);
    expect(
      isXaiAccessTokenRefreshDue(
        { expiresAt: new Date(now + 3.5 * 60 * 60 * 1000), updatedAt: new Date(now) },
        now
      )
    ).toBe(true);
  });

  it("uses updatedAt when expiresAt is missing", () => {
    const now = Date.now();
    expect(
      isXaiAccessTokenRefreshDue(
        { expiresAt: null, updatedAt: new Date(now - 60 * 60 * 1000) },
        now
      )
    ).toBe(false);
    expect(
      isXaiAccessTokenRefreshDue(
        { expiresAt: null, updatedAt: new Date(now - 3 * 60 * 60 * 1000) },
        now
      )
    ).toBe(true);
  });

  it("shares one refresh request across concurrent callers", async () => {
    const expired = auth({ expiresAt: new Date(Date.now() - 1_000) });
    mocks.findXaiAuth.mockResolvedValue(expired);

    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    mocks.refreshXaiToken.mockImplementation(async () => {
      await refreshGate;
      return {
        accessToken: "new-access",
        refreshToken: "new-refresh",
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
        scope: "offline_access",
      };
    });

    const first = getXaiAccessToken({ force: true });
    await new Promise<void>((resolve) => setImmediate(resolve));
    const second = getXaiAccessToken({ force: true });
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(mocks.refreshXaiToken).toHaveBeenCalledTimes(1);
    releaseRefresh();

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult?.token).toBe("new-access");
    expect(secondResult?.token).toBe("new-access");
    expect(mocks.upsertXaiAuth).toHaveBeenCalledTimes(1);
  });
  it("keeps a newer DB token when another instance wins the refresh race", async () => {
    const oldAuth = auth({ expiresAt: new Date(Date.now() - 1_000) });
    const newAuth = auth({
      accessToken: "enc:new-access",
      refreshToken: "enc:new-refresh",
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() + 1_000),
    });
    mocks.findXaiAuth
      .mockResolvedValueOnce(oldAuth)
      .mockResolvedValueOnce(oldAuth)
      .mockResolvedValueOnce(newAuth);
    mocks.refreshXaiToken.mockRejectedValue(new Error("400 invalid_grant"));

    const result = await getXaiAccessToken({ force: true });

    expect(result?.token).toBe("plain:enc:new-access");
    expect(mocks.deleteXaiAuth).not.toHaveBeenCalled();
  });

  it("keeps auth when xAI rejects the configured client id", async () => {
    const expired = auth({ expiresAt: new Date(Date.now() - 1_000) });
    mocks.findXaiAuth.mockResolvedValue(expired);
    mocks.refreshXaiToken.mockRejectedValue(new Error("401 invalid_client"));

    await expect(getXaiAccessToken({ force: true })).rejects.toThrow(
      "invalid_client"
    );
    expect(mocks.deleteXaiAuth).not.toHaveBeenCalled();
  });

  it("can force an authenticated refresh for deployment verification", async () => {
    const fresh = auth({ expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000) });
    mocks.findXaiAuth.mockResolvedValue(fresh);
    mocks.refreshXaiToken.mockResolvedValue({
      accessToken: "forced-access",
      refreshToken: "forced-refresh",
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      scope: "offline_access",
    });

    const result = await refreshStoredXaiTokens({ force: true });

    expect(result.ok).toBe(true);
    expect(mocks.refreshXaiToken).toHaveBeenCalledTimes(1);
    expect(mocks.deleteXaiAuth).not.toHaveBeenCalled();
  });
});
